CREATE TABLE `auth_rate_limits` (
	`key_hash` text NOT NULL,
	`action` text NOT NULL,
	`window_started_at` text NOT NULL,
	`attempts` integer NOT NULL,
	`blocked_until` text,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`key_hash`, `action`)
);
--> statement-breakpoint
CREATE INDEX `auth_rate_limits_cleanup_idx` ON `auth_rate_limits` (`updated_at`);