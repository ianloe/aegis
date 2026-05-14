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
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
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
  // AAEF fields
  aaefProfile: varchar("aaefProfile", { length: 32 }).default("default"),
  aaefWas: decimal("aaefWas", { precision: 4, scale: 2 }),
  aaefRating: mysqlEnum("aaefRating", ["exemplary", "proficient", "developing", "at_risk", "unacceptable"]),
  appraisalCadence: mysqlEnum("appraisalCadence", ["tier1", "tier2", "tier3"]).default("tier2"),
  nextAppraisalDate: timestamp("nextAppraisalDate"),
  consecutiveLowWas: int("consecutiveLowWas").default(0),
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
    "agent_updated",
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

// ─── Discovery Scans ──────────────────────────────────────────────────────────

export const discoveryScans = mysqlTable("discovery_scans", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  scanType: mysqlEnum("scanType", [
    "endpoint_probe",   // DNS/HTTP probe of known AI service endpoints
    "log_analysis",     // LLM-assisted analysis of submitted log text
    "audit_fingerprint", // Cross-reference audit logs for unregistered AI API calls
  ]).notNull(),
  status: mysqlEnum("status", ["running", "completed", "failed"])
    .default("running")
    .notNull(),
  triggeredBy: varchar("triggeredBy", { length: 255 }),
  inputSummary: text("inputSummary"),   // e.g. log text submitted, or "50 endpoints probed"
  findingsCount: int("findingsCount").default(0),
  durationMs: int("durationMs"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type DiscoveryScan = typeof discoveryScans.$inferSelect;

// ─── Discovery Findings ───────────────────────────────────────────────────────

export const discoveryFindings = mysqlTable("discovery_findings", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  scanId: int("scanId").notNull(),
  // What was found
  toolName: varchar("toolName", { length: 255 }).notNull(),
  vendor: varchar("vendor", { length: 128 }),
  category: varchar("category", { length: 128 }),
  endpoint: varchar("endpoint", { length: 512 }),
  // How it was found
  detectionMethod: mysqlEnum("detectionMethod", [
    "dns_probe",
    "http_probe",
    "log_pattern",
    "audit_pattern",
    "llm_extraction",
  ]).notNull(),
  confidence: mysqlEnum("confidence", ["low", "medium", "high"]).default("medium").notNull(),
  evidence: text("evidence"),   // snippet or signal that triggered the finding
  // Risk assessment
  riskLevel: mysqlEnum("riskLevel", ["low", "medium", "high", "critical"])
    .default("medium")
    .notNull(),
  riskRationale: text("riskRationale"),
  // Disposition
  status: mysqlEnum("status", [
    "new",           // just found, awaiting review
    "reviewed",      // human has looked at it
    "promoted_agent", // promoted to registered agent
    "added_shadow",  // added to shadow AI registry
    "dismissed",     // dismissed as false positive or acceptable
  ]).default("new").notNull(),
  promotedAgentId: int("promotedAgentId"),   // set when promoted to agent
  shadowToolId: int("shadowToolId"),         // set when added to shadow AI
  reviewedBy: varchar("reviewedBy", { length: 255 }),
  reviewNote: text("reviewNote"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DiscoveryFinding = typeof discoveryFindings.$inferSelect;

// ─── AAEF: Agent Appraisal Framework ─────────────────────────────────────────
// Implements the AI Agent Evaluation Framework (AAEF) v1.0 by Ian Loe.
// Five evaluation dimensions, weighted aggregate scoring, performance profiles,
// appraisal records, improvement plans, and override conditions.

// Performance profile dimension weights (stored per tenant so custom profiles are supported)
export const aaefProfiles = mysqlTable("aaef_profiles", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  profileCode: varchar("profileCode", { length: 8 }).notNull(), // A, B, C, D, E, custom
  profileName: varchar("profileName", { length: 128 }).notNull(),
  description: text("description"),
  // Dimension weights — must sum to 1.0
  w1TaskCompletion: decimal("w1TaskCompletion", { precision: 4, scale: 3 }).notNull().default("0.25"),
  w2Judgement: decimal("w2Judgement", { precision: 4, scale: 3 }).notNull().default("0.25"),
  w3Escalation: decimal("w3Escalation", { precision: 4, scale: 3 }).notNull().default("0.20"),
  w4Compliance: decimal("w4Compliance", { precision: 4, scale: 3 }).notNull().default("0.20"),
  w5UserExperience: decimal("w5UserExperience", { precision: 4, scale: 3 }).notNull().default("0.10"),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AaefProfile = typeof aaefProfiles.$inferSelect;

// Formal appraisal records — one per review period per agent
export const aaefAppraisals = mysqlTable("aaef_appraisals", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  agentId: int("agentId").notNull(),
  profileId: int("profileId").notNull(), // which profile/weights were used
  // Review period
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),
  appraisalDate: timestamp("appraisalDate").notNull(),
  conductedBy: varchar("conductedBy", { length: 255 }).notNull(), // Domain Owner
  // Dimension scores (1–5)
  d1Score: int("d1Score").notNull(), // Task Completion and Accuracy
  d2Score: int("d2Score").notNull(), // Quality of Judgement
  d3Score: int("d3Score").notNull(), // Escalation Behaviour
  d4Score: int("d4Score").notNull(), // Process and Constraint Compliance
  d5Score: int("d5Score").notNull(), // User Experience and Trust
  // Scoring rationale per dimension
  d1Rationale: text("d1Rationale"),
  d2Rationale: text("d2Rationale"),
  d3Rationale: text("d3Rationale"),
  d4Rationale: text("d4Rationale"),
  d5Rationale: text("d5Rationale"),
  // Computed aggregate
  was: decimal("was", { precision: 4, scale: 2 }).notNull(), // Weighted Aggregate Score
  overallRating: mysqlEnum("overallRating", [
    "exemplary",    // 5 — WAS 4.5–5.0
    "proficient",   // 4 — WAS 3.5–4.4
    "developing",   // 3 — WAS 2.5–3.4
    "at_risk",      // 2 — WAS 1.5–2.4
    "unacceptable", // 1 — WAS 1.0–1.4
  ]).notNull(),
  // Override conditions (AAEF Section 03)
  overrideTriggered: boolean("overrideTriggered").default(false).notNull(),
  overrideReason: text("overrideReason"), // which override condition was triggered
  // Improvement plan status
  improvementPlanRequired: boolean("improvementPlanRequired").default(false).notNull(),
  // Pre-appraisal data summary
  quantitativeDataSummary: text("quantitativeDataSummary"),
  // Next appraisal date agreed at this meeting
  nextAppraisalDate: timestamp("nextAppraisalDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AaefAppraisal = typeof aaefAppraisals.$inferSelect;

// Improvement plan actions linked to an appraisal
export const aaefImprovementPlans = mysqlTable("aaef_improvement_plans", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  appraisalId: int("appraisalId").notNull(),
  agentId: int("agentId").notNull(),
  // Action details
  dimension: mysqlEnum("dimension", ["D1", "D2", "D3", "D4", "D5", "overall"]).notNull(),
  actionDescription: text("actionDescription").notNull(),
  rootCause: text("rootCause"),
  successCriteria: text("successCriteria"),
  // Ownership and timeline
  owner: varchar("owner", { length: 255 }).notNull(),
  dueDate: timestamp("dueDate").notNull(),
  checkInDate: timestamp("checkInDate"), // 15-day check-in for Developing; bi-weekly for At Risk
  // Status
  status: mysqlEnum("status", [
    "open",
    "in_progress",
    "completed",
    "overdue",
    "escalated",
  ]).default("open").notNull(),
  completedAt: timestamp("completedAt"),
  completionNote: text("completionNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AaefImprovementPlan = typeof aaefImprovementPlans.$inferSelect;

// ─── Pi-hole Connector Settings ───────────────────────────────────────────────

export const piholeSettings = mysqlTable("pihole_settings", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().unique(),
  url: varchar("url", { length: 512 }).notNull().default("http://10.0.5.24"),
  // Stored as bcrypt hash — never returned to the client
  appPassword: varchar("appPassword", { length: 512 }),
  enabled: boolean("enabled").default(false).notNull(),
  lastSyncedAt: timestamp("lastSyncedAt"),
  lastSyncStatus: varchar("lastSyncStatus", { length: 64 }),
  lastSyncCount: int("lastSyncCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PiholeSettings = typeof piholeSettings.$inferSelect;
