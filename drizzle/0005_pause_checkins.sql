CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by_user_id` text,
	FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
-- Owner decision (2026-11-10): ship with check-ins paused until an admin resumes them.
INSERT INTO `app_settings` (`key`, `value`, `updated_at`) VALUES ('checkins_paused', '1', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(`key`) DO UPDATE SET `value` = '1', `updated_at` = excluded.`updated_at`;
