import {
  bigint,
  boolean,
  decimal,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// ─── Core Users ───────────────────────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Tenants ──────────────────────────────────────────────────────────────────

export const tenants = mysqlTable("tenants", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  industry: varchar("industry", { length: 128 }),
  country: varchar("country", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Tenant = typeof tenants.$inferSelect;

// ─── Tenant Members ───────────────────────────────────────────────────────────

export const tenantMembers = mysqlTable("tenant_members", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  userId: int("userId").notNull(),
  tenantRole: mysqlEnum("tenantRole", ["admin", "security_analyst", "viewer"])
    .default("viewer")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TenantMember = typeof tenantMembers.$inferSelect;

// ─── AI Agents ────────────────────────────────────────────────────────────────

export const agents = mysqlTable("agents", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  agentType: varchar("agentType", { length: 128 }),
  vendor: varchar("vendor", { length: 128 }),
  version: varchar("version", { length: 64 }),
  owner: varchar("owner", { length: 255 }),
  status: mysqlEnum("status", ["active", "suspended", "decommissioned"])
    .default("active")
    .notNull(),
  // Least-privilege access profile
  accessProfile: json("accessProfile").$type<{
    canRead: string[];
    canWrite: string[];
    canDelete: boolean;
    canSendExternal: boolean;
    canExecuteFinancial: boolean;
    allowedDataTiers: ("benign" | "internal" | "sensitive")[];
  }>(),
  // Data sensitivity tier this agent is permitted to access
  maxDataTier: mysqlEnum("maxDataTier", ["benign", "internal", "sensitive"])
    .default("benign")
    .notNull(),
  riskScore: decimal("riskScore", { precision: 5, scale: 2 }).default("0"),
  apiKey: varchar("apiKey", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Agent = typeof agents.$inferSelect;

// ─── Data Classification Policies ─────────────────────────────────────────────

export const dataPolicies = mysqlTable("data_policies", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  tier: mysqlEnum("tier", ["benign", "internal", "sensitive"]).notNull(),
  description: text("description"),
  allowedTools: json("allowedTools").$type<string[]>(),
  enforcementRules: json("enforcementRules").$type<{
    requireApproval: boolean;
    logAllAccess: boolean;
    maskPii: boolean;
    blockExternalTransfer: boolean;
    requireMfa: boolean;
  }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DataPolicy = typeof dataPolicies.$inferSelect;

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const auditLogs = mysqlTable("audit_logs", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  agentId: int("agentId"),
  agentName: varchar("agentName", { length: 255 }),
  userId: int("userId"),
  userName: varchar("userName", { length: 255 }),
  actionType: mysqlEnum("actionType", [
    "prompt_sent",
    "response_received",
    "file_read",
    "file_write",
    "file_delete",
    "api_call",
    "email_sent",
    "financial_transaction",
    "login",
    "logout",
    "policy_change",
    "agent_registered",
    "agent_suspended",
    "agent_decommissioned",
    "approval_requested",
    "approval_granted",
    "approval_rejected",
    "anomaly_detected",
  ]).notNull(),
  dataTier: mysqlEnum("dataTier", ["benign", "internal", "sensitive"]),
  summary: text("summary").notNull(),
  details: json("details"),
  ipAddress: varchar("ipAddress", { length: 64 }),
  // Tamper-evident hash of the previous log entry
  prevHash: varchar("prevHash", { length: 64 }),
  entryHash: varchar("entryHash", { length: 64 }),
  flagged: boolean("flagged").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;

// ─── Approval Queue ───────────────────────────────────────────────────────────

export const approvalQueue = mysqlTable("approval_queue", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  agentId: int("agentId").notNull(),
  agentName: varchar("agentName", { length: 255 }),
  requestedBy: varchar("requestedBy", { length: 255 }),
  actionCategory: mysqlEnum("actionCategory", [
    "data_deletion",
    "external_communications",
    "financial_transactions",
    "privilege_escalation",
    "bulk_export",
  ]).notNull(),
  actionDescription: text("actionDescription").notNull(),
  actionPayload: json("actionPayload"),
  dataTier: mysqlEnum("dataTier", ["benign", "internal", "sensitive"]),
  status: mysqlEnum("status", ["pending", "approved", "rejected"])
    .default("pending")
    .notNull(),
  reviewedBy: varchar("reviewedBy", { length: 255 }),
  reviewNote: text("reviewNote"),
  reviewedAt: timestamp("reviewedAt"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ApprovalQueueItem = typeof approvalQueue.$inferSelect;

// ─── Risk Scores ──────────────────────────────────────────────────────────────

export const riskScoreHistory = mysqlTable("risk_score_history", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  agentId: int("agentId").notNull(),
  score: decimal("score", { precision: 5, scale: 2 }).notNull(),
  accessScopeScore: decimal("accessScopeScore", { precision: 5, scale: 2 }),
  actionFrequencyScore: decimal("actionFrequencyScore", { precision: 5, scale: 2 }),
  dataSensitivityScore: decimal("dataSensitivityScore", { precision: 5, scale: 2 }),
  anomalyScore: decimal("anomalyScore", { precision: 5, scale: 2 }),
  notes: text("notes"),
  calculatedAt: timestamp("calculatedAt").defaultNow().notNull(),
});

export type RiskScoreHistory = typeof riskScoreHistory.$inferSelect;

// ─── Shadow AI Tools ──────────────────────────────────────────────────────────

export const shadowAiTools = mysqlTable("shadow_ai_tools", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  vendor: varchar("vendor", { length: 128 }),
  category: varchar("category", { length: 128 }),
  sanctioned: boolean("sanctioned").default(false).notNull(),
  detectedAt: timestamp("detectedAt").defaultNow(),
  detectedBy: varchar("detectedBy", { length: 255 }),
  usageCount: int("usageCount").default(0),
  lastSeenAt: timestamp("lastSeenAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ShadowAiTool = typeof shadowAiTools.$inferSelect;

// ─── Vendor Transparency Events ───────────────────────────────────────────────

export const vendorEvents = mysqlTable("vendor_events", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  vendor: varchar("vendor", { length: 128 }).notNull(),
  eventType: varchar("eventType", { length: 128 }).notNull(),
  personnelId: varchar("personnelId", { length: 128 }),
  resourceAccessed: text("resourceAccessed"),
  justification: text("justification"),
  region: varchar("region", { length: 64 }),
  rawPayload: json("rawPayload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type VendorEvent = typeof vendorEvents.$inferSelect;

// ─── Compliance Reports ───────────────────────────────────────────────────────

export const complianceReports = mysqlTable("compliance_reports", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  framework: mysqlEnum("framework", ["pdpa", "eu_ai_act", "mas"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["draft", "final"]).default("draft").notNull(),
  overallScore: decimal("overallScore", { precision: 5, scale: 2 }),
  summary: text("summary"),
  checklistData: json("checklistData"),
  fileUrl: text("fileUrl"),
  fileKey: varchar("fileKey", { length: 512 }),
  generatedBy: varchar("generatedBy", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ComplianceReport = typeof complianceReports.$inferSelect;

// ─── Notifications ────────────────────────────────────────────────────────────

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  userId: int("userId"),
  type: mysqlEnum("type", [
    "policy_violation",
    "high_risk_action",
    "anomaly_detected",
    "approval_required",
    "agent_status_change",
    "compliance_alert",
  ]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  severity: mysqlEnum("severity", ["info", "warning", "critical"])
    .default("info")
    .notNull(),
  read: boolean("read").default(false).notNull(),
  relatedEntityType: varchar("relatedEntityType", { length: 64 }),
  relatedEntityId: int("relatedEntityId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;

// ─── LLM Analysis Results ─────────────────────────────────────────────────────

export const llmAnalyses = mysqlTable("llm_analyses", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  agentId: int("agentId"),
  analysisType: mysqlEnum("analysisType", [
    "log_analysis",
    "risk_summary",
    "anomaly_detection",
    "remediation_suggestion",
  ]).notNull(),
  inputSummary: text("inputSummary"),
  result: text("result").notNull(),
  flaggedPatterns: json("flaggedPatterns").$type<string[]>(),
  remediationActions: json("remediationActions").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LlmAnalysis = typeof llmAnalyses.$inferSelect;
