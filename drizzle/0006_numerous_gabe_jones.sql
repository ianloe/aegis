ALTER TABLE `agents` ADD `aaefProfile` varchar(32) DEFAULT 'default';--> statement-breakpoint
ALTER TABLE `agents` ADD `aaefWas` decimal(4,2);--> statement-breakpoint
ALTER TABLE `agents` ADD `aaefRating` enum('exemplary','proficient','developing','at_risk','unacceptable');--> statement-breakpoint
ALTER TABLE `agents` ADD `appraisalCadence` enum('tier1','tier2','tier3') DEFAULT 'tier2';--> statement-breakpoint
ALTER TABLE `agents` ADD `nextAppraisalDate` timestamp;--> statement-breakpoint
ALTER TABLE `agents` ADD `consecutiveLowWas` int DEFAULT 0;