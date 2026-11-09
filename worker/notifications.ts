// Weekly notification emails, delivered through the durable `email_jobs` queue (ADR-028):
// - Monday 09:00: "the week's check-in is open" to every participant;
// - Friday 09:00: a different reminder only to participants who haven't answered yet;
// - Monday 09:00 after a week closes: the week's summary to each coordinator.
// Jobs are idempotent (unique key per type/cycle/person), checked again right before sending, retried with
// backoff, and never carry survey content.
import type { Env } from "./env";
import { sendAccountEmail, type AccountEmail } from "./email";
import { translate, type Locale } from "../shared/localization";
import { addLocalDays, localDateInZone, localDateTimeToUtc, nextOrSameWorkday, previousOrSameWorkday } from "./domain/schedule";
import { effectiveThreshold } from "./domain/coordinator";

const TIMEZONE = "America/Fortaleza";
const SEND_TIME = "09:00:00";
const MAX_ATTEMPTS = 5;
const STALE_PROCESSING_MS = 10 * 60_000;
const LOCALE: Locale = "pt-BR";

export type JobType = "checkin_open" | "checkin_reminder" | "coordinator_report";

type CycleRow = { id: string; opensAt: string; closesAt: string; status: string; coordinatorEmailAt: string; threshold: number };

/** When the Monday "open" email and the Friday reminder go out for a cycle that opens on `opensAt`. */
export function employeeEmailTimes(opensAt: string, holidays: ReadonlySet<string>) {
  const openDay = localDateInZone(new Date(opensAt), TIMEZONE);
  const openEmailDay = nextOrSameWorkday(openDay, holidays);
  const reminderDay = previousOrSameWorkday(addLocalDays(openDay, 4), holidays);
  return {
    openAt: localDateTimeToUtc(openEmailDay, SEND_TIME, TIMEZONE),
    // A Friday holiday moves the reminder earlier, but never before or on the opening email day.
    reminderAt: localDateTimeToUtc(reminderDay > openEmailDay ? reminderDay : addLocalDays(openEmailDay, 1), SEND_TIME, TIMEZONE),
  };
}

export async function enqueueNotifications(env: Env, now: Date): Promise<void> {
  const nowIso = now.toISOString();
  const holidays = new Set((await env.DB.prepare("SELECT local_date AS localDate FROM holidays").all<{ localDate: string }>()).results.map((row) => row.localDate));
  const cycles = await env.DB.prepare(`SELECT c.id, c.opens_at AS opensAt, c.closes_at AS closesAt, c.status, c.coordinator_email_at AS coordinatorEmailAt,
      c.anonymity_threshold_snapshot AS threshold
    FROM feedback_cycles c JOIN feedback_schedules s ON s.id = c.schedule_id AND s.is_active = 1
    WHERE c.status IN ('open', 'closed', 'reported') AND c.closes_at > ?`).bind(new Date(now.getTime() - 3 * 86_400_000).toISOString()).all<CycleRow>();

  const statements: D1PreparedStatement[] = [];
  const enqueueParticipants = (cycle: CycleRow, type: JobType, scheduledFor: string) => env.DB.prepare(`INSERT INTO email_jobs
      (id, job_type, cycle_id, recipient_user_id, scheduled_for, status, attempt_count, idempotency_key, created_at, updated_at)
    SELECT lower(hex(randomblob(16))), ?, p.cycle_id, p.employee_user_id, ?, 'pending', 0, ? || ':' || p.cycle_id || ':' || p.employee_user_id, ?, ?
    FROM feedback_cycle_participants p WHERE p.cycle_id = ? AND p.eligibility_status = 'eligible'
    ON CONFLICT(idempotency_key) DO NOTHING`).bind(type, scheduledFor, type, nowIso, nowIso, cycle.id);

  for (const cycle of cycles.results) {
    if (cycle.status === "open" && cycle.closesAt > nowIso) {
      const { openAt, reminderAt } = employeeEmailTimes(cycle.opensAt, holidays);
      // People who join after the Friday reminder time only get the reminder.
      if (nowIso < reminderAt) statements.push(enqueueParticipants(cycle, "checkin_open", openAt));
      statements.push(enqueueParticipants(cycle, "checkin_reminder", reminderAt));
    }
    if (cycle.closesAt <= nowIso) {
      statements.push(env.DB.prepare(`INSERT INTO email_jobs
          (id, job_type, cycle_id, recipient_user_id, scheduled_for, status, attempt_count, idempotency_key, created_at, updated_at)
        SELECT lower(hex(randomblob(16))), 'coordinator_report', ?, coordinator_user_id, ?, 'pending', 0, 'coordinator_report:' || ? || ':' || coordinator_user_id, ?, ?
        FROM (SELECT DISTINCT coordinator_user_id FROM feedback_cycle_participants WHERE cycle_id = ? AND eligibility_status = 'eligible')
        WHERE true
        ON CONFLICT(idempotency_key) DO NOTHING`).bind(cycle.id, cycle.coordinatorEmailAt, cycle.id, nowIso, nowIso, cycle.id));
    }
  }
  if (statements.length) await env.DB.batch(statements);
}

type JobRow = { id: string; type: JobType; cycleId: string; userId: string; attempts: number; email: string; displayName: string; isActive: number };

/** Sends due jobs one by one (Resend allows a couple of requests per second). */
export async function dispatchNotifications(env: Env, now: Date, options: { pauseMs?: number; limit?: number } = {}): Promise<{ sent: number; skipped: number; failed: number }> {
  const nowIso = now.toISOString();
  const stale = new Date(now.getTime() - STALE_PROCESSING_MS).toISOString();
  const jobs = await env.DB.prepare(`SELECT j.id, j.job_type AS type, j.cycle_id AS cycleId, j.recipient_user_id AS userId, j.attempt_count AS attempts,
      u.email, u.display_name AS displayName, u.is_active AS isActive
    FROM email_jobs j JOIN users u ON u.id = j.recipient_user_id
    WHERE (j.status = 'pending' AND j.scheduled_for <= ?) OR (j.status = 'processing' AND j.updated_at < ?)
    ORDER BY j.scheduled_for LIMIT ?`).bind(nowIso, stale, options.limit ?? 50).all<JobRow>();

  const result = { sent: 0, skipped: 0, failed: 0 };
  for (const job of jobs.results) {
    const claimed = await env.DB.prepare(`UPDATE email_jobs SET status = 'processing', attempt_count = attempt_count + 1, updated_at = ?
      WHERE id = ? AND ((status = 'pending' AND scheduled_for <= ?) OR (status = 'processing' AND updated_at < ?))`).bind(nowIso, job.id, nowIso, stale).run();
    if ((claimed.meta.changes ?? 0) !== 1) continue;

    try {
      const email = job.isActive ? await buildEmail(env, job, now) : null;
      if (!email) {
        await env.DB.prepare("UPDATE email_jobs SET status = 'cancelled', updated_at = ? WHERE id = ?").bind(nowIso, job.id).run();
        result.skipped += 1;
        continue;
      }
      const providerId = await sendAccountEmail(env, email);
      await env.DB.prepare("UPDATE email_jobs SET status = 'sent', sent_at = ?, provider_message_id = ?, updated_at = ? WHERE id = ?").bind(nowIso, providerId, nowIso, job.id).run();
      result.sent += 1;
    } catch (error) {
      const attempts = job.attempts + 1;
      const code = error instanceof Error ? error.message.slice(0, 60) : "unknown";
      const retryAt = new Date(now.getTime() + 5 * 60_000 * 2 ** (attempts - 1)).toISOString();
      await env.DB.prepare(`UPDATE email_jobs SET status = ?, scheduled_for = ?, last_error_code = ?, last_error_at = ?, updated_at = ? WHERE id = ?`)
        .bind(attempts >= MAX_ATTEMPTS ? "failed" : "pending", retryAt, code, nowIso, nowIso, job.id).run();
      console.error(JSON.stringify({ event: "notification_failed", type: job.type, attempts, code }));
      result.failed += 1;
    }
    if (options.pauseMs) await new Promise((resolve) => setTimeout(resolve, options.pauseMs));
  }
  return result;
}

const t = (message: string, values?: Record<string, string>) => translate(message, LOCALE, values);
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
const NOTIFICATION_FOOTNOTE = () => t("You get this email because you’re on a team in ino. It never includes anyone’s answers.");

/** Returns null when the job no longer applies (week closed, already answered, nothing to report). */
async function buildEmail(env: Env, job: JobRow, now: Date): Promise<AccountEmail | null> {
  const nowIso = now.toISOString();
  const cycle = await env.DB.prepare(`SELECT id, opens_at AS opensAt, closes_at AS closesAt, status, coordinator_email_at AS coordinatorEmailAt, anonymity_threshold_snapshot AS threshold
    FROM feedback_cycles WHERE id = ?`).bind(job.cycleId).first<CycleRow>();
  if (!cycle || cycle.status === "cancelled") return null;
  const name = firstName(job.displayName);
  const appUrl = env.APP_ORIGIN;

  if (job.type === "checkin_open" || job.type === "checkin_reminder") {
    if (cycle.closesAt <= nowIso) return null;
    const answered = await env.DB.prepare(`SELECT 1 AS answered FROM feedback_submissions s JOIN feedback_cycle_participants p ON p.id = s.participant_id
      WHERE p.cycle_id = ? AND p.employee_user_id = ? AND s.state = 'submitted'`).bind(cycle.id, job.userId).first<{ answered: number }>();
    if (answered) return null;
    if (job.type === "checkin_open") {
      return {
        to: job.email, locale: LOCALE,
        subject: t("New week, {name}: your check-in is open", { name }),
        preheader: t("Three scores, one minute, any time until Sunday."),
        eyebrow: t("This week’s check-in"),
        heading: t("Hey, {name}! New week.", { name }),
        body: [
          t("This week’s check-in is already open: three scores from 1 to 5 about your coordinator, your team and your work. Answer whenever you want, until Sunday night."),
          t("Your answers only show up together with the group’s — unless you choose to sign them so you can talk about them."),
        ],
        actionLabel: t("Answer now"),
        actionUrl: `${appUrl}/#active-feedback`,
        footnote: NOTIFICATION_FOOTNOTE(),
      };
    }
    return {
      to: job.email, locale: LOCALE,
      subject: t("Still time, {name} — the week closes Sunday", { name }),
      preheader: t("Your check-in is the only thing missing before the weekend."),
      eyebrow: t("It’s Friday"),
      heading: t("It’s Friday! Only your check-in is missing."),
      body: [
        t("Before the weekend: this week’s check-in closes Sunday at 11:59pm and takes about a minute."),
        t("And if something that isn’t about your coordinator is bugging you, the Complain button is there too."),
      ],
      actionLabel: t("Answer before the weekend"),
      actionUrl: `${appUrl}/#active-feedback`,
      footnote: NOTIFICATION_FOOTNOTE(),
    };
  }

  // Coordinator weekly summary: only whether each team's results were released, never numbers or text.
  const cohorts = await env.DB.prepare(`SELECT t.name AS teamName,
      COUNT(CASE WHEN s.is_signed = 0 THEN s.id END) AS anonymousCount,
      COUNT(CASE WHEN s.is_signed = 1 THEN s.id END) AS signedCount
    FROM feedback_cycle_participants p
    JOIN teams t ON t.id = p.team_id
    LEFT JOIN feedback_submissions s ON s.participant_id = p.id AND s.state = 'submitted'
    WHERE p.cycle_id = ? AND p.coordinator_user_id = ? AND p.eligibility_status = 'eligible'
    GROUP BY p.team_id ORDER BY t.name`).bind(cycle.id, job.userId).all<{ teamName: string; anonymousCount: number; signedCount: number }>();
  if (!cohorts.results.length) return null;
  const threshold = effectiveThreshold(cycle.threshold);
  const anyReady = cohorts.results.some((row) => row.anonymousCount >= threshold);
  const weekStart = localDateInZone(new Date(cycle.opensAt), TIMEZONE);
  const complaints = await env.DB.prepare(`SELECT COUNT(*) AS signed,
      (SELECT COUNT(DISTINCT author_user_id) FROM complaints WHERE coordinator_user_id = ? AND week_start_local_date = ? AND is_signed = 0) AS anonymousAuthors
    FROM complaints WHERE coordinator_user_id = ? AND week_start_local_date = ? AND is_signed = 1`).bind(job.userId, weekStart, job.userId, weekStart).first<{ signed: number; anonymousAuthors: number }>();
  const hasConversationMaterial = cohorts.results.some((row) => row.signedCount > 0) || Boolean(complaints?.signed) || (complaints?.anonymousAuthors ?? 0) >= threshold;
  const weekLabel = new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, day: "numeric", month: "long" }).format(new Date(cycle.opensAt));

  return {
    to: job.email, locale: LOCALE,
    subject: anyReady ? t("Your team’s week is in, {name}", { name }) : t("The week of {date} has closed", { date: weekLabel }),
    preheader: t("Last week’s results, signed check-ins and complaints are waiting for you."),
    eyebrow: t("Week of {date}", { date: weekLabel }),
    heading: anyReady ? t("Hey, {name}! The results are in.", { name }) : t("Hey, {name}! The week has closed.", { name }),
    body: [
      ...cohorts.results.map((row) => row.anonymousCount >= threshold
        ? t("{team}: results released.", { team: row.teamName })
        : t("{team}: not enough answers — the results stay hidden to protect anonymity.", { team: row.teamName })),
      ...(hasConversationMaterial ? [t("There are also signed check-ins or new complaints from the team to look at. A good starting point for this week’s conversations.")] : []),
    ],
    actionLabel: t("See the results"),
    actionUrl: `${appUrl}/#team-results`,
    footnote: t("You get this email because you coordinate a team in ino. Answers and comments are only shown inside the app."),
  };
}
