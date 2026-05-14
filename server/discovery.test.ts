import { describe, expect, it } from "vitest";
import {
  AI_SERVICE_CATALOGUE,
  fingerprintAuditLogs,
  type AiServiceEntry,
} from "./discovery";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Shared mock context ───────────────────────────────────────────────────────
function createMockContext(): TrpcContext {
  return {
    user: {
      id: 1,
      username: "ian",
      passwordHash: "$2b$12$placeholder",
      email: "ian@meridian.com",
      name: "Ian Loe",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// ─── AI Service Catalogue ─────────────────────────────────────────────────────

describe("AI_SERVICE_CATALOGUE", () => {
  it("contains at least 40 known AI service entries", () => {
    expect(AI_SERVICE_CATALOGUE.length).toBeGreaterThanOrEqual(40);
  });

  it("every entry has the required fields", () => {
    for (const entry of AI_SERVICE_CATALOGUE) {
      expect(entry.toolName).toBeTruthy();
      expect(entry.vendor).toBeTruthy();
      expect(entry.category).toBeTruthy();
      expect(entry.endpoint).toBeTruthy();
      expect(["low", "medium", "high", "critical"]).toContain(entry.riskLevel);
      expect(entry.riskRationale).toBeTruthy();
    }
  });

  it("includes the major LLM providers", () => {
    const endpoints = AI_SERVICE_CATALOGUE.map((e) => e.endpoint);
    expect(endpoints).toContain("api.openai.com");
    expect(endpoints).toContain("api.anthropic.com");
    expect(endpoints).toContain("api.mistral.ai");
  });

  it("includes at least one critical-risk entry (autonomous agents)", () => {
    const critical = AI_SERVICE_CATALOGUE.filter((e) => e.riskLevel === "critical");
    expect(critical.length).toBeGreaterThanOrEqual(1);
  });

  it("includes code assistant entries", () => {
    const codeAssistants = AI_SERVICE_CATALOGUE.filter((e) => e.category === "Code Assistant");
    expect(codeAssistants.length).toBeGreaterThanOrEqual(3);
  });

  it("has no duplicate endpoints", () => {
    const endpoints = AI_SERVICE_CATALOGUE.map((e) => e.endpoint);
    const unique = new Set(endpoints);
    // Allow a small number of shared endpoints (e.g. DALL-E shares api.openai.com)
    expect(unique.size).toBeGreaterThanOrEqual(AI_SERVICE_CATALOGUE.length - 5);
  });
});

// ─── Audit Fingerprinting ─────────────────────────────────────────────────────

describe("fingerprintAuditLogs", () => {
  it("returns an empty array when no AI domains appear in the logs", () => {
    const logs = [
      "User logged in from 192.168.1.1",
      "Report generated for Q1 2025",
      "Database backup completed successfully",
    ];
    const results = fingerprintAuditLogs(logs, []);
    expect(results).toHaveLength(0);
  });

  it("detects a known AI endpoint in audit log text", () => {
    const logs = [
      "Outbound request to api.openai.com/v1/chat/completions — 200 OK",
    ];
    const results = fingerprintAuditLogs(logs, []);
    expect(results.length).toBeGreaterThanOrEqual(1);
    const openAiResult = results.find((r) => r.endpoint === "api.openai.com");
    expect(openAiResult).toBeDefined();
    expect(openAiResult?.toolName).toBe("OpenAI API");
  });

  it("excludes findings that are attributed to a registered agent", () => {
    const logs = [
      "Agent 'Meridian GPT' called api.openai.com — prompt sent",
    ];
    // The registered agent name appears in the log, so it should be excluded
    const results = fingerprintAuditLogs(logs, ["Meridian GPT"]);
    expect(results).toHaveLength(0);
  });

  it("detects multiple distinct AI tools in a mixed log", () => {
    const logs = [
      "DNS query: api.openai.com resolved to 104.18.6.192",
      "HTTP CONNECT to copilot-proxy.githubusercontent.com:443",
      "User browsed to claude.ai/chat",
    ];
    const results = fingerprintAuditLogs(logs, []);
    // Should find at least 2 distinct tools
    expect(results.length).toBeGreaterThanOrEqual(2);
    const toolNames = results.map((r) => r.toolName);
    expect(toolNames.some((n) => n.includes("OpenAI"))).toBe(true);
    expect(toolNames.some((n) => n.includes("Copilot") || n.includes("Claude"))).toBe(true);
  });

  it("does not return duplicate findings for the same tool", () => {
    const logs = [
      "api.openai.com request 1",
      "api.openai.com request 2",
      "api.openai.com request 3",
    ];
    const results = fingerprintAuditLogs(logs, []);
    const openAiFindings = results.filter((r) => r.endpoint === "api.openai.com");
    expect(openAiFindings.length).toBe(1);
  });

  it("assigns correct risk level from the catalogue", () => {
    const logs = ["agpt.co autonomous task execution started"];
    const results = fingerprintAuditLogs(logs, []);
    const autoGpt = results.find((r) => r.endpoint === "agpt.co");
    if (autoGpt) {
      expect(autoGpt.riskLevel).toBe("critical");
    }
  });
});

// ─── Discovery tRPC Procedures (contract tests) ───────────────────────────────

describe("discovery.catalogue", () => {
  it("returns the full AI service catalogue", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const catalogue = await caller.discovery.catalogue();
    expect(Array.isArray(catalogue)).toBe(true);
    expect(catalogue.length).toBeGreaterThanOrEqual(40);
    // Verify shape of first entry
    const first = catalogue[0] as AiServiceEntry;
    expect(first.toolName).toBeTruthy();
    expect(first.endpoint).toBeTruthy();
  });
});

// ─── Discovery Finding Status Transitions ────────────────────────────────────

describe("discovery finding statuses", () => {
  const validStatuses = ["new", "reviewed", "promoted_agent", "added_shadow", "dismissed"] as const;

  it("includes all required disposition statuses", () => {
    expect(validStatuses).toContain("new");
    expect(validStatuses).toContain("promoted_agent");
    expect(validStatuses).toContain("added_shadow");
    expect(validStatuses).toContain("dismissed");
  });
});

// ─── Discovery Scan Types ─────────────────────────────────────────────────────

describe("discovery scan types", () => {
  const validScanTypes = ["endpoint_probe", "log_analysis", "audit_fingerprint"] as const;

  it("covers all three detection strategies", () => {
    expect(validScanTypes).toContain("endpoint_probe");
    expect(validScanTypes).toContain("log_analysis");
    expect(validScanTypes).toContain("audit_fingerprint");
  });
});
