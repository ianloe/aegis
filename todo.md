# Aegis — AI Governance & Safety Platform TODO

## Phase 2: Schema, Styles & Layout
- [x] Design and migrate full database schema (tenants, agents, policies, audit_logs, approval_queue, risk_scores, shadow_ai_tools, vendor_events, notifications)
- [x] Set up global CSS design tokens (dark theme, colour palette, typography, spacing)
- [x] Build DashboardLayout with sidebar navigation covering all 13 feature areas
- [x] Set up App.tsx routing for all pages

## Phase 3: Governance Dashboard & Agent Registry
- [x] Governance Dashboard — deployment health overview with risk score cards
- [x] Governance Dashboard — recent alerts panel
- [x] Governance Dashboard — compliance posture summary widget
- [x] Governance Dashboard — agent status distribution chart
- [x] Agent Registry — list view with lifecycle status badges (active, suspended, decommissioned)
- [x] Agent Registry — register new agent form (name, type, access profile, data tier, owner)
- [x] Agent Registry — agent detail view with access profile and risk score
- [x] Agent Registry — suspend / decommission lifecycle actions

## Phase 4: Data Classification & Audit Trail
- [x] Data Classification — three-tier policy management (Benign, Internal, Sensitive)
- [x] Data Classification — map AI tools to data tiers
- [x] Data Classification — technical enforcement rules per tier
- [x] Audit Trail — structured log viewer with search and filter
- [x] Audit Trail — filter by agent, user, action type, data classification
- [x] Audit Trail — tamper-evident log display with hash indicators
- [x] Audit Trail — export audit logs as downloadable file (stored in S3)

## Phase 5: Approval Queue & Risk Scoring
- [x] HITL Approval Queue — list of pending high-risk actions
- [x] HITL Approval Queue — action categories: data deletion, external communications, financial transactions
- [x] HITL Approval Queue — approve / reject workflow with reason field
- [x] HITL Approval Queue — approved/rejected history view
- [x] Risk Scoring Engine — per-agent score calculation (access scope, action frequency, data sensitivity, anomaly signals)
- [x] Risk Scoring Engine — score breakdown panel per agent
- [x] Risk Scoring Engine — risk trend chart over time

## Phase 6: Compliance, Shadow AI & Vendor Transparency
- [x] Compliance Reporting — PDPA, EU AI Act, MAS guidelines coverage
- [x] Compliance Reporting — exportable compliance checklist (stored in S3)
- [x] Compliance Reporting — report generation with LLM summary
- [x] Shadow AI Detection — sanctioned vs unsanctioned tool registry
- [x] Shadow AI Detection — flag unsanctioned tools in use
- [x] Vendor Transparency — vendor access event log viewer
- [x] Vendor Transparency — Access Transparency event ingestion endpoint

## Phase 7: Multi-Tenant RBAC, LLM Analysis, Notifications & Storage
- [x] Multi-Tenant support — tenant isolation in all queries
- [x] RBAC — three roles: admin, security analyst, viewer
- [x] RBAC — role-gated UI and API procedures
- [x] LLM Log Analysis — analyse agent logs and flag suspicious patterns
- [x] LLM Log Analysis — plain-English risk summary per agent
- [x] LLM Log Analysis — remediation suggestions for policy violations
- [x] Automated Notifications — in-app notifications for policy violations
- [x] Automated Notifications — high-risk action and anomaly alerts
- [x] Secure File Storage — compliance reports stored and served from S3
- [x] Secure File Storage — audit log exports stored and served from S3

## Phase 8: Polish, Demo Data & Tests
- [x] Seed realistic demo data for all entities (Meridian Financial Group tenant)
- [x] Write vitest tests for core procedures (13 tests passing)
- [x] Final UI polish pass — spacing, typography, colour consistency
- [x] Save checkpoint and deliver to user

## Self-Hosted Auth Replacement
- [x] Add passwordHash column to users table and generate migration SQL
- [x] Install bcryptjs for password hashing
- [x] Remove Manus OAuth routes and SDK from server/_core
- [x] Write new auth procedures: register, login, logout, me (username/password + JWT)
- [x] Build Login page (username/password form)
- [x] Build Register page (first-user / invite-only registration)
- [x] Update useAuth hook to use new auth procedures
- [x] Update AegisLayout and App.tsx to use new auth flow
- [x] Remove all Manus OAuth env vars from docker-compose.yml and env-template.txt
- [x] Update DEPLOY.md to reflect self-hosted auth
- [x] Update vitest tests for new auth procedures
- [x] Repackage zip for download

## Admin User Management
- [x] Add db helpers: getAllUsers, updateUserRole, deleteUser, adminResetPassword
- [x] Add tRPC procedures: users.list, users.create, users.updateRole, users.delete, users.resetPassword (all adminProcedure)
- [x] Build UserManagement page: table of users with role badge, create user modal, change role, delete, reset password
- [x] Add Users nav item to AegisLayout (admin-only visibility)
- [x] Wire /users route in App.tsx

## Bug Fixes
- [ ] Fix missing getAllUsers, updateUserRole, deleteUser, adminResetPassword functions in server/db.ts (causes "getAllUsers is not defined" error on User Management page)
