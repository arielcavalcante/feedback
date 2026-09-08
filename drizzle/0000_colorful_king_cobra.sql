CREATE TABLE `account_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email_snapshot` text NOT NULL,
	`token_digest` text NOT NULL,
	`expires_at` text NOT NULL,
	`accepted_at` text,
	`revoked_at` text,
	`created_by_user_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_invitations_token_unique` ON `account_invitations` (`token_digest`);--> statement-breakpoint
CREATE INDEX `account_invitations_user_active_idx` ON `account_invitations` (`user_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `action_items` (
	`id` text PRIMARY KEY NOT NULL,
	`meeting_id` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`due_at` text,
	`status` text NOT NULL,
	`visibility` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`occurred_at` text NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text,
	`outcome` text NOT NULL,
	`reason_code` text,
	`request_id` text,
	`metadata_json` text,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_logs_occurred_idx` ON `audit_logs` (`occurred_at`);--> statement-breakpoint
CREATE TABLE `auth_credentials` (
	`user_id` text PRIMARY KEY NOT NULL,
	`password_hash` text NOT NULL,
	`password_changed_at` text NOT NULL,
	`must_change_password` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_digest` text NOT NULL,
	`created_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`idle_expires_at` text NOT NULL,
	`revoked_at` text,
	`replaced_by_session_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_sessions_token_unique` ON `auth_sessions` (`token_digest`);--> statement-breakpoint
CREATE INDEX `auth_sessions_user_active_idx` ON `auth_sessions` (`user_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `email_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`job_type` text NOT NULL,
	`cycle_id` text,
	`recipient_user_id` text NOT NULL,
	`scheduled_for` text NOT NULL,
	`status` text NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`idempotency_key` text NOT NULL,
	`provider_message_id` text,
	`last_error_code` text,
	`last_error_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`sent_at` text,
	FOREIGN KEY (`cycle_id`) REFERENCES `feedback_cycles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipient_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_jobs_idempotency_unique` ON `email_jobs` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `email_jobs_due_idx` ON `email_jobs` (`status`,`scheduled_for`);--> statement-breakpoint
CREATE TABLE `feedback_answer_topics` (
	`feedback_answer_id` text NOT NULL,
	`topic_id` text NOT NULL,
	PRIMARY KEY(`feedback_answer_id`, `topic_id`),
	FOREIGN KEY (`feedback_answer_id`) REFERENCES `feedback_answers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `feedback_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`dimension` text NOT NULL,
	`question_key` text NOT NULL,
	`numeric_value` integer,
	`text_value` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `feedback_submissions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `feedback_answers_submission_idx` ON `feedback_answers` (`submission_id`);--> statement-breakpoint
CREATE TABLE `feedback_cycle_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`cycle_id` text NOT NULL,
	`employee_user_id` text NOT NULL,
	`team_id` text NOT NULL,
	`coordinator_user_id` text NOT NULL,
	`eligibility_status` text NOT NULL,
	`exclusion_reason` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`cycle_id`) REFERENCES `feedback_cycles`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`employee_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`coordinator_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feedback_cycle_participant_unique` ON `feedback_cycle_participants` (`cycle_id`,`employee_user_id`,`team_id`);--> statement-breakpoint
CREATE TABLE `feedback_cycles` (
	`id` text PRIMARY KEY NOT NULL,
	`schedule_id` text NOT NULL,
	`sequence_number` integer NOT NULL,
	`opens_at` text NOT NULL,
	`closes_at` text NOT NULL,
	`report_at` text NOT NULL,
	`employee_email_at` text NOT NULL,
	`coordinator_email_at` text NOT NULL,
	`status` text NOT NULL,
	`anonymity_threshold_snapshot` integer NOT NULL,
	`created_at` text NOT NULL,
	`opened_at` text,
	`closed_at` text,
	`reported_at` text,
	FOREIGN KEY (`schedule_id`) REFERENCES `feedback_schedules`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feedback_cycles_schedule_sequence_unique` ON `feedback_cycles` (`schedule_id`,`sequence_number`);--> statement-breakpoint
CREATE INDEX `feedback_cycles_due_idx` ON `feedback_cycles` (`status`,`opens_at`,`closes_at`,`report_at`);--> statement-breakpoint
CREATE TABLE `feedback_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`timezone` text DEFAULT 'America/Fortaleza' NOT NULL,
	`anchor_open_local_date` text NOT NULL,
	`interval_days` integer DEFAULT 14 NOT NULL,
	`open_local_time` text DEFAULT '09:00:00' NOT NULL,
	`close_local_time` text DEFAULT '23:59:59' NOT NULL,
	`report_local_time` text DEFAULT '09:00:00' NOT NULL,
	`anonymity_threshold` integer DEFAULT 3 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `feedback_schedules_active_idx` ON `feedback_schedules` (`is_active`);--> statement-breakpoint
CREATE TABLE `feedback_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`cycle_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`submitted_at` text NOT NULL,
	`state` text NOT NULL,
	`schema_version` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`cycle_id`) REFERENCES `feedback_cycles`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`participant_id`) REFERENCES `feedback_cycle_participants`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feedback_submissions_participant_unique` ON `feedback_submissions` (`participant_id`);--> statement-breakpoint
CREATE TABLE `holidays` (
	`local_date` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`scope` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `meeting_assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`meeting_id` text NOT NULL,
	`dimension_key` text NOT NULL,
	`rating` integer NOT NULL,
	`note` text,
	`visibility` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `meeting_outcomes` (
	`id` text PRIMARY KEY NOT NULL,
	`meeting_id` text NOT NULL,
	`kind` text NOT NULL,
	`content` text NOT NULL,
	`visibility` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `meetings` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_user_id` text NOT NULL,
	`coordinator_user_id` text NOT NULL,
	`team_id` text,
	`scheduled_for` text NOT NULL,
	`held_at` text,
	`status` text NOT NULL,
	`context_summary` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`employee_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`coordinator_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `password_reset_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_digest` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`revoked_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `password_reset_tokens_token_unique` ON `password_reset_tokens` (`token_digest`);--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `roles_key_unique` ON `roles` (`key`);--> statement-breakpoint
CREATE TABLE `team_coordinators` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text,
	`is_primary` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`created_by_user_id` text,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `team_coordinators_current_idx` ON `team_coordinators` (`team_id`,`ends_at`);--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text,
	`created_at` text NOT NULL,
	`created_by_user_id` text,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `team_members_current_idx` ON `team_members` (`team_id`,`ends_at`);--> statement-breakpoint
CREATE INDEX `team_members_user_idx` ON `team_members` (`user_id`,`ends_at`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `topics` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `topics_key_unique` ON `topics` (`key`);--> statement-breakpoint
CREATE TABLE `user_roles` (
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	`granted_at` text NOT NULL,
	`granted_by_user_id` text,
	`revoked_at` text,
	PRIMARY KEY(`user_id`, `role_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`granted_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deactivated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
--> statement-breakpoint
INSERT INTO `roles` (`id`, `key`, `name`, `description`) VALUES
  ('role-admin', 'admin', 'Administrator', 'Manages users, roles, teams, and configuration.'),
  ('role-coordinator', 'coordinator', 'Coordinator', 'Views privacy-safe team feedback and manages meetings.'),
  ('role-employee', 'employee', 'Employee', 'Submits feedback and views participation and meeting outcomes.');
--> statement-breakpoint
INSERT INTO `feedback_schedules`
  (`id`, `name`, `timezone`, `anchor_open_local_date`, `interval_days`, `open_local_time`, `close_local_time`, `report_local_time`, `anonymity_threshold`, `is_active`, `created_at`, `updated_at`)
VALUES
  ('default-fortaleza-biweekly', 'Fortaleza biweekly feedback', 'America/Fortaleza', '2026-09-18', 14, '09:00:00', '23:59:59', '09:00:00', 3, 1, '2026-09-08T00:00:00.000Z', '2026-09-08T00:00:00.000Z');
--> statement-breakpoint
INSERT INTO `holidays` (`local_date`, `name`, `scope`, `created_at`) VALUES
  ('2026-10-12', 'Nossa Senhora Aparecida', 'national', '2026-09-08T00:00:00.000Z'),
  ('2026-11-02', 'Finados', 'national', '2026-09-08T00:00:00.000Z'),
  ('2026-11-15', 'Proclamação da República', 'national', '2026-09-08T00:00:00.000Z'),
  ('2026-11-20', 'Dia Nacional de Zumbi e da Consciência Negra', 'national', '2026-09-08T00:00:00.000Z'),
  ('2026-12-25', 'Natal', 'national', '2026-09-08T00:00:00.000Z');
