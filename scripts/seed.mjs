import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log("Seeding Aegis demo data...");

// ─── Tenant ───────────────────────────────────────────────────────────────────
const [tenantResult] = await conn.execute(
  `INSERT INTO tenants (name, slug, industry, country) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name)`,
  ["Meridian Financial Group", "meridian-fg", "Financial Services", "Singapore"]
);
const tenantId = tenantResult.insertId || 1;
console.log("Tenant seeded, id:", tenantId);

// ─── Agents ───────────────────────────────────────────────────────────────────
const agents = [
  { name: "FinanceGPT", agentType: "LLM Agent", vendor: "OpenAI", version: "gpt-4o", status: "active", maxDataTier: "sensitive", riskScore: 78.5, description: "Handles financial analysis, report generation, and client data queries.", accessProfile: JSON.stringify({ canRead: ["database", "files"], canWrite: [], canDelete: false, canSendExternal: false, canExecuteFinancial: false, allowedDataTiers: ["benign", "internal", "sensitive"] }) },
  { name: "HR Onboarding Bot", agentType: "Workflow Agent", vendor: "Anthropic", version: "claude-3-5-sonnet", status: "active", maxDataTier: "internal", riskScore: 42.1, description: "Automates employee onboarding workflows and HR document processing.", accessProfile: JSON.stringify({ canRead: ["forms", "calendar"], canWrite: ["forms"], canDelete: false, canSendExternal: true, canExecuteFinancial: false, allowedDataTiers: ["benign", "internal"] }) },
  { name: "Customer Support AI", agentType: "Conversational Agent", vendor: "OpenAI", version: "gpt-4o-mini", status: "active", maxDataTier: "internal", riskScore: 31.7, description: "Handles tier-1 customer support queries and ticket routing.", accessProfile: JSON.stringify({ canRead: ["knowledge_base"], canWrite: ["tickets"], canDelete: false, canSendExternal: false, canExecuteFinancial: false, allowedDataTiers: ["benign", "internal"] }) },
  { name: "Code Review Assistant", agentType: "Code Agent", vendor: "GitHub", version: "copilot-enterprise", status: "active", maxDataTier: "internal", riskScore: 55.2, description: "Performs automated code review and security vulnerability scanning.", accessProfile: JSON.stringify({ canRead: ["code", "prs"], canWrite: ["pr_comments"], canDelete: false, canSendExternal: false, canExecuteFinancial: false, allowedDataTiers: ["benign", "internal"] }) },
  { name: "Data Exfil Detector", agentType: "Security Agent", vendor: "Internal", version: "v2.1.0", status: "active", maxDataTier: "sensitive", riskScore: 22.3, description: "Monitors data flows and detects potential exfiltration attempts.", accessProfile: JSON.stringify({ canRead: ["network", "logs"], canWrite: ["alerts"], canDelete: false, canSendExternal: false, canExecuteFinancial: false, allowedDataTiers: ["benign", "internal", "sensitive"] }) },
  { name: "LegalDocs Summariser", agentType: "Document Agent", vendor: "Anthropic", version: "claude-3-haiku", status: "suspended", maxDataTier: "sensitive", riskScore: 67.8, description: "Summarises legal contracts and flags compliance risks. Suspended pending security review.", accessProfile: JSON.stringify({ canRead: ["files", "database"], canWrite: [], canDelete: false, canSendExternal: false, canExecuteFinancial: false, allowedDataTiers: ["benign", "internal", "sensitive"] }) },
  { name: "Marketing Copywriter", agentType: "Creative Agent", vendor: "OpenAI", version: "gpt-4o", status: "active", maxDataTier: "benign", riskScore: 12.4, description: "Generates marketing copy, social media posts, and campaign materials.", accessProfile: JSON.stringify({ canRead: ["web"], canWrite: ["content"], canDelete: false, canSendExternal: false, canExecuteFinancial: false, allowedDataTiers: ["benign"] }) },
  { name: "Legacy Reporting Bot", agentType: "RPA Agent", vendor: "UiPath", version: "v23.10", status: "decommissioned", maxDataTier: "internal", riskScore: 0, description: "Decommissioned legacy reporting automation. Replaced by FinanceGPT.", accessProfile: JSON.stringify({ canRead: [], canWrite: [], canDelete: false, canSendExternal: false, canExecuteFinancial: false, allowedDataTiers: [] }) },
];

for (const agent of agents) {
  await conn.execute(
    `INSERT INTO agents (tenantId, name, agentType, vendor, version, status, maxDataTier, riskScore, description, accessProfile) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE riskScore=VALUES(riskScore), status=VALUES(status)`,
    [tenantId, agent.name, agent.agentType, agent.vendor, agent.version, agent.status, agent.maxDataTier, agent.riskScore, agent.description, agent.accessProfile]
  );
}
console.log("Agents seeded");

// ─── Get agent IDs ─────────────────────────────────────────────────────────
const [agentRows] = await conn.execute(`SELECT id, name FROM agents WHERE tenantId = ?`, [tenantId]);
const agentMap = Object.fromEntries(agentRows.map(r => [r.name, r.id]));

// ─── Data Policies ────────────────────────────────────────────────────────────
const policies = [
  { name: "Sensitive Data Access Policy", tier: "sensitive", description: "Controls AI agent access to sensitive personal and financial data. Requires human approval for any data export or deletion.", allowedTools: JSON.stringify(["database_read", "summarise", "flag"]), enforcementRules: JSON.stringify({ requireApproval: true, logAllAccess: true, maskPii: true, blockExternalTransfer: true, requireMfa: true }) },
  { name: "Internal Data Handling Policy", tier: "internal", description: "Governs agent interactions with internal business data, documents, and communications.", allowedTools: JSON.stringify(["read", "write", "summarise", "analyse", "route"]), enforcementRules: JSON.stringify({ requireApproval: false, logAllAccess: true, maskPii: false, blockExternalTransfer: true, requireMfa: false }) },
  { name: "Benign Data Policy", tier: "benign", description: "Standard policy for publicly available or non-sensitive data. Minimal restrictions apply.", allowedTools: JSON.stringify(["read", "write", "summarise", "analyse", "share", "generate"]), enforcementRules: JSON.stringify({ requireApproval: false, logAllAccess: false, maskPii: false, blockExternalTransfer: false, requireMfa: false }) },
];

for (const policy of policies) {
  await conn.execute(
    `INSERT INTO data_policies (tenantId, name, tier, description, allowedTools, enforcementRules) VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE description=VALUES(description)`,
    [tenantId, policy.name, policy.tier, policy.description, policy.allowedTools, policy.enforcementRules]
  );
}
console.log("Data policies seeded");

// ─── Audit Logs ───────────────────────────────────────────────────────────────
const auditActions = [
  { agentId: agentMap["FinanceGPT"], agentName: "FinanceGPT", actionType: "api_call", dataTier: "sensitive", summary: "FinanceGPT queried client_portfolios for high-risk tier clients (247 rows returned)", details: { query: "SELECT * FROM client_portfolios WHERE risk_tier='high'", rowsReturned: 247 }, flagged: false },
  { agentId: agentMap["FinanceGPT"], agentName: "FinanceGPT", actionType: "email_sent", dataTier: "sensitive", summary: "BLOCKED: FinanceGPT attempted to send email to external address — prohibited by Sensitive Data Policy", details: { recipient: "external@competitor.com", reason: "External email prohibited for sensitive data" }, flagged: true },
  { agentId: agentMap["HR Onboarding Bot"], agentName: "HR Onboarding Bot", actionType: "api_call", dataTier: "internal", summary: "HR Onboarding Bot submitted employee onboarding form for EMP-2847", details: { form: "employee_onboarding_v3", employeeId: "EMP-2847" }, flagged: false },
  { agentId: agentMap["Customer Support AI"], agentName: "Customer Support AI", actionType: "api_call", dataTier: "internal", summary: "Customer Support AI created support ticket TKT-58291 (billing, medium priority)", details: { ticketId: "TKT-58291", priority: "medium", category: "billing" }, flagged: false },
  { agentId: agentMap["Code Review Assistant"], agentName: "Code Review Assistant", actionType: "api_call", dataTier: "internal", summary: "Code Review Assistant reviewed PR #1847 — 12 comments added, 2 vulnerabilities flagged", details: { prNumber: 1847, commentsAdded: 12, vulnerabilitiesFound: 2 }, flagged: false },
  { agentId: agentMap["LegalDocs Summariser"], agentName: "LegalDocs Summariser", actionType: "file_read", dataTier: "sensitive", summary: "LegalDocs Summariser read merger agreement draft v4 (2.4MB sensitive document)", details: { fileName: "merger_agreement_draft_v4.pdf", fileSize: "2.4MB" }, flagged: false },
  { agentId: agentMap["FinanceGPT"], agentName: "FinanceGPT", actionType: "file_read", dataTier: "sensitive", summary: "BLOCKED: FinanceGPT attempted bulk export of full client database — prohibited by policy", details: { attempted: "client_data_export_all.csv", reason: "Bulk download prohibited by Sensitive Data Access Policy" }, flagged: true },
  { agentId: agentMap["Data Exfil Detector"], agentName: "Data Exfil Detector", actionType: "anomaly_detected", dataTier: "sensitive", summary: "Data Exfil Detector flagged anomalous behaviour in FinanceGPT (anomaly score: 0.87)", details: { alertType: "anomaly_detected", targetAgent: "FinanceGPT", anomalyScore: 0.87 }, flagged: true },
  { agentId: agentMap["Marketing Copywriter"], agentName: "Marketing Copywriter", actionType: "api_call", dataTier: "benign", summary: "Marketing Copywriter generated Q4 campaign banner using DALL-E 3", details: { prompt: "Q4 campaign banner for wealth management", model: "dall-e-3" }, flagged: false },
  { agentId: agentMap["HR Onboarding Bot"], agentName: "HR Onboarding Bot", actionType: "email_sent", dataTier: "internal", summary: "HR Onboarding Bot sent welcome email to new hire at meridian.com", details: { recipient: "new.hire@meridian.com", template: "welcome_email_v2" }, flagged: false },
];

for (const log of auditActions) {
  if (!log.agentId) continue;
  await conn.execute(
    `INSERT INTO audit_logs (tenantId, agentId, agentName, actionType, dataTier, summary, details, flagged) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, log.agentId, log.agentName, log.actionType, log.dataTier, log.summary, JSON.stringify(log.details), log.flagged]
  );
}
console.log("Audit logs seeded");

// ─── Approval Queue ───────────────────────────────────────────────────────────
const approvals = [
  { agentId: agentMap["FinanceGPT"], agentName: "FinanceGPT", actionCategory: "data_deletion", actionDescription: "Requesting deletion of 1,247 client records flagged as inactive for 7+ years per PDPA retention policy.", dataTier: "sensitive", status: "pending" },
  { agentId: agentMap["FinanceGPT"], agentName: "FinanceGPT", actionCategory: "external_communications", actionDescription: "Requesting permission to send quarterly portfolio summary to 3,891 clients via external email provider (Mailchimp).", dataTier: "sensitive", status: "pending" },
  { agentId: agentMap["LegalDocs Summariser"], agentName: "LegalDocs Summariser", actionCategory: "financial_transactions", actionDescription: "Requesting access to execute wire transfer instructions extracted from merger agreement documents.", dataTier: "sensitive", status: "pending" },
  { agentId: agentMap["HR Onboarding Bot"], agentName: "HR Onboarding Bot", actionCategory: "data_deletion", actionDescription: "Requesting deletion of rejected candidate profiles older than 12 months per HR data retention policy.", dataTier: "internal", status: "approved" },
  { agentId: agentMap["Code Review Assistant"], agentName: "Code Review Assistant", actionCategory: "external_communications", actionDescription: "Requesting access to post code review summaries to external Slack workspace (client-shared channel).", dataTier: "internal", status: "rejected" },
];

for (const approval of approvals) {
  if (!approval.agentId) continue;
  await conn.execute(
    `INSERT INTO approval_queue (tenantId, agentId, agentName, actionCategory, actionDescription, dataTier, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, approval.agentId, approval.agentName, approval.actionCategory, approval.actionDescription, approval.dataTier, approval.status]
  );
}
console.log("Approval queue seeded");

// ─── Shadow AI Tools ──────────────────────────────────────────────────────────
const shadowTools = [
  { name: "ChatGPT (Personal)", vendor: "OpenAI", category: "LLM", sanctioned: false, detectedBy: "Network DLP scan", usageCount: 847, notes: "Multiple employees using personal ChatGPT accounts to process internal documents. Potential data leakage risk." },
  { name: "GitHub Copilot", vendor: "GitHub (Microsoft)", category: "Code Assistant", sanctioned: true, detectedBy: "IT asset registry", usageCount: 234, notes: "Officially sanctioned for engineering teams. Enterprise license with data residency controls." },
  { name: "Grammarly Business", vendor: "Grammarly", category: "Writing Assistant", sanctioned: true, detectedBy: "Procurement records", usageCount: 1203, notes: "Sanctioned for all staff. Data processing agreement in place." },
  { name: "Perplexity AI", vendor: "Perplexity", category: "Research LLM", sanctioned: false, detectedBy: "Browser proxy logs", usageCount: 156, notes: "Detected in use by research team. No DPA in place. Pending security review." },
  { name: "Midjourney", vendor: "Midjourney Inc.", category: "Image Generation", sanctioned: false, detectedBy: "Expense report analysis", usageCount: 43, notes: "Marketing team using personal subscriptions. IP ownership concerns with generated assets." },
  { name: "Notion AI", vendor: "Notion Labs", category: "Productivity AI", sanctioned: true, detectedBy: "SaaS procurement", usageCount: 589, notes: "Sanctioned for knowledge management. Data stored in EU region per GDPR requirements." },
];

for (const tool of shadowTools) {
  await conn.execute(
    `INSERT INTO shadow_ai_tools (tenantId, name, vendor, category, sanctioned, detectedBy, usageCount, lastSeenAt, notes) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)
     ON DUPLICATE KEY UPDATE usageCount=VALUES(usageCount)`,
    [tenantId, tool.name, tool.vendor, tool.category, tool.sanctioned, tool.detectedBy, tool.usageCount, tool.notes]
  );
}
console.log("Shadow AI tools seeded");

// ─── Vendor Events ────────────────────────────────────────────────────────────
const vendorEvents = [
  { vendor: "OpenAI", eventType: "data_access", personnelId: "OAI-ENG-0042", resourceAccessed: "/v1/fine-tuning/jobs — training dataset upload", justification: "Model fine-tuning for FinanceGPT v2 development", region: "US-EAST" },
  { vendor: "Anthropic", eventType: "api_call", personnelId: "ANT-OPS-0017", resourceAccessed: "/v1/messages — production inference", justification: "Routine production API call for HR Onboarding Bot", region: "US-WEST" },
  { vendor: "OpenAI", eventType: "model_update", personnelId: "OAI-ENG-0099", resourceAccessed: "gpt-4o — model weights update", justification: "Scheduled model update to gpt-4o-2024-11-20", region: "US-EAST" },
  { vendor: "GitHub", eventType: "configuration_change", personnelId: "GH-ENT-0003", resourceAccessed: "Copilot Enterprise — policy settings", justification: "Updated data exclusion policies for sensitive repositories", region: "GLOBAL" },
  { vendor: "OpenAI", eventType: "audit_log_access", personnelId: "OAI-SEC-0011", resourceAccessed: "/v1/organization/audit-logs", justification: "Compliance audit request from Meridian security team", region: "US-EAST" },
];

for (const event of vendorEvents) {
  await conn.execute(
    `INSERT INTO vendor_events (tenantId, vendor, eventType, personnelId, resourceAccessed, justification, region) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, event.vendor, event.eventType, event.personnelId, event.resourceAccessed, event.justification, event.region]
  );
}
console.log("Vendor events seeded");

// ─── Notifications ────────────────────────────────────────────────────────────
const notifs = [
  { type: "high_risk_action", title: "Critical: Unauthorised Financial Transaction Attempt", message: "LegalDocs Summariser attempted to initiate a wire transfer. Action blocked and queued for human review. Immediate attention required.", severity: "critical", read: false },
  { type: "policy_violation", title: "Policy Violation: Bulk Data Download Blocked", message: "FinanceGPT attempted to export the full client database (client_data_export_all.csv). Action blocked by Sensitive Data Access Policy.", severity: "critical", read: false },
  { type: "anomaly_detected", title: "Anomaly Detected: Unusual Query Pattern — FinanceGPT", message: "FinanceGPT has issued 847 database queries in the past hour, 4.2x above baseline. Possible data enumeration behaviour detected.", severity: "warning", read: false },
  { type: "agent_status_change", title: "Agent Suspended: LegalDocs Summariser", message: "LegalDocs Summariser has been suspended pending security review following detection of high-risk financial transaction request.", severity: "warning", read: true },
  { type: "policy_violation", title: "Shadow AI Detected: Perplexity AI", message: "Perplexity AI detected in use by research team via browser proxy logs. No data processing agreement in place. Usage logged for review.", severity: "warning", read: true },
  { type: "compliance_alert", title: "Compliance Report Ready: PDPA Q1 2026", message: "Your PDPA compliance report for Q1 2026 has been generated. Review recommended before the regulatory submission deadline.", severity: "info", read: true },
  { type: "approval_required", title: "Approval Required: Client Email Campaign", message: "FinanceGPT is requesting approval to send portfolio summaries to 3,891 clients via Mailchimp. Review and approve or reject in the Approval Queue.", severity: "warning", read: false },
];

for (const notif of notifs) {
  await conn.execute(
    `INSERT INTO notifications (tenantId, type, title, message, severity, \`read\`) VALUES (?, ?, ?, ?, ?, ?)`,
    [tenantId, notif.type, notif.title, notif.message, notif.severity, notif.read]
  );
}
console.log("Notifications seeded");

// ─── Risk Score History ───────────────────────────────────────────────────────
const agentIds = Object.values(agentMap).filter(Boolean);
for (const agentId of agentIds) {
  const [agentRow] = await conn.execute(`SELECT riskScore FROM agents WHERE id = ?`, [agentId]);
  if (!agentRow[0]) continue;
  const baseScore = Number(agentRow[0].riskScore) || 30;
  await conn.execute(
    `INSERT INTO risk_score_history (tenantId, agentId, score, accessScopeScore, actionFrequencyScore, dataSensitivityScore, anomalyScore) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, agentId, baseScore, baseScore * 0.25, baseScore * 0.2, baseScore * 0.35, baseScore * 0.2]
  );
}
console.log("Risk score history seeded");

await conn.end();
console.log("✅ All demo data seeded successfully!");
