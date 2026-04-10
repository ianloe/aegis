CREATE TABLE `agents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`agentType` varchar(128),
	`vendor` varchar(128),
	`version` varchar(64),
	`owner` varchar(255),
	`status` enum('active','suspended','decommissioned') NOT NULL DEFAULT 'active',
	`accessProfile` json,
	`maxDataTier` enum('benign','internal','sensitive') NOT NULL DEFAULT 'benign',
	`riskScore` decimal(5,2) DEFAULT '0',
	`apiKey` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `approval_queue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`agentId` int NOT NULL,
	`agentName` varchar(255),
	`requestedBy` varchar(255),
	`actionCategory` enum('data_deletion','external_communications','financial_transactions','privilege_escalation','bulk_export') NOT NULL,
	`actionDescription` text NOT NULL,
	`actionPayload` json,
	`dataTier` enum('benign','internal','sensitive'),
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewedBy` varchar(255),
	`reviewNote` text,
	`reviewedAt` timestamp,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `approval_queue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`agentId` int,
	`agentName` varchar(255),
	`userId` int,
	`userName` varchar(255),
	`actionType` enum('prompt_sent','response_received','file_read','file_write','file_delete','api_call','email_sent','financial_transaction','login','logout','policy_change','agent_registered','agent_suspended','agent_decommissioned','approval_requested','approval_granted','approval_rejected','anomaly_detected') NOT NULL,
	`dataTier` enum('benign','internal','sensitive'),
	`summary` text NOT NULL,
	`details` json,
	`ipAddress` varchar(64),
	`prevHash` varchar(64),
	`entryHash` varchar(64),
	`flagged` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `compliance_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`framework` enum('pdpa','eu_ai_act','mas') NOT NULL,
	`title` varchar(255) NOT NULL,
	`status` enum('draft','final') NOT NULL DEFAULT 'draft',
	`overallScore` decimal(5,2),
	`summary` text,
	`checklistData` json,
	`fileUrl` text,
	`fileKey` varchar(512),
	`generatedBy` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `compliance_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `data_policies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`tier` enum('benign','internal','sensitive') NOT NULL,
	`description` text,
	`allowedTools` json,
	`enforcementRules` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `data_policies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `llm_analyses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`agentId` int,
	`analysisType` enum('log_analysis','risk_summary','anomaly_detection','remediation_suggestion') NOT NULL,
	`inputSummary` text,
	`result` text NOT NULL,
	`flaggedPatterns` json,
	`remediationActions` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `llm_analyses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`userId` int,
	`type` enum('policy_violation','high_risk_action','anomaly_detected','approval_required','agent_status_change','compliance_alert') NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`severity` enum('info','warning','critical') NOT NULL DEFAULT 'info',
	`read` boolean NOT NULL DEFAULT false,
	`relatedEntityType` varchar(64),
	`relatedEntityId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `risk_score_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`agentId` int NOT NULL,
	`score` decimal(5,2) NOT NULL,
	`accessScopeScore` decimal(5,2),
	`actionFrequencyScore` decimal(5,2),
	`dataSensitivityScore` decimal(5,2),
	`anomalyScore` decimal(5,2),
	`notes` text,
	`calculatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `risk_score_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shadow_ai_tools` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`vendor` varchar(128),
	`category` varchar(128),
	`sanctioned` boolean NOT NULL DEFAULT false,
	`detectedAt` timestamp DEFAULT (now()),
	`detectedBy` varchar(255),
	`usageCount` int DEFAULT 0,
	`lastSeenAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shadow_ai_tools_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tenant_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`userId` int NOT NULL,
	`tenantRole` enum('admin','security_analyst','viewer') NOT NULL DEFAULT 'viewer',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tenant_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(64) NOT NULL,
	`industry` varchar(128),
	`country` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenants_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenants_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `vendor_events` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`vendor` varchar(128) NOT NULL,
	`eventType` varchar(128) NOT NULL,
	`personnelId` varchar(128),
	`resourceAccessed` text,
	`justification` text,
	`region` varchar(64),
	`rawPayload` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vendor_events_id` PRIMARY KEY(`id`)
);
