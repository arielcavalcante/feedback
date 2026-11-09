ALTER TABLE `feedback_submissions` ADD `is_signed` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `feedback_submissions` ADD `signed_at` text;