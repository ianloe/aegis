import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { SESSION_COOKIE, signSession } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  adminResetPassword,
  countUsers,
  getUserById,
  createAgent,
  createApprovalRequest,
  createAuditLog,
  createComplianceReport,
  createDataPolicy,
  createNotification,
  createUser,
  createVendorEvent,
  ensureTenantMember,
  getAgentById,
  getAgents,
  getApprovalQueue,
  getAuditLogs,
  getComplianceReports,
  getDashboardStats,
  getDataPolicies,
  getLlmAnalyses,
  getNotifications,
  getOrCreateDefaultTenant,
  getRiskScoreHistory,
  getShadowAiTools,
  getUserByUsername,
  getVendorEvents,
  markAllNotificationsRead,
  markNotificationRead,
  reviewApprovalRequest,
  sanctionTool,
  saveLlmAnalysis,
  saveRiskScore,
  updateAgentRiskScore,
  updateAgentStatus,
  updateComplianceReport,
  updateDataPolicy,
  updateUserLastSignedIn,
  updateUserRole,
  deleteUser,
  getAllUsers,
  upsertShadowAiTool,
} from "./db";
import { storagePut } from "./storage";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getTenantId(userId: number): Promise<number> {
  const tenant = await getOrCreateDefaultTenant();
  if (!tenant) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not resolve tenant" });
  await ensureTenantMember(userId, tenant.id);
  return tenant.id;
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => {
      if (!opts.ctx.user) return null;
      const { passwordHash: _ph, ...safe } = opts.ctx.user;
      return safe;
    }),

    register: publicProcedure
      .input(z.object({
        username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_.-]+$/, "Username may only contain letters, numbers, underscores, dots and hyphens"),
        password: z.string().min(8, "Password must be at least 8 characters"),
        name: z.string().min(1).max(128).optional(),
        email: z.string().email().optional(),
        inviteCode: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // First user becomes admin automatically; subsequent users require an invite code
        const existingCount = await countUsers();
        const isFirstUser = existingCount === 0;
        const INVITE_CODE = process.env.INVITE_CODE;
        if (!isFirstUser && INVITE_CODE && input.inviteCode !== INVITE_CODE) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Invalid invite code" });
        }
        const existing = await getUserByUsername(input.username);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "Username already taken" });
        const passwordHash = await bcrypt.hash(input.password, 12);
        const user = await createUser({
          username: input.username,
          passwordHash,
          name: input.name,
          email: input.email,
          role: isFirstUser ? "admin" : "user",
        });
        const token = await signSession(user.id, user.username);
        const isSecure = ctx.req.protocol === "https" || (ctx.req.headers["x-forwarded-proto"] === "https");
        ctx.res.cookie(SESSION_COOKIE, token, {
          httpOnly: true,
          secure: isSecure,
          sameSite: isSecure ? "none" : "lax",
          maxAge: 365 * 24 * 60 * 60 * 1000,
          path: "/",
        });
        const { passwordHash: _ph, ...safe } = user;
        return { user: safe, isFirstUser };
      }),

    login: publicProcedure
      .input(z.object({
        username: z.string(),
        password: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByUsername(input.username);
        if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid username or password" });
        const valid = await bcrypt.compare(input.password, user.passwordHash);
        if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid username or password" });
        await updateUserLastSignedIn(user.id);
        const token = await signSession(user.id, user.username);
        const isSecure = ctx.req.protocol === "https" || (ctx.req.headers["x-forwarded-proto"] === "https");
        ctx.res.cookie(SESSION_COOKIE, token, {
          httpOnly: true,
          secure: isSecure,
          sameSite: isSecure ? "none" : "lax",
          maxAge: 365 * 24 * 60 * 60 * 1000,
          path: "/",
        });
        const { passwordHash: _ph, ...safe } = user;
        return { user: safe };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(SESSION_COOKIE, { path: "/", httpOnly: true });
      return { success: true } as const;
    }),
  }),

  // ─── Dashboard ──────────────────────────────────────────────────────────────
  dashboard: router({
    stats: protectedProcedure.query(async ({ ctx }) => {
      const tenantId = await getTenantId(ctx.user.id);
      return getDashboardStats(tenantId);
    }),
  }),

  // ─── Agents ─────────────────────────────────────────────────────────────────
  agents: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const tenantId = await getTenantId(ctx.user.id);
      return getAgents(tenantId);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        const agent = await getAgentById(input.id, tenantId);
        if (!agent) throw new TRPCError({ code: "NOT_FOUND" });
        return agent;
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        agentType: z.string().optional(),
        vendor: z.string().optional(),
        version: z.string().optional(),
        owner: z.string().optional(),
        maxDataTier: z.enum(["benign", "internal", "sensitive"]).default("benign"),
        accessProfile: z.object({
          canRead: z.array(z.string()).default([]),
          canWrite: z.array(z.string()).default([]),
          canDelete: z.boolean().default(false),
          canSendExternal: z.boolean().default(false),
          canExecuteFinancial: z.boolean().default(false),
          allowedDataTiers: z.array(z.enum(["benign", "internal", "sensitive"])).default(["benign"]),
        }).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        const agent = await createAgent({ ...input, tenantId, status: "active" });
        await createAuditLog({
          tenantId,
          agentId: agent?.id,
          agentName: input.name,
          userName: ctx.user.name ?? "Unknown",
          actionType: "agent_registered",
          summary: `Agent "${input.name}" registered`,
          dataTier: input.maxDataTier,
        });
        return agent;
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["active", "suspended", "decommissioned"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        await updateAgentStatus(input.id, tenantId, input.status);
        const actionType = input.status === "suspended" ? "agent_suspended" : input.status === "decommissioned" ? "agent_decommissioned" : "agent_registered";
        await createAuditLog({
          tenantId,
          agentId: input.id,
          userName: ctx.user.name ?? "Unknown",
          actionType,
          summary: `Agent status changed to ${input.status}`,
        });
        await createNotification({
          tenantId,
          type: "agent_status_change",
          title: `Agent status updated`,
          message: `An agent's status was changed to "${input.status}"`,
          severity: input.status === "decommissioned" ? "warning" : "info",
          relatedEntityType: "agent",
          relatedEntityId: input.id,
        });
        return { success: true };
      }),
  }),

  // ─── Data Policies ───────────────────────────────────────────────────────────
  policies: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const tenantId = await getTenantId(ctx.user.id);
      return getDataPolicies(tenantId);
    }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        tier: z.enum(["benign", "internal", "sensitive"]),
        description: z.string().optional(),
        allowedTools: z.array(z.string()).optional(),
        enforcementRules: z.object({
          requireApproval: z.boolean().default(false),
          logAllAccess: z.boolean().default(true),
          maskPii: z.boolean().default(false),
          blockExternalTransfer: z.boolean().default(false),
          requireMfa: z.boolean().default(false),
        }).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        const policy = await createDataPolicy({ ...input, tenantId });
        await createAuditLog({
          tenantId,
          userName: ctx.user.name ?? "Unknown",
          actionType: "policy_change",
          summary: `Data policy "${input.name}" created for tier: ${input.tier}`,
          dataTier: input.tier,
        });
        return policy;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        allowedTools: z.array(z.string()).optional(),
        enforcementRules: z.object({
          requireApproval: z.boolean(),
          logAllAccess: z.boolean(),
          maskPii: z.boolean(),
          blockExternalTransfer: z.boolean(),
          requireMfa: z.boolean(),
        }).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        const { id, ...data } = input;
        await updateDataPolicy(id, tenantId, data);
        return { success: true };
      }),
  }),

  // ─── Audit Logs ──────────────────────────────────────────────────────────────
  auditLogs: router({
    list: protectedProcedure
      .input(z.object({
        agentId: z.number().optional(),
        actionType: z.string().optional(),
        dataTier: z.string().optional(),
        search: z.string().optional(),
        flagged: z.boolean().optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      }))
      .query(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        return getAuditLogs(tenantId, input);
      }),

    ingest: protectedProcedure
      .input(z.object({
        agentId: z.number().optional(),
        agentName: z.string().optional(),
        actionType: z.enum([
          "prompt_sent", "response_received", "file_read", "file_write",
          "file_delete", "api_call", "email_sent", "financial_transaction",
          "login", "logout", "policy_change", "agent_registered",
          "agent_suspended", "agent_decommissioned", "approval_requested",
          "approval_granted", "approval_rejected", "anomaly_detected",
        ]),
        dataTier: z.enum(["benign", "internal", "sensitive"]).optional(),
        summary: z.string(),
        details: z.record(z.string(), z.unknown()).optional(),
        ipAddress: z.string().optional(),
        flagged: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        await createAuditLog({ ...input, tenantId, userName: ctx.user.name ?? "Unknown" });
        return { success: true };
      }),

    export: protectedProcedure
      .input(z.object({ limit: z.number().default(500) }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        const { logs } = await getAuditLogs(tenantId, { limit: input.limit });
        const csv = [
          "id,timestamp,agent,user,actionType,dataTier,summary,flagged,entryHash",
          ...logs.map((l) =>
            `${l.id},${l.createdAt.toISOString()},${l.agentName ?? ""},${l.userName ?? ""},${l.actionType},${l.dataTier ?? ""},${JSON.stringify(l.summary)},${l.flagged},${l.entryHash ?? ""}`
          ),
        ].join("\n");
        const key = `exports/${tenantId}/audit-logs-${Date.now()}-${randomSuffix()}.csv`;
        const { url } = await storagePut(key, Buffer.from(csv), "text/csv");
        return { url, filename: `audit-logs-${new Date().toISOString().slice(0, 10)}.csv` };
      }),
  }),

  // ─── Approval Queue ──────────────────────────────────────────────────────────
  approvals: router({
    list: protectedProcedure
      .input(z.object({ status: z.enum(["pending", "approved", "rejected"]).optional() }))
      .query(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        return getApprovalQueue(tenantId, input.status);
      }),

    request: protectedProcedure
      .input(z.object({
        agentId: z.number(),
        agentName: z.string().optional(),
        actionCategory: z.enum(["data_deletion", "external_communications", "financial_transactions", "privilege_escalation", "bulk_export"]),
        actionDescription: z.string(),
        actionPayload: z.record(z.string(), z.unknown()).optional(),
        dataTier: z.enum(["benign", "internal", "sensitive"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        const item = await createApprovalRequest({
          ...input,
          tenantId,
          requestedBy: ctx.user.name ?? "Unknown",
          status: "pending",
        });
        await createAuditLog({
          tenantId,
          agentId: input.agentId,
          agentName: input.agentName,
          userName: ctx.user.name ?? "Unknown",
          actionType: "approval_requested",
          summary: `Approval requested for ${input.actionCategory}: ${input.actionDescription}`,
          dataTier: input.dataTier,
        });
        await createNotification({
          tenantId,
          type: "approval_required",
          title: "Approval Required",
          message: `High-risk action "${input.actionCategory}" requires admin approval`,
          severity: "warning",
          relatedEntityType: "approval",
          relatedEntityId: item?.id,
        });
        return item;
      }),

    review: protectedProcedure
      .input(z.object({
        id: z.number(),
        decision: z.enum(["approved", "rejected"]),
        note: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        await reviewApprovalRequest(input.id, tenantId, input.decision, ctx.user.name ?? "Unknown", input.note);
        await createAuditLog({
          tenantId,
          userName: ctx.user.name ?? "Unknown",
          actionType: input.decision === "approved" ? "approval_granted" : "approval_rejected",
          summary: `Approval request #${input.id} was ${input.decision}`,
        });
        return { success: true };
      }),
  }),

  // ─── Risk Scores ─────────────────────────────────────────────────────────────
  riskScores: router({
    history: protectedProcedure
      .input(z.object({ agentId: z.number().optional(), limit: z.number().default(30) }))
      .query(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        return getRiskScoreHistory(tenantId, input.agentId, input.limit);
      }),

    calculate: protectedProcedure
      .input(z.object({ agentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        const agent = await getAgentById(input.agentId, tenantId);
        if (!agent) throw new TRPCError({ code: "NOT_FOUND" });

        // Scoring algorithm
        const tierWeights = { benign: 10, internal: 40, sensitive: 80 };
        const dataSensitivityScore = tierWeights[agent.maxDataTier] ?? 10;
        const accessProfile = agent.accessProfile as Record<string, unknown> | null;
        const accessScopeScore = Math.min(100,
          (accessProfile?.canDelete ? 20 : 0) +
          (accessProfile?.canSendExternal ? 20 : 0) +
          (accessProfile?.canExecuteFinancial ? 30 : 0) +
          ((accessProfile?.canWrite as string[])?.length ?? 0) * 5 +
          ((accessProfile?.canRead as string[])?.length ?? 0) * 2
        );

        const { logs } = await getAuditLogs(tenantId, { agentId: input.agentId, limit: 100 });
        const flaggedCount = logs.filter((l) => l.flagged).length;
        const anomalyScore = Math.min(100, flaggedCount * 15);
        const actionFrequencyScore = Math.min(100, logs.length * 0.5);

        const totalScore = Math.min(100,
          dataSensitivityScore * 0.35 +
          accessScopeScore * 0.30 +
          anomalyScore * 0.25 +
          actionFrequencyScore * 0.10
        );

        const scoreStr = totalScore.toFixed(2);
        await saveRiskScore({
          tenantId,
          agentId: input.agentId,
          score: scoreStr,
          accessScopeScore: accessScopeScore.toFixed(2),
          actionFrequencyScore: actionFrequencyScore.toFixed(2),
          dataSensitivityScore: dataSensitivityScore.toFixed(2),
          anomalyScore: anomalyScore.toFixed(2),
          notes: `Auto-calculated from ${logs.length} log entries, ${flaggedCount} flagged`,
        });
        await updateAgentRiskScore(input.agentId, tenantId, scoreStr);

        if (totalScore >= 70) {
          await createNotification({
            tenantId,
            type: "high_risk_action",
            title: "High Risk Score Detected",
            message: `Agent "${agent.name}" has a risk score of ${scoreStr} — immediate review recommended`,
            severity: totalScore >= 85 ? "critical" : "warning",
            relatedEntityType: "agent",
            relatedEntityId: input.agentId,
          });
        }

        return { score: totalScore, accessScopeScore, actionFrequencyScore, dataSensitivityScore, anomalyScore };
      }),
  }),

  // ─── Shadow AI ───────────────────────────────────────────────────────────────
  shadowAi: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const tenantId = await getTenantId(ctx.user.id);
      return getShadowAiTools(tenantId);
    }),

    report: protectedProcedure
      .input(z.object({
        name: z.string(),
        vendor: z.string().optional(),
        category: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        await upsertShadowAiTool({
          ...input,
          tenantId,
          sanctioned: false,
          detectedBy: ctx.user.name ?? "Unknown",
          usageCount: 1,
          lastSeenAt: new Date(),
        });
        await createNotification({
          tenantId,
          type: "policy_violation",
          title: "Unsanctioned AI Tool Detected",
          message: `"${input.name}" by ${input.vendor ?? "unknown vendor"} was detected in use`,
          severity: "warning",
        });
        return { success: true };
      }),

    sanction: protectedProcedure
      .input(z.object({ id: z.number(), sanctioned: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        await sanctionTool(input.id, tenantId, input.sanctioned);
        return { success: true };
      }),
  }),

  // ─── Vendor Transparency ─────────────────────────────────────────────────────
  vendorTransparency: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().default(100) }))
      .query(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        return getVendorEvents(tenantId, input.limit);
      }),

    ingest: protectedProcedure
      .input(z.object({
        vendor: z.string(),
        eventType: z.string(),
        personnelId: z.string().optional(),
        resourceAccessed: z.string().optional(),
        justification: z.string().optional(),
        region: z.string().optional(),
        rawPayload: z.record(z.string(), z.unknown()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        await createVendorEvent({ ...input, tenantId });
        return { success: true };
      }),
  }),

  // ─── Compliance Reports ──────────────────────────────────────────────────────
  compliance: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const tenantId = await getTenantId(ctx.user.id);
      return getComplianceReports(tenantId);
    }),

    generate: protectedProcedure
      .input(z.object({
        framework: z.enum(["pdpa", "eu_ai_act", "mas"]),
        title: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        const agents = await getAgents(tenantId);
        const policies = await getDataPolicies(tenantId);
        const { logs } = await getAuditLogs(tenantId, { limit: 200 });
        const flaggedCount = logs.filter((l) => l.flagged).length;

        const frameworkLabels: Record<string, string> = {
          pdpa: "PDPA (Personal Data Protection Act)",
          eu_ai_act: "EU AI Act",
          mas: "MAS AI Governance Framework",
        };

        const checklistData = buildChecklist(input.framework, agents, policies, flaggedCount);
        const passCount = checklistData.filter((c: { passed: boolean }) => c.passed).length;
        const overallScore = ((passCount / checklistData.length) * 100).toFixed(2);

        const prompt = `You are an AI governance compliance expert. Generate a concise compliance assessment summary for the ${frameworkLabels[input.framework]} framework.

Organisation context:
- Total AI agents: ${agents.length} (${agents.filter((a) => a.status === "active").length} active)
- Data policies defined: ${policies.length}
- Audit log entries reviewed: ${logs.length}
- Flagged incidents: ${flaggedCount}
- Compliance score: ${overallScore}%

Checklist results:
${checklistData.map((c: { item: string; passed: boolean; note: string }) => `- [${c.passed ? "PASS" : "FAIL"}] ${c.item}: ${c.note}`).join("\n")}

Write a 3-4 paragraph executive summary covering: overall compliance posture, key gaps identified, risk areas, and recommended next steps. Use professional language suitable for a board-level audience.`;

        const llmResponse = await invokeLLM({
          messages: [
            { role: "system", content: "You are a senior AI governance and compliance advisor." },
            { role: "user", content: prompt },
          ],
        });

        const rawContent = llmResponse.choices[0]?.message?.content;
        const summary = typeof rawContent === "string" ? rawContent : "Summary unavailable.";
        const title = input.title ?? `${frameworkLabels[input.framework]} Assessment — ${new Date().toLocaleDateString("en-GB")}`;

        const report = await createComplianceReport({
          tenantId,
          framework: input.framework,
          title,
          status: "draft",
          overallScore,
          summary,
          checklistData,
          generatedBy: ctx.user.name ?? "Unknown",
        });

        return report;
      }),

    exportPdf: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        const reports = await getComplianceReports(tenantId);
        const report = reports.find((r) => r.id === input.id);
        if (!report) throw new TRPCError({ code: "NOT_FOUND" });

        const frameworkLabels: Record<string, string> = {
          pdpa: "PDPA (Personal Data Protection Act)",
          eu_ai_act: "EU AI Act",
          mas: "MAS AI Governance Framework",
        };

        const checklist = (report.checklistData as { item: string; passed: boolean; note: string }[]) ?? [];
        const markdown = `# ${report.title}\n\n**Framework:** ${frameworkLabels[report.framework] ?? report.framework}\n**Generated:** ${report.createdAt.toISOString().slice(0, 10)}\n**Overall Score:** ${report.overallScore}%\n**Status:** ${report.status}\n\n## Executive Summary\n\n${report.summary ?? "No summary available."}\n\n## Compliance Checklist\n\n${checklist.map((c) => `- [${c.passed ? "x" : " "}] **${c.item}** — ${c.note}`).join("\n")}\n`;

        const key = `reports/${tenantId}/compliance-${report.framework}-${Date.now()}-${randomSuffix()}.md`;
        const { url } = await storagePut(key, Buffer.from(markdown), "text/markdown");
        await updateComplianceReport(input.id, tenantId, { fileUrl: url, fileKey: key, status: "final" });

        return { url, filename: `${report.framework}-compliance-report.md` };
      }),
  }),

  // ─── Notifications ───────────────────────────────────────────────────────────
  notifications: router({
    list: protectedProcedure
      .input(z.object({ unreadOnly: z.boolean().default(false) }))
      .query(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        return getNotifications(tenantId, ctx.user.id, input.unreadOnly);
      }),

    markRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        await markNotificationRead(input.id, tenantId);
        return { success: true };
      }),

    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      const tenantId = await getTenantId(ctx.user.id);
      await markAllNotificationsRead(tenantId);
      return { success: true };
    }),
  }),

  // ─── LLM Analysis ────────────────────────────────────────────────────────────
  llmAnalysis: router({
    list: protectedProcedure
      .input(z.object({ agentId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        return getLlmAnalyses(tenantId, input.agentId);
      }),

    analyse: protectedProcedure
      .input(z.object({
        agentId: z.number().optional(),
        analysisType: z.enum(["log_analysis", "risk_summary", "anomaly_detection", "remediation_suggestion"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantId = await getTenantId(ctx.user.id);
        const { logs } = await getAuditLogs(tenantId, { agentId: input.agentId, limit: 100 });

        let agentName = "all agents";
        if (input.agentId) {
          const agent = await getAgentById(input.agentId, tenantId);
          agentName = agent?.name ?? `agent #${input.agentId}`;
        }

        const logSummary = logs.slice(0, 50).map((l) =>
          `[${l.createdAt.toISOString()}] ${l.actionType} | tier:${l.dataTier ?? "unknown"} | flagged:${l.flagged} | ${l.summary}`
        ).join("\n");

        const prompts: Record<string, string> = {
          log_analysis: `Analyse the following audit logs for ${agentName} and identify any suspicious patterns, policy violations, or anomalies. Provide a structured analysis with specific findings.\n\nLogs:\n${logSummary}`,
          risk_summary: `Based on the following audit logs for ${agentName}, generate a plain-English risk summary suitable for a security team. Highlight the top 3 risk areas and their potential impact.\n\nLogs:\n${logSummary}`,
          anomaly_detection: `Review these audit logs for ${agentName} and identify any anomalous behaviour patterns that deviate from expected usage. Flag specific entries that warrant investigation.\n\nLogs:\n${logSummary}`,
          remediation_suggestion: `Based on the policy violations and flagged entries in these audit logs for ${agentName}, suggest specific, actionable remediation steps. Prioritise by severity.\n\nLogs:\n${logSummary}`,
        };

        const llmResponse = await invokeLLM({
          messages: [
            { role: "system", content: "You are an expert AI security analyst specialising in AI governance, agent behaviour analysis, and compliance. Provide concise, actionable insights." },
            { role: "user", content: prompts[input.analysisType] },
          ],
        });

        const rawResult = llmResponse.choices[0]?.message?.content;
        const result = typeof rawResult === "string" ? rawResult : "Analysis unavailable.";
        const flaggedPatterns = logs.filter((l) => l.flagged).map((l) => l.summary);
        const analysis = await saveLlmAnalysis({
          tenantId,
          agentId: input.agentId,
          analysisType: input.analysisType,
          inputSummary: `${logs.length} log entries for ${agentName}`,
          result,
          flaggedPatterns,
          remediationActions: [],
        });

        if (flaggedPatterns.length > 0) {
          await createNotification({
            tenantId,
            type: "anomaly_detected",
            title: "LLM Analysis Flagged Issues",
            message: `AI analysis of ${agentName} detected ${flaggedPatterns.length} suspicious pattern(s)`,
            severity: "warning",
            relatedEntityType: "agent",
            relatedEntityId: input.agentId,
          });
        }

        return analysis;
      }),
  }),

  // ─── Admin User Management ────────────────────────────────────────────────
  adminUsers: router({
    list: adminProcedure.query(async () => {
      return getAllUsers();
    }),

    create: adminProcedure
      .input(z.object({
        username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_.-]+$/, "Username may only contain letters, numbers, underscores, dots and hyphens"),
        password: z.string().min(8, "Password must be at least 8 characters"),
        name: z.string().min(1).max(128).optional(),
        email: z.string().email().optional(),
        role: z.enum(["user", "admin"]).default("user"),
      }))
      .mutation(async ({ input }) => {
        const existing = await getUserByUsername(input.username);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "Username already taken" });
        const passwordHash = await bcrypt.hash(input.password, 12);
        const user = await createUser({
          username: input.username,
          passwordHash,
          name: input.name,
          email: input.email,
          role: input.role,
        });
        const { passwordHash: _ph, ...safe } = user as any;
        return safe;
      }),

    updateRole: adminProcedure
      .input(z.object({
        id: z.number(),
        role: z.enum(["user", "admin"]),
      }))
      .mutation(async ({ input, ctx }) => {
        if (input.id === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot change your own role" });
        await updateUserRole(input.id, input.role);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (input.id === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot delete your own account" });
        await deleteUser(input.id);
        return { success: true };
      }),

    resetPassword: adminProcedure
      .input(z.object({
        id: z.number(),
        newPassword: z.string().min(8, "Password must be at least 8 characters"),
      }))
      .mutation(async ({ input }) => {
        const passwordHash = await bcrypt.hash(input.newPassword, 12);
        await adminResetPassword(input.id, passwordHash);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;

// ─── Compliance Checklist Builder ─────────────────────────────────────────────

function buildChecklist(
  framework: string,
  agentList: { status: string; maxDataTier: string; accessProfile: unknown }[],
  policyList: { tier: string }[],
  flaggedCount: number
) {
  const hasDataPolicies = policyList.length >= 3;
  const hasSensitivePolicy = policyList.some((p) => p.tier === "sensitive");
  const allAgentsHaveProfiles = agentList.every((a) => a.accessProfile !== null);
  const noHighRiskActive = !agentList.some((a) => a.status === "active" && a.maxDataTier === "sensitive");
  const lowIncidentRate = flaggedCount < 5;

  const checklists: Record<string, { item: string; passed: boolean; note: string }[]> = {
    pdpa: [
      { item: "Data classification policy defined", passed: hasDataPolicies, note: hasDataPolicies ? "Three-tier policy in place" : "Requires at least 3 tier policies" },
      { item: "Sensitive data access controls", passed: hasSensitivePolicy, note: hasSensitivePolicy ? "Sensitive tier policy configured" : "No sensitive tier policy found" },
      { item: "Audit logging enabled", passed: true, note: "Audit trail active for all agents" },
      { item: "Data minimisation enforced", passed: allAgentsHaveProfiles, note: allAgentsHaveProfiles ? "All agents have access profiles" : "Some agents lack access profiles" },
      { item: "Incident response capability", passed: lowIncidentRate, note: lowIncidentRate ? `${flaggedCount} flagged incidents — within threshold` : `${flaggedCount} flagged incidents — review required` },
      { item: "Purpose limitation controls", passed: allAgentsHaveProfiles, note: "Access profiles define purpose boundaries" },
    ],
    eu_ai_act: [
      { item: "High-risk AI system registration", passed: agentList.length > 0, note: `${agentList.length} agents registered in registry` },
      { item: "Human oversight mechanisms", passed: true, note: "Human-in-the-loop approval queue active" },
      { item: "Transparency and explainability", passed: hasDataPolicies, note: hasDataPolicies ? "Data policies documented" : "Insufficient documentation" },
      { item: "Risk management system", passed: true, note: "Risk scoring engine operational" },
      { item: "Data governance framework", passed: hasSensitivePolicy, note: hasSensitivePolicy ? "Sensitive data governance in place" : "Sensitive data governance incomplete" },
      { item: "Conformity assessment completed", passed: lowIncidentRate, note: lowIncidentRate ? "Incident rate within acceptable limits" : "Elevated incident rate — assessment required" },
      { item: "Post-market monitoring", passed: true, note: "Continuous audit logging and anomaly detection active" },
    ],
    mas: [
      { item: "AI governance framework documented", passed: hasDataPolicies, note: hasDataPolicies ? "Governance policies in place" : "Framework documentation incomplete" },
      { item: "Model risk management", passed: allAgentsHaveProfiles, note: allAgentsHaveProfiles ? "All models have risk profiles" : "Incomplete model risk profiles" },
      { item: "Accountability and ownership", passed: agentList.every((a) => true), note: "Agent ownership tracked in registry" },
      { item: "Fairness and ethics review", passed: lowIncidentRate, note: lowIncidentRate ? "No significant bias incidents detected" : "Incidents require ethics review" },
      { item: "Explainability standards", passed: true, note: "Audit trail supports explainability requirements" },
      { item: "Vendor risk management", passed: true, note: "Vendor transparency events tracked" },
      { item: "Incident reporting capability", passed: true, note: "Notification and alerting system active" },
    ],
  };

  return checklists[framework] ?? [];
}
