import { and, desc, eq, gte, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  agents,
  approvalQueue,
  auditLogs,
  complianceReports,
  dataPolicies,
  InsertUser,
  llmAnalyses,
  notifications,
  riskScoreHistory,
  shadowAiTools,
  tenantMembers,
  tenants,
  users,
  vendorEvents,
  discoveryScans,
  discoveryFindings,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result[0] ?? null;
}

export async function createUser(data: {
  username: string;
  passwordHash: string;
  name?: string;
  email?: string;
  role?: "user" | "admin";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(users).values({
    username: data.username,
    passwordHash: data.passwordHash,
    name: data.name ?? data.username,
    email: data.email ?? null,
    role: data.role ?? "user",
    lastSignedIn: new Date(),
  });
  const created = await getUserByUsername(data.username);
  if (!created) throw new Error("Failed to create user");
  return created;
}

export async function countUsers() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(users);
  return Number(result[0]?.count ?? 0);
}

export async function updateUserLastSignedIn(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, id));
}

// ─── Tenants ──────────────────────────────────────────────────────────────────

export async function getOrCreateDefaultTenant() {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(tenants).where(eq(tenants.slug, "default")).limit(1);
  if (existing[0]) return existing[0];
  await db.insert(tenants).values({ name: "Default Organisation", slug: "default", industry: "Technology", country: "Singapore" });
  const created = await db.select().from(tenants).where(eq(tenants.slug, "default")).limit(1);
  return created[0] ?? null;
}

export async function getTenantById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  return result[0] ?? null;
}

export async function ensureTenantMember(userId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(tenantMembers)
    .where(and(eq(tenantMembers.userId, userId), eq(tenantMembers.tenantId, tenantId))).limit(1);
  if (!existing[0]) {
    await db.insert(tenantMembers).values({ userId, tenantId, tenantRole: "admin" });
  }
}

// ─── Agents ───────────────────────────────────────────────────────────────────

export async function getAgents(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agents).where(eq(agents.tenantId, tenantId)).orderBy(desc(agents.createdAt));
}

export async function getAgentById(id: number, tenantId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(agents)
    .where(and(eq(agents.id, id), eq(agents.tenantId, tenantId))).limit(1);
  return result[0] ?? null;
}

export async function createAgent(data: typeof agents.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(agents).values(data);
  const result = await db.select().from(agents)
    .where(and(eq(agents.tenantId, data.tenantId), eq(agents.name, data.name)))
    .orderBy(desc(agents.createdAt)).limit(1);
  return result[0];
}

export async function updateAgent(id: number, tenantId: number, data: Partial<typeof agents.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(agents).set(data).where(and(eq(agents.id, id), eq(agents.tenantId, tenantId)));
}

export async function getAgentByApiKey(apiKey: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(agents).where(eq(agents.apiKey, apiKey)).limit(1);
  return result[0] ?? null;
}

export async function updateAgentStatus(id: number, tenantId: number, status: "active" | "suspended" | "decommissioned") {
  const db = await getDb();
  if (!db) return;
  await db.update(agents).set({ status }).where(and(eq(agents.id, id), eq(agents.tenantId, tenantId)));
}

export async function updateAgentRiskScore(id: number, tenantId: number, score: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(agents).set({ riskScore: score }).where(and(eq(agents.id, id), eq(agents.tenantId, tenantId)));
}

// ─── Data Policies ────────────────────────────────────────────────────────────

export async function getDataPolicies(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dataPolicies).where(eq(dataPolicies.tenantId, tenantId)).orderBy(dataPolicies.tier);
}

export async function createDataPolicy(data: typeof dataPolicies.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(dataPolicies).values(data);
  const result = await db.select().from(dataPolicies)
    .where(and(eq(dataPolicies.tenantId, data.tenantId), eq(dataPolicies.name, data.name)))
    .orderBy(desc(dataPolicies.createdAt)).limit(1);
  return result[0];
}

export async function updateDataPolicy(id: number, tenantId: number, data: Partial<typeof dataPolicies.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(dataPolicies).set(data).where(and(eq(dataPolicies.id, id), eq(dataPolicies.tenantId, tenantId)));
}

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export async function getAuditLogs(tenantId: number, filters?: {
  agentId?: number;
  actionType?: string;
  dataTier?: string;
  search?: string;
  flagged?: boolean;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { logs: [], total: 0 };

  const conditions = [eq(auditLogs.tenantId, tenantId)];
  if (filters?.agentId) conditions.push(eq(auditLogs.agentId, filters.agentId));
  if (filters?.flagged) conditions.push(eq(auditLogs.flagged, true));
  if (filters?.search) {
    conditions.push(or(
      like(auditLogs.summary, `%${filters.search}%`),
      like(auditLogs.agentName, `%${filters.search}%`),
      like(auditLogs.userName, `%${filters.search}%`)
    )!);
  }

  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  const logs = await db.select().from(auditLogs)
    .where(and(...conditions))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  const countResult = await db.select({ count: sql<number>`count(*)` }).from(auditLogs).where(and(...conditions));
  const total = Number(countResult[0]?.count ?? 0);

  return { logs, total };
}

export async function createAuditLog(data: typeof auditLogs.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  // Tamper-evident chain: fetch the most recent log for this tenant and hash the chain
  const { createHash } = await import("crypto");
  const [lastLog] = await db
    .select({ entryHash: auditLogs.entryHash })
    .from(auditLogs)
    .where(eq(auditLogs.tenantId, data.tenantId!))
    .orderBy(desc(auditLogs.id))
    .limit(1);
  const prevHash = lastLog?.entryHash ?? "genesis";
  const entryContent = JSON.stringify({
    tenantId: data.tenantId,
    agentId: data.agentId,
    actionType: data.actionType,
    dataTier: data.dataTier,
    summary: data.summary,
    details: data.details,
    prevHash,
    ts: Date.now(),
  });
  const entryHash = createHash("sha256").update(entryContent).digest("hex").slice(0, 64);
  await db.insert(auditLogs).values({ ...data, prevHash, entryHash });
}

// ─── Approval Queue ───────────────────────────────────────────────────────────

export async function getApprovalQueue(tenantId: number, status?: "pending" | "approved" | "rejected") {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(approvalQueue.tenantId, tenantId)];
  if (status) conditions.push(eq(approvalQueue.status, status));
  return db.select().from(approvalQueue).where(and(...conditions)).orderBy(desc(approvalQueue.createdAt));
}

export async function createApprovalRequest(data: typeof approvalQueue.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(approvalQueue).values(data);
  const result = await db.select().from(approvalQueue)
    .where(eq(approvalQueue.tenantId, data.tenantId))
    .orderBy(desc(approvalQueue.createdAt)).limit(1);
  return result[0];
}

export async function reviewApprovalRequest(id: number, tenantId: number, decision: "approved" | "rejected", reviewedBy: string, note?: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(approvalQueue)
    .set({ status: decision, reviewedBy, reviewNote: note ?? null, reviewedAt: new Date() })
    .where(and(eq(approvalQueue.id, id), eq(approvalQueue.tenantId, tenantId)));
}

// ─── Risk Scores ──────────────────────────────────────────────────────────────

export async function getRiskScoreHistory(tenantId: number, agentId?: number, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(riskScoreHistory.tenantId, tenantId)];
  if (agentId) conditions.push(eq(riskScoreHistory.agentId, agentId));
  return db.select().from(riskScoreHistory)
    .where(and(...conditions))
    .orderBy(desc(riskScoreHistory.calculatedAt))
    .limit(limit);
}

export async function saveRiskScore(data: typeof riskScoreHistory.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(riskScoreHistory).values(data);
}

// ─── Shadow AI Tools ──────────────────────────────────────────────────────────

export async function getShadowAiTools(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shadowAiTools).where(eq(shadowAiTools.tenantId, tenantId)).orderBy(desc(shadowAiTools.usageCount));
}

export async function upsertShadowAiTool(data: typeof shadowAiTools.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(shadowAiTools).values(data).onDuplicateKeyUpdate({
    set: { usageCount: sql`usageCount + 1`, lastSeenAt: new Date() },
  });
}

export async function sanctionTool(id: number, tenantId: number, sanctioned: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(shadowAiTools).set({ sanctioned }).where(and(eq(shadowAiTools.id, id), eq(shadowAiTools.tenantId, tenantId)));
}

// ─── Vendor Events ────────────────────────────────────────────────────────────

export async function getVendorEvents(tenantId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vendorEvents).where(eq(vendorEvents.tenantId, tenantId)).orderBy(desc(vendorEvents.createdAt)).limit(limit);
}

export async function createVendorEvent(data: typeof vendorEvents.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(vendorEvents).values(data);
}

// ─── Compliance Reports ───────────────────────────────────────────────────────

export async function getComplianceReports(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(complianceReports).where(eq(complianceReports.tenantId, tenantId)).orderBy(desc(complianceReports.createdAt));
}

export async function createComplianceReport(data: typeof complianceReports.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(complianceReports).values(data);
  const result = await db.select().from(complianceReports)
    .where(eq(complianceReports.tenantId, data.tenantId))
    .orderBy(desc(complianceReports.createdAt)).limit(1);
  return result[0];
}

export async function updateComplianceReport(id: number, tenantId: number, data: Partial<typeof complianceReports.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(complianceReports).set(data).where(and(eq(complianceReports.id, id), eq(complianceReports.tenantId, tenantId)));
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function getNotifications(tenantId: number, userId?: number, unreadOnly = false) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(notifications.tenantId, tenantId)];
  if (userId) conditions.push(or(eq(notifications.userId, userId), sql`notifications.userId IS NULL`)!);
  if (unreadOnly) conditions.push(eq(notifications.read, false));
  return db.select().from(notifications).where(and(...conditions)).orderBy(desc(notifications.createdAt)).limit(50);
}

export async function createNotification(data: typeof notifications.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values(data);
}

export async function markNotificationRead(id: number, tenantId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ read: true }).where(and(eq(notifications.id, id), eq(notifications.tenantId, tenantId)));
}

export async function markAllNotificationsRead(tenantId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ read: true }).where(eq(notifications.tenantId, tenantId));
}

// ─── LLM Analyses ─────────────────────────────────────────────────────────────

export async function getLlmAnalyses(tenantId: number, agentId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(llmAnalyses.tenantId, tenantId)];
  if (agentId) conditions.push(eq(llmAnalyses.agentId, agentId));
  return db.select().from(llmAnalyses).where(and(...conditions)).orderBy(desc(llmAnalyses.createdAt)).limit(20);
}

export async function saveLlmAnalysis(data: typeof llmAnalyses.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(llmAnalyses).values(data);
  const result = await db.select().from(llmAnalyses)
    .where(eq(llmAnalyses.tenantId, data.tenantId))
    .orderBy(desc(llmAnalyses.createdAt)).limit(1);
  return result[0];
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export async function getDashboardStats(tenantId: number) {
  const db = await getDb();
  if (!db) return null;

  const [agentStats] = await db.select({
    total: sql<number>`count(*)`,
    active: sql<number>`sum(case when status = 'active' then 1 else 0 end)`,
    suspended: sql<number>`sum(case when status = 'suspended' then 1 else 0 end)`,
    decommissioned: sql<number>`sum(case when status = 'decommissioned' then 1 else 0 end)`,
    avgRisk: sql<number>`avg(cast(riskScore as decimal))`,
  }).from(agents).where(eq(agents.tenantId, tenantId));

  const [pendingApprovals] = await db.select({ count: sql<number>`count(*)` })
    .from(approvalQueue).where(and(eq(approvalQueue.tenantId, tenantId), eq(approvalQueue.status, "pending")));

  const [flaggedLogs] = await db.select({ count: sql<number>`count(*)` })
    .from(auditLogs).where(and(eq(auditLogs.tenantId, tenantId), eq(auditLogs.flagged, true)));

  const [unsanctionedTools] = await db.select({ count: sql<number>`count(*)` })
    .from(shadowAiTools).where(and(eq(shadowAiTools.tenantId, tenantId), eq(shadowAiTools.sanctioned, false)));

  const [unreadNotifs] = await db.select({ count: sql<number>`count(*)` })
    .from(notifications).where(and(eq(notifications.tenantId, tenantId), eq(notifications.read, false)));

  const recentLogs = await db.select().from(auditLogs)
    .where(eq(auditLogs.tenantId, tenantId))
    .orderBy(desc(auditLogs.createdAt)).limit(10);

  const recentAlerts = await db.select().from(notifications)
    .where(and(eq(notifications.tenantId, tenantId)))
    .orderBy(desc(notifications.createdAt)).limit(5);

  return {
    agents: {
      total: Number(agentStats?.total ?? 0),
      active: Number(agentStats?.active ?? 0),
      suspended: Number(agentStats?.suspended ?? 0),
      decommissioned: Number(agentStats?.decommissioned ?? 0),
      avgRisk: Number(agentStats?.avgRisk ?? 0),
    },
    pendingApprovals: Number(pendingApprovals?.count ?? 0),
    flaggedLogs: Number(flaggedLogs?.count ?? 0),
    unsanctionedTools: Number(unsanctionedTools?.count ?? 0),
    unreadNotifications: Number(unreadNotifs?.count ?? 0),
    recentLogs,
    recentAlerts,
  };
}

// ─── Admin User Management ────────────────────────────────────────────────────

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: users.id,
    username: users.username,
    name: users.name,
    email: users.email,
    role: users.role,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn,
  }).from(users).orderBy(users.createdAt);
}

export async function updateUserRole(id: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, id));
}

export async function deleteUser(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(users).where(eq(users.id, id));
}

export async function adminResetPassword(id: number, passwordHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ passwordHash }).where(eq(users.id, id));
}

// ─── Discovery Scans ──────────────────────────────────────────────────────────

export async function createDiscoveryScan(data: {
  tenantId: number;
  scanType: "endpoint_probe" | "log_analysis" | "audit_fingerprint";
  triggeredBy?: string;
  inputSummary?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(discoveryScans).values({ ...data, status: "running" });
  const rows = await db
    .select()
    .from(discoveryScans)
    .where(eq(discoveryScans.tenantId, data.tenantId))
    .orderBy(desc(discoveryScans.id))
    .limit(1);
  return rows[0] ?? null;
}

export async function completeDiscoveryScan(
  id: number,
  findingsCount: number,
  durationMs: number,
  errorMessage?: string
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(discoveryScans)
    .set({
      status: errorMessage ? "failed" : "completed",
      findingsCount,
      durationMs,
      errorMessage: errorMessage ?? null,
      completedAt: new Date(),
    })
    .where(eq(discoveryScans.id, id));
}

export async function getDiscoveryScans(tenantId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(discoveryScans)
    .where(eq(discoveryScans.tenantId, tenantId))
    .orderBy(desc(discoveryScans.createdAt))
    .limit(limit);
}

// ─── Discovery Findings ───────────────────────────────────────────────────────

export async function createDiscoveryFinding(data: {
  tenantId: number;
  scanId: number;
  toolName: string;
  vendor?: string;
  category?: string;
  endpoint?: string;
  detectionMethod: "dns_probe" | "http_probe" | "log_pattern" | "audit_pattern" | "llm_extraction";
  confidence: "low" | "medium" | "high";
  evidence?: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  riskRationale?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(discoveryFindings).values({ ...data, status: "new" });
}

export async function getDiscoveryFindings(tenantId: number, scanId?: number, status?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(discoveryFindings.tenantId, tenantId)];
  if (scanId) conditions.push(eq(discoveryFindings.scanId, scanId));
  if (status) conditions.push(eq(discoveryFindings.status, status as "new" | "reviewed" | "promoted_agent" | "added_shadow" | "dismissed"));
  return db
    .select()
    .from(discoveryFindings)
    .where(and(...conditions))
    .orderBy(desc(discoveryFindings.createdAt));
}

export async function updateDiscoveryFinding(
  id: number,
  tenantId: number,
  data: {
    status: "new" | "reviewed" | "promoted_agent" | "added_shadow" | "dismissed";
    reviewedBy?: string;
    reviewNote?: string;
    promotedAgentId?: number;
    shadowToolId?: number;
  }
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(discoveryFindings)
    .set({ ...data, reviewedAt: new Date() })
    .where(and(eq(discoveryFindings.id, id), eq(discoveryFindings.tenantId, tenantId)));
}

export async function countNewDiscoveryFindings(tenantId: number) {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(discoveryFindings)
    .where(and(eq(discoveryFindings.tenantId, tenantId), eq(discoveryFindings.status, "new")));
  return Number(rows[0]?.count ?? 0);
}
