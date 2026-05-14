/**
 * Aegis Discovery Engine
 *
 * Three detection strategies:
 *  1. endpoint_probe  – DNS + HTTP HEAD probe of a curated catalogue of known AI service endpoints
 *  2. log_analysis    – LLM-assisted extraction of AI tool references from submitted log/DNS/proxy text
 *  3. audit_fingerprint – Cross-reference the tenant's own audit logs for API call patterns that match
 *                         known AI provider domains but are not attributed to any registered agent
 */

import { invokeLLM } from "./_core/llm";

// ─── Known AI Service Catalogue ───────────────────────────────────────────────
// Each entry describes a known AI service endpoint that organisations may be
// using without formal governance registration.

export interface AiServiceEntry {
  toolName: string;
  vendor: string;
  category: string;
  endpoint: string;          // hostname to probe
  riskLevel: "low" | "medium" | "high" | "critical";
  riskRationale: string;
}

export const AI_SERVICE_CATALOGUE: AiServiceEntry[] = [
  // ── Large Language Models ──
  { toolName: "OpenAI API", vendor: "OpenAI", category: "LLM", endpoint: "api.openai.com", riskLevel: "high", riskRationale: "General-purpose LLM API; may process sensitive prompts and data" },
  { toolName: "OpenAI ChatGPT", vendor: "OpenAI", category: "LLM Chat", endpoint: "chat.openai.com", riskLevel: "medium", riskRationale: "Consumer chat interface; data may be used for training by default" },
  { toolName: "Anthropic Claude API", vendor: "Anthropic", category: "LLM", endpoint: "api.anthropic.com", riskLevel: "high", riskRationale: "General-purpose LLM API with broad capability; requires data handling review" },
  { toolName: "Claude.ai", vendor: "Anthropic", category: "LLM Chat", endpoint: "claude.ai", riskLevel: "medium", riskRationale: "Consumer chat interface; data retention policies vary by plan" },
  { toolName: "Google Gemini API", vendor: "Google", category: "LLM", endpoint: "generativelanguage.googleapis.com", riskLevel: "high", riskRationale: "Google LLM API; data may be processed in Google infrastructure" },
  { toolName: "Google Gemini App", vendor: "Google", category: "LLM Chat", endpoint: "gemini.google.com", riskLevel: "medium", riskRationale: "Consumer Gemini interface; linked to Google account data" },
  { toolName: "Mistral AI API", vendor: "Mistral AI", category: "LLM", endpoint: "api.mistral.ai", riskLevel: "high", riskRationale: "European LLM API; GDPR-compliant but requires data classification review" },
  { toolName: "Cohere API", vendor: "Cohere", category: "LLM", endpoint: "api.cohere.ai", riskLevel: "high", riskRationale: "Enterprise LLM API; data handling depends on contract tier" },
  { toolName: "Together AI", vendor: "Together AI", category: "LLM", endpoint: "api.together.xyz", riskLevel: "medium", riskRationale: "Open-model hosting API; data residency may be unclear" },
  { toolName: "Groq API", vendor: "Groq", category: "LLM", endpoint: "api.groq.com", riskLevel: "medium", riskRationale: "Fast inference API; data handling policies require review" },
  { toolName: "Perplexity AI", vendor: "Perplexity AI", category: "LLM Search", endpoint: "api.perplexity.ai", riskLevel: "medium", riskRationale: "AI-powered search API; queries may be logged" },
  { toolName: "Perplexity App", vendor: "Perplexity AI", category: "LLM Search", endpoint: "www.perplexity.ai", riskLevel: "low", riskRationale: "Consumer search interface; lower data sensitivity risk" },

  // ── Cloud AI Platforms ──
  { toolName: "Azure OpenAI Service", vendor: "Microsoft", category: "Cloud AI", endpoint: "openai.azure.com", riskLevel: "medium", riskRationale: "Enterprise Azure-hosted OpenAI; data stays in Azure tenant if configured correctly" },
  { toolName: "AWS Bedrock", vendor: "Amazon", category: "Cloud AI", endpoint: "bedrock.us-east-1.amazonaws.com", riskLevel: "medium", riskRationale: "AWS managed AI service; data residency controlled by region selection" },
  { toolName: "AWS SageMaker", vendor: "Amazon", category: "Cloud AI", endpoint: "sagemaker.us-east-1.amazonaws.com", riskLevel: "medium", riskRationale: "AWS ML platform; model and data governance depends on IAM configuration" },
  { toolName: "Google Vertex AI", vendor: "Google", category: "Cloud AI", endpoint: "us-central1-aiplatform.googleapis.com", riskLevel: "medium", riskRationale: "Google Cloud AI platform; enterprise data handling with VPC controls available" },
  { toolName: "Hugging Face Inference API", vendor: "Hugging Face", category: "LLM", endpoint: "api-inference.huggingface.co", riskLevel: "high", riskRationale: "Public model hosting; data sent to shared inference infrastructure" },
  { toolName: "Hugging Face Hub", vendor: "Hugging Face", category: "Model Registry", endpoint: "huggingface.co", riskLevel: "low", riskRationale: "Model registry; risk depends on models downloaded and deployed internally" },
  { toolName: "Replicate", vendor: "Replicate", category: "Cloud AI", endpoint: "api.replicate.com", riskLevel: "high", riskRationale: "Serverless model hosting; data processed on shared infrastructure" },

  // ── AI Coding Assistants ──
  { toolName: "GitHub Copilot", vendor: "GitHub / Microsoft", category: "Code Assistant", endpoint: "copilot-proxy.githubusercontent.com", riskLevel: "high", riskRationale: "Code completion AI; may transmit source code including secrets to Microsoft" },
  { toolName: "Cursor AI", vendor: "Anysphere", category: "Code Assistant", endpoint: "api2.cursor.sh", riskLevel: "high", riskRationale: "AI code editor; sends code context to remote LLM; source code exposure risk" },
  { toolName: "Tabnine", vendor: "Tabnine", category: "Code Assistant", endpoint: "api.tabnine.com", riskLevel: "medium", riskRationale: "Code completion; enterprise tier supports local models to reduce data exposure" },
  { toolName: "Codeium", vendor: "Codeium", category: "Code Assistant", endpoint: "web-backend.codeium.com", riskLevel: "high", riskRationale: "AI code completion; code context transmitted to Codeium servers" },
  { toolName: "Amazon CodeWhisperer", vendor: "Amazon", category: "Code Assistant", endpoint: "codewhisperer.us-east-1.amazonaws.com", riskLevel: "medium", riskRationale: "AWS code assistant; data handling governed by AWS data processing terms" },

  // ── AI Productivity Tools ──
  { toolName: "Notion AI", vendor: "Notion", category: "Productivity AI", endpoint: "www.notion.so", riskLevel: "medium", riskRationale: "Workspace AI; document content sent to OpenAI via Notion; data classification required" },
  { toolName: "Microsoft Copilot 365", vendor: "Microsoft", category: "Productivity AI", endpoint: "substrate.office.com", riskLevel: "medium", riskRationale: "M365 Copilot; processes email, documents, Teams data; requires M365 data governance review" },
  { toolName: "Grammarly", vendor: "Grammarly", category: "Writing AI", endpoint: "api.grammarly.com", riskLevel: "medium", riskRationale: "Writing assistant; text content transmitted to Grammarly servers for analysis" },
  { toolName: "Jasper AI", vendor: "Jasper", category: "Content AI", endpoint: "api.jasper.ai", riskLevel: "medium", riskRationale: "AI content generation; prompts and outputs may be stored by vendor" },

  // ── AI Image / Multimodal ──
  { toolName: "DALL-E API", vendor: "OpenAI", category: "Image Generation", endpoint: "labs.openai.com", riskLevel: "medium", riskRationale: "Image generation via OpenAI API; image prompts may contain sensitive context" },
  { toolName: "Midjourney", vendor: "Midjourney", category: "Image Generation", endpoint: "www.midjourney.com", riskLevel: "medium", riskRationale: "Consumer image generation; prompts publicly visible by default" },
  { toolName: "Stability AI API", vendor: "Stability AI", category: "Image Generation", endpoint: "api.stability.ai", riskLevel: "medium", riskRationale: "Image generation API; data handling depends on API tier" },
  { toolName: "ElevenLabs", vendor: "ElevenLabs", category: "Voice AI", endpoint: "api.elevenlabs.io", riskLevel: "high", riskRationale: "Voice cloning and synthesis; biometric voice data; high privacy risk" },

  // ── AI Search & Research ──
  { toolName: "You.com AI", vendor: "You.com", category: "AI Search", endpoint: "api.you.com", riskLevel: "low", riskRationale: "AI search API; query data may be used for model improvement" },
  { toolName: "Bing AI / Copilot", vendor: "Microsoft", category: "AI Search", endpoint: "www.bing.com", riskLevel: "low", riskRationale: "Consumer AI search; queries linked to Microsoft account" },

  // ── AI Agents & Automation ──
  { toolName: "LangChain Hub", vendor: "LangChain", category: "Agent Framework", endpoint: "api.hub.langchain.com", riskLevel: "medium", riskRationale: "LLM orchestration hub; agent prompts and chains may be shared publicly" },
  { toolName: "AutoGPT", vendor: "Significant Gravitas", category: "Autonomous Agent", endpoint: "agpt.co", riskLevel: "critical", riskRationale: "Autonomous AI agent; executes multi-step tasks with minimal oversight; high governance risk" },
  { toolName: "CrewAI", vendor: "CrewAI", category: "Multi-Agent Framework", endpoint: "api.crewai.com", riskLevel: "high", riskRationale: "Multi-agent orchestration; autonomous task execution; requires HITL governance" },
  { toolName: "n8n Cloud", vendor: "n8n", category: "AI Automation", endpoint: "app.n8n.cloud", riskLevel: "high", riskRationale: "Workflow automation with AI nodes; may process sensitive business data" },
  { toolName: "Zapier AI", vendor: "Zapier", category: "AI Automation", endpoint: "api.zapier.com", riskLevel: "medium", riskRationale: "Automation platform with AI features; data flows across multiple third-party services" },

  // ── AI Data & Analytics ──
  { toolName: "DataRobot", vendor: "DataRobot", category: "AutoML", endpoint: "app.datarobot.com", riskLevel: "high", riskRationale: "AutoML platform; training data uploaded to vendor cloud; data classification required" },
  { toolName: "H2O.ai", vendor: "H2O.ai", category: "AutoML", endpoint: "cloud.h2o.ai", riskLevel: "high", riskRationale: "AutoML platform; model training data may contain sensitive business information" },

  // ── AI Security Tools ──
  { toolName: "Darktrace", vendor: "Darktrace", category: "AI Security", endpoint: "api.darktrace.com", riskLevel: "medium", riskRationale: "AI security monitoring; network traffic metadata sent to Darktrace cloud" },
  { toolName: "Vectra AI", vendor: "Vectra AI", category: "AI Security", endpoint: "api.vectra.ai", riskLevel: "medium", riskRationale: "AI threat detection; network telemetry processed externally" },

  // ── OpenRouter (multi-model gateway) ──
  { toolName: "OpenRouter", vendor: "OpenRouter", category: "LLM Gateway", endpoint: "openrouter.ai", riskLevel: "high", riskRationale: "Multi-model LLM gateway; routes prompts to various providers; data handling varies by model" },
];

// ─── Endpoint Probe ────────────────────────────────────────────────────────────

export interface ProbeResult {
  entry: AiServiceEntry;
  reachable: boolean;
  responseTimeMs?: number;
  httpStatus?: number;
  error?: string;
}

/**
 * Probe a single AI service endpoint via DNS resolution + HTTP HEAD request.
 * Uses a short timeout so the scan completes in reasonable time.
 */
export async function probeEndpoint(entry: AiServiceEntry, timeoutMs = 4000): Promise<ProbeResult> {
  const url = `https://${entry.endpoint}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "AegisDiscovery/1.0 (governance-scanner)" },
    });
    clearTimeout(timer);
    return {
      entry,
      reachable: true,
      responseTimeMs: Date.now() - start,
      httpStatus: res.status,
    };
  } catch (err: unknown) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : String(err);
    // AbortError means timeout — endpoint exists but didn't respond in time
    const reachable = msg.includes("aborted") || msg.includes("ECONNREFUSED") === false;
    return { entry, reachable, error: msg };
  }
}

/**
 * Run endpoint probes for all catalogue entries in parallel (batched to avoid
 * overwhelming the network).
 */
export async function runEndpointProbe(
  registeredEndpoints: string[] = [],
  batchSize = 10
): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];
  for (let i = 0; i < AI_SERVICE_CATALOGUE.length; i += batchSize) {
    const batch = AI_SERVICE_CATALOGUE.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((e) => probeEndpoint(e)));
    results.push(...batchResults);
  }
  // Filter: only return reachable endpoints that are NOT already in the registered list
  return results.filter(
    (r) => r.reachable && !registeredEndpoints.some((ep) => ep.toLowerCase().includes(r.entry.endpoint.toLowerCase()))
  );
}

// ─── Log Analysis ──────────────────────────────────────────────────────────────

export interface LogFinding {
  toolName: string;
  vendor: string;
  category: string;
  endpoint?: string;
  evidence: string;
  confidence: "low" | "medium" | "high";
  riskLevel: "low" | "medium" | "high" | "critical";
  riskRationale: string;
}

/**
 * Use the LLM to extract AI tool references from a block of log text
 * (DNS query logs, proxy access logs, browser history exports, etc.).
 */
export async function analyseLogText(logText: string): Promise<LogFinding[]> {
  const catalogueSummary = AI_SERVICE_CATALOGUE.map(
    (e) => `${e.toolName} (${e.vendor}) — ${e.endpoint}`
  ).join("\n");

  const prompt = `You are an AI governance security analyst. Analyse the following log text and identify any references to AI tools, AI API endpoints, AI SaaS services, or AI-related domains.

Known AI services to look for (but also identify any others not in this list):
${catalogueSummary}

Log text to analyse:
---
${logText.slice(0, 8000)}
---

Return a JSON object with a single key "findings" whose value is an array. Each finding must have these fields:
- toolName: string (name of the AI tool or service)
- vendor: string (vendor/provider name)
- category: string (e.g. "LLM", "Code Assistant", "Image Generation", "Autonomous Agent", etc.)
- endpoint: string or null (domain/hostname if identifiable)
- evidence: string (the specific log line or snippet that triggered this finding, max 200 chars)
- confidence: "low" | "medium" | "high"
- riskLevel: "low" | "medium" | "high" | "critical"
- riskRationale: string (1-2 sentences explaining the governance risk)

If no AI tools are found, return {"findings": []}.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are an AI governance security analyst. Return only valid JSON matching the requested schema." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "log_analysis_result",
          strict: true,
          schema: {
            type: "object",
            properties: {
              findings: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    toolName: { type: "string" },
                    vendor: { type: "string" },
                    category: { type: "string" },
                    endpoint: { type: "string" },
                    evidence: { type: "string" },
                    confidence: { type: "string", enum: ["low", "medium", "high"] },
                    riskLevel: { type: "string", enum: ["low", "medium", "high", "critical"] },
                    riskRationale: { type: "string" },
                  },
                  required: ["toolName", "vendor", "category", "endpoint", "evidence", "confidence", "riskLevel", "riskRationale"],
                  additionalProperties: false,
                },
              },
            },
            required: ["findings"],
            additionalProperties: false,
          },
        },
      },
    });

    const raw = response?.choices?.[0]?.message?.content;
    if (!raw || typeof raw !== "string") {
      throw new Error("LLM returned no content for log analysis");
    }
    let parsed: { findings: LogFinding[] };
    try {
      parsed = JSON.parse(raw) as { findings: LogFinding[] };
    } catch {
      throw new Error(`LLM returned invalid JSON: ${raw.slice(0, 200)}`);
    }
    if (!Array.isArray(parsed.findings)) {
      throw new Error("LLM response missing 'findings' array");
    }
    return parsed.findings.slice(0, 50); // cap at 50 findings per scan
  } catch (err: unknown) {
    // Re-throw so the calling procedure can record the error in the scan record
    throw err;
  }
}

// ─── Audit Fingerprinting ──────────────────────────────────────────────────────

export interface AuditFinding {
  toolName: string;
  vendor: string;
  category: string;
  endpoint: string;
  evidence: string;
  confidence: "low" | "medium" | "high";
  riskLevel: "low" | "medium" | "high" | "critical";
  riskRationale: string;
}

// Build a lookup map from endpoint domain → catalogue entry for fast matching
const ENDPOINT_MAP = new Map<string, AiServiceEntry>();
for (const entry of AI_SERVICE_CATALOGUE) {
  ENDPOINT_MAP.set(entry.endpoint.toLowerCase(), entry);
  // Also index the root domain (e.g. "openai.com" from "api.openai.com")
  const parts = entry.endpoint.split(".");
  if (parts.length > 2) {
    const root = parts.slice(-2).join(".");
    if (!ENDPOINT_MAP.has(root)) ENDPOINT_MAP.set(root, entry);
  }
}

/**
 * Scan a set of audit log summaries/details for references to known AI endpoints
 * that are not attributed to any registered agent.
 */
export function fingerprintAuditLogs(
  logSummaries: string[],
  registeredAgentNames: string[]
): AuditFinding[] {
  const findings: AuditFinding[] = [];
  // Deduplicate by endpoint so that shared endpoints (e.g. api.openai.com) only
  // produce one finding — the first catalogue entry that maps to that endpoint.
  const seen = new Set<string>();

  for (const summary of logSummaries) {
    const lower = summary.toLowerCase();

    // Check if this log is already attributed to a known registered agent
    const isAttributed = registeredAgentNames.some((name) =>
      lower.includes(name.toLowerCase())
    );
    if (isAttributed) continue;

    // Scan for known AI endpoint patterns in the log text
    for (const [domain, entry] of Array.from(ENDPOINT_MAP.entries())) {
      if (lower.includes(domain) && !seen.has(entry.endpoint)) {
        seen.add(entry.endpoint);
        findings.push({
          toolName: entry.toolName,
          vendor: entry.vendor,
          category: entry.category,
          endpoint: entry.endpoint,
          evidence: summary.slice(0, 200),
          confidence: "medium",
          riskLevel: entry.riskLevel,
          riskRationale: entry.riskRationale,
        });
      }
    }
  }

  return findings;
}
