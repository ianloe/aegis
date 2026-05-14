/**
 * pihole.ts — Pi-hole connector for Aegis AI Discovery
 *
 * Authenticates with the Pi-hole v6 API, pulls DNS query history,
 * filters for known AI service domains, and feeds findings into the
 * discovery_findings table.
 *
 * Pi-hole API v6 auth flow:
 *   POST /api/auth { password } → { session: { sid, validity } }
 *   GET  /api/queries?domain=...&sid=... → { queries: [...] }
 *   DELETE /api/auth { sid } → logout
 */

import { getDb } from "./db.js";
import { piholeSettings, discoveryFindings, discoveryScans } from "../drizzle/schema.js";
import { eq } from "drizzle-orm";
import { AI_SERVICE_CATALOGUE } from "./discovery.js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PiholeSession {
  sid: string;
  validity: number; // seconds until expiry
}

interface PiholeQuery {
  id: number;
  time: number; // unix timestamp
  type: string;
  domain: string;
  client: string;
  status: number;
  reply: { type: string; time: number };
}

interface PiholeQueriesResponse {
  queries: PiholeQuery[];
  cursor: number | null;
  recordsTotal: number;
  recordsFiltered: number;
  took: number;
}

// ─── Pi-hole API client ───────────────────────────────────────────────────────

async function piholeAuth(baseUrl: string, password: string): Promise<PiholeSession> {
  const url = `${baseUrl}/api/auth`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
    // Allow self-signed certs on local network
    // @ts-ignore — node 18+ fetch signal
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Pi-hole auth failed (${res.status}): ${body}`);
  }

  const data = await res.json() as { session: { valid: boolean; sid: string; validity: number } };
  if (!data.session?.valid) {
    throw new Error("Pi-hole auth returned invalid session — check your app password.");
  }

  return { sid: data.session.sid, validity: data.session.validity };
}

async function piholeLogout(baseUrl: string, sid: string): Promise<void> {
  try {
    await fetch(`${baseUrl}/api/auth`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "X-FTL-SID": sid },
      body: JSON.stringify({ sid }),
      // @ts-ignore
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // Best-effort logout — do not throw
  }
}

/**
 * Pull DNS queries from Pi-hole for a specific domain pattern.
 * Uses cursor-based pagination to retrieve up to maxResults records.
 */
async function piholeQueryDomain(
  baseUrl: string,
  sid: string,
  domain: string,
  from: number, // unix timestamp
  maxResults = 500
): Promise<PiholeQuery[]> {
  const results: PiholeQuery[] = [];
  let cursor: number | null = null;

  do {
    const params = new URLSearchParams({
      domain,
      from: String(from),
      length: "100",
    });
    if (cursor !== null) params.set("cursor", String(cursor));

    const url = `${baseUrl}/api/queries?${params.toString()}`;
    const res = await fetch(url, {
      headers: { "X-FTL-SID": sid },
      // @ts-ignore
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) break;

    const data = await res.json() as PiholeQueriesResponse;
    results.push(...(data.queries ?? []));
    cursor = data.cursor ?? null;
  } while (cursor !== null && results.length < maxResults);

  return results;
}

// ─── AI domain matching ───────────────────────────────────────────────────────

/**
 * Build a set of all known AI domains from the catalogue for fast lookup.
 * Also includes partial-match patterns (e.g. "openai" matches "api.openai.com").
 */
interface AiDomainMeta { toolName: string; vendor: string; category: string; }

function buildAiDomainIndex(): Array<[string, AiDomainMeta]> {
  const entries: Array<[string, AiDomainMeta]> = [];
  for (const entry of AI_SERVICE_CATALOGUE) {
    const domain = entry.endpoint
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .toLowerCase();
    entries.push([domain, { toolName: entry.toolName, vendor: entry.vendor, category: entry.category }]);
  }
  return entries;
}

const AI_DOMAIN_INDEX = buildAiDomainIndex();

function matchAiDomain(queriedDomain: string): AiDomainMeta | null {
  const d = queriedDomain.toLowerCase();
  for (const [indexedDomain, meta] of AI_DOMAIN_INDEX) {
    if (d === indexedDomain || d.endsWith(`.${indexedDomain}`)) return meta;
  }
  return null;
}

// ─── Main pull function ───────────────────────────────────────────────────────

export interface PiholePullResult {
  scanned: number;
  newFindings: number;
  domains: string[];
  error?: string;
}

/**
 * Pull AI-related DNS queries from Pi-hole and create discovery findings.
 * Returns a summary of what was found.
 */
export async function pullPiholeFindings(tenantId: number): Promise<PiholePullResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available.");

  // Load settings
  const [settings] = await db
    .select()
    .from(piholeSettings)
    .where(eq(piholeSettings.tenantId, tenantId));

  if (!settings || !settings.enabled) {
    throw new Error("Pi-hole connector is not enabled for this tenant.");
  }
  if (!settings.appPassword) {
    throw new Error("Pi-hole app password is not configured.");
  }

  const baseUrl = settings.url.replace(/\/$/, "");

    // Create a scan record
  const [scanResult] = await db.insert(discoveryScans).values({
    tenantId,
    scanType: "endpoint_probe",
    status: "running",
    triggeredBy: "pihole_connector",
    inputSummary: "Pi-hole DNS query pull",
  });
  const scanId = (scanResult as any).insertId as number;

  let sid: string | null = null;
  const newDomains: string[] = [];
  let scanned = 0;
  let newFindings = 0;

  try {
    // Authenticate
    const session = await piholeAuth(baseUrl, settings.appPassword);
    sid = session.sid;

    // Pull queries from the last 24 hours
    const from = Math.floor(Date.now() / 1000) - 86400;

    // Load existing finding toolNames and endpoints once to avoid per-row DB calls
    const existingFindings = await db
      .select({ toolName: discoveryFindings.toolName, endpoint: discoveryFindings.endpoint })
      .from(discoveryFindings)
      .where(eq(discoveryFindings.tenantId, tenantId));
    const existingToolNames = new Set(existingFindings.map((f) => f.toolName));
    const existingEndpoints = new Set(existingFindings.map((f) => f.endpoint ?? ""));

    // Query for each AI domain in the catalogue (batched by unique base domain)
    const checkedDomains = new Set<string>();
    const aiDomains = AI_DOMAIN_INDEX.map(([domain]) => domain);

    for (const domain of aiDomains) {
      if (checkedDomains.has(domain)) continue;
      checkedDomains.add(domain);

      const queries = await piholeQueryDomain(baseUrl, sid, domain, from);
      scanned += queries.length;

      for (const q of queries) {
        const match = matchAiDomain(q.domain);
        if (!match) continue;

        // Skip if this tool or exact endpoint is already in findings
        if (existingToolNames.has(match.toolName) || existingEndpoints.has(q.domain)) continue;

        // Create new finding
        await db.insert(discoveryFindings).values({
          tenantId,
          scanId,
          toolName: match.toolName,
          vendor: match.vendor,
          category: match.category,
          endpoint: q.domain,
          detectionMethod: "dns_probe",
          confidence: "high",
          evidence: `Pi-hole DNS query from client ${q.client} at ${new Date(q.time * 1000).toISOString()} (query type: ${q.type})`,
          riskLevel: "medium",
          status: "new",
        });

        // Update in-memory sets so repeated queries in this pull don't create duplicates
        existingToolNames.add(match.toolName);
        existingEndpoints.add(q.domain);
        newFindings++;
        if (!newDomains.includes(match.toolName)) {
          newDomains.push(match.toolName);
        }
      }
    }

    // Update scan record
    await db
      .update(discoveryScans)
      .set({
        status: "completed",
        completedAt: new Date(),
        findingsCount: newFindings,
        inputSummary: `Pulled ${scanned} DNS queries, found ${newFindings} new AI service(s): ${newDomains.join(", ") || "none"}`,
      })
      .where(eq(discoveryScans.id, scanId));

    // Update settings last sync (upsert so it works even if no row exists yet)
    await db
      .insert(piholeSettings)
      .values({
        tenantId,
        url: settings.url,
        enabled: settings.enabled,
        lastSyncedAt: new Date(),
        lastSyncStatus: "success",
        lastSyncCount: newFindings,
      })
      .onDuplicateKeyUpdate({
        set: { lastSyncedAt: new Date(), lastSyncStatus: "success", lastSyncCount: newFindings },
      });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    await db
      .update(discoveryScans)
      .set({ status: "failed", completedAt: new Date(), errorMessage: message })
      .where(eq(discoveryScans.id, scanId));

    // Use upsert so this works even if the settings row doesn't exist yet
    await db
      .insert(piholeSettings)
      .values({
        tenantId,
        url: settings?.url ?? "http://10.0.5.24",
        enabled: settings?.enabled ?? false,
        lastSyncedAt: new Date(),
        lastSyncStatus: `error: ${message.slice(0, 60)}`,
      })
      .onDuplicateKeyUpdate({
        set: { lastSyncedAt: new Date(), lastSyncStatus: `error: ${message.slice(0, 60)}` },
      });

    throw err;
  } finally {
    if (sid) await piholeLogout(baseUrl, sid);
  }

  return { scanned, newFindings, domains: newDomains };
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

export async function getPiholeSettings(tenantId: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select({
      id: piholeSettings.id,
      url: piholeSettings.url,
      enabled: piholeSettings.enabled,
      lastSyncedAt: piholeSettings.lastSyncedAt,
      lastSyncStatus: piholeSettings.lastSyncStatus,
      lastSyncCount: piholeSettings.lastSyncCount,
      // Never return the password
    })
    .from(piholeSettings)
    .where(eq(piholeSettings.tenantId, tenantId));
  return row ?? null;
}

export async function savePiholeSettings(
  tenantId: number,
  data: { url: string; appPassword?: string; enabled: boolean }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available.");

  const existing = await getPiholeSettings(tenantId);
  if (existing) {
    const updateData: Record<string, unknown> = {
      url: data.url,
      enabled: data.enabled,
    };
    if (data.appPassword) updateData.appPassword = data.appPassword;
    await db.update(piholeSettings).set(updateData).where(eq(piholeSettings.tenantId, tenantId));
  } else {
    await db.insert(piholeSettings).values({
      tenantId,
      url: data.url,
      appPassword: data.appPassword ?? null,
      enabled: data.enabled,
    });
  }
}
