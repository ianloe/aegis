CREATE TABLE `pihole_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`url` varchar(512) NOT NULL DEFAULT 'http://10.0.5.24',
	`appPassword` varchar(512),
	`enabled` boolean NOT NULL DEFAULT false,
	`lastSyncedAt` timestamp,
	`lastSyncStatus` varchar(64),
	`lastSyncCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pihole_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `pihole_settings_tenantId_unique` UNIQUE(`tenantId`)
);
