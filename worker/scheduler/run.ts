import type { Env } from "../env";
import { cycleTiming, daysBetween, localDateInZone } from "../domain/schedule";
type ScheduleRow = { id: string; timezone: string; anchorOpenLocalDate: string; intervalDays: number; openLocalTime: string; closeLocalTime: string; reportLocalTime: string; anonymityThreshold: number };
export async function runScheduler(env: Env, now: Date): Promise<void> {
  const schedules = await env.DB.prepare(`SELECT id, timezone, anchor_open_local_date AS anchorOpenLocalDate, interval_days AS intervalDays, open_local_time AS openLocalTime, close_local_time AS closeLocalTime, report_local_time AS reportLocalTime, anonymity_threshold AS anonymityThreshold FROM feedback_schedules WHERE is_active = 1`).all<ScheduleRow>();
  const holidays = new Set((await env.DB.prepare("SELECT local_date AS localDate FROM holidays").all<{ localDate: string }>()).results.map((row) => row.localDate));
  for (const schedule of schedules.results) { const elapsedDays = daysBetween(schedule.anchorOpenLocalDate, localDateInZone(now, schedule.timezone)); const currentSequence = Math.max(0, Math.floor(elapsedDays / schedule.intervalDays)); for (const sequence of new Set([currentSequence, currentSequence + 1])) await ensureCycle(env, schedule, sequence, holidays); await transitionDueCycles(env, schedule.id, now.toISOString()); }
}
async function ensureCycle(env: Env, schedule: ScheduleRow, sequence: number, holidays: ReadonlySet<string>): Promise<void> { const timing = cycleTiming(schedule, sequence, holidays); await env.DB.prepare(`INSERT INTO feedback_cycles (id, schedule_id, sequence_number, opens_at, closes_at, report_at, employee_email_at, coordinator_email_at, status, anonymity_threshold_snapshot, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?) ON CONFLICT(schedule_id, sequence_number) DO NOTHING`).bind(crypto.randomUUID(), schedule.id, sequence, timing.opensAt, timing.closesAt, timing.reportAt, timing.employeeEmailAt, timing.coordinatorEmailAt, schedule.anonymityThreshold, new Date().toISOString()).run(); }
async function transitionDueCycles(env: Env, scheduleId: string, now: string): Promise<void> { await env.DB.batch([env.DB.prepare("UPDATE feedback_cycles SET status = 'open', opened_at = ? WHERE schedule_id = ? AND status = 'scheduled' AND opens_at <= ? AND closes_at > ?").bind(now, scheduleId, now, now), snapshotParticipants(env, scheduleId, now), env.DB.prepare("UPDATE feedback_cycles SET status = 'closed', closed_at = ? WHERE schedule_id = ? AND status = 'open' AND closes_at <= ?").bind(now, scheduleId, now), env.DB.prepare("UPDATE feedback_cycles SET status = 'reported', reported_at = ? WHERE schedule_id = ? AND status = 'closed' AND report_at <= ?").bind(now, scheduleId, now)]); }

/**
 * Participants of open cycles (idempotent, runs on every scheduler tick): active employees with a current
 * membership in an active team that has a coordinator. Cycles are open all week, so someone who joins a team
 * mid-week is added to that week's cycle; nobody is ever added twice to the same cycle, and existing
 * participants keep their original team/coordinator snapshot (ADR-026).
 */
export function snapshotParticipants(env: Env, scheduleId: string, now: string): D1PreparedStatement {
  return env.DB.prepare(`INSERT INTO feedback_cycle_participants (id, cycle_id, employee_user_id, team_id, coordinator_user_id, eligibility_status, created_at)
    SELECT lower(hex(randomblob(16))), c.id, tm.user_id, tm.team_id, tc.user_id, 'eligible', ?
    FROM feedback_cycles c
    JOIN team_members tm ON tm.starts_at <= ? AND tm.ends_at IS NULL
    JOIN teams t ON t.id = tm.team_id AND t.is_active = 1
    JOIN users u ON u.id = tm.user_id AND u.is_active = 1
    JOIN team_coordinators tc ON tc.id = (
      SELECT candidate.id FROM team_coordinators candidate
      WHERE candidate.team_id = tm.team_id AND candidate.ends_at IS NULL
      ORDER BY candidate.is_primary DESC, candidate.starts_at LIMIT 1)
    WHERE c.schedule_id = ? AND c.status = 'open' AND c.closes_at > ?
      AND NOT EXISTS (SELECT 1 FROM feedback_cycle_participants existing WHERE existing.cycle_id = c.id AND existing.employee_user_id = tm.user_id)
      AND tc.user_id != tm.user_id
      AND EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = tm.user_id AND ur.revoked_at IS NULL AND r.key = 'employee')
    ON CONFLICT(cycle_id, employee_user_id, team_id) DO NOTHING`).bind(now, now, scheduleId, now);
}
