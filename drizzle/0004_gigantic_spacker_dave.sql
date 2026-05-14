CREATE TABLE `discovery_findings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`scanId` int NOT NULL,
	`toolName` varchar(255) NOT NULL,
	`vendor` varchar(128),
	`category` varchar(128),
	`endpoint` varchar(512),
	`detectionMethod` enum('dns_probe','http_probe','log_pattern','audit_pattern','llm_extraction') NOT NULL,
	`confidence` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`evidence` text,
	`riskLevel` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`riskRationale` text,
	`status` enum('new','reviewed','promoted_agent','added_shadow','dismissed') NOT NULL DEFAULT 'new',
	`promotedAgentId` int,
	`shadowToolId` int,
	`reviewedBy` varchar(255),
	`reviewNote` text,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `discovery_findings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `discovery_scans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`scanType` enum('endpoint_probe','log_analysis','audit_fingerprint') NOT NULL,
	`status` enum('running','completed','failed') NOT NULL DEFAULT 'running',
	`triggeredBy` varchar(255),
	`inputSummary` text,
	`findingsCount` int DEFAULT 0,
	`durationMs` int,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `discovery_scans_id` PRIMARY KEY(`id`)
);
