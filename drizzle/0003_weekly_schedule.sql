-- ADR-026: weekly cycles open all week (Monday 00:00 → Sunday 23:59:59 America/Fortaleza), report Monday 09:00.
-- A new schedule row keeps sequence numbers unique; the biweekly one is retired and its future cycles cancelled.
INSERT INTO `feedback_schedules`
  (`id`, `name`, `timezone`, `anchor_open_local_date`, `interval_days`, `open_local_time`, `close_local_time`, `report_local_time`, `anonymity_threshold`, `is_active`, `created_at`, `updated_at`)
VALUES
  ('default-fortaleza-weekly', 'Fortaleza weekly feedback', 'America/Fortaleza', '2026-11-09', 7, '00:00:00', '23:59:59', '09:00:00', 3, 1, '2026-11-09T00:00:00.000Z', '2026-11-09T00:00:00.000Z')
ON CONFLICT(`id`) DO NOTHING;
--> statement-breakpoint
UPDATE `feedback_schedules` SET `is_active` = 0, `updated_at` = '2026-11-09T00:00:00.000Z' WHERE `id` = 'default-fortaleza-biweekly';
--> statement-breakpoint
UPDATE `feedback_cycles` SET `status` = 'cancelled' WHERE `schedule_id` = 'default-fortaleza-biweekly' AND `status` = 'scheduled';
