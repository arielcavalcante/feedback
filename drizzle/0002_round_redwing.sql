CREATE TABLE `complaint_topics` (
	`complaint_id` text NOT NULL,
	`topic_key` text NOT NULL,
	PRIMARY KEY(`complaint_id`, `topic_key`),
	FOREIGN KEY (`complaint_id`) REFERENCES `complaints`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `complaints` (
	`id` text PRIMARY KEY NOT NULL,
	`author_user_id` text NOT NULL,
	`team_id` text NOT NULL,
	`coordinator_user_id` text NOT NULL,
	`week_start_local_date` text NOT NULL,
	`release_at` text NOT NULL,
	`body` text NOT NULL,
	`is_signed` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`coordinator_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `complaints_coordinator_week_idx` ON `complaints` (`coordinator_user_id`,`team_id`,`week_start_local_date`);