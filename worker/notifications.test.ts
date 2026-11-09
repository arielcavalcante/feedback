import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "./env";
import { createTestDatabase } from "./testing/sqlite-d1";
import { dispatchNotifications, employeeEmailTimes, enqueueNotifications } from "./notifications";
import { snapshotParticipants } from "./scheduler/run";

type Sent = { to: string[]; subject: string; html: string; text: string };

function setup() {
  const { db, d1 } = createTestDatabase();
  const env = { DB: d1, APP_ORIGIN: "https://ino.praiasertao.com.br", APP_ENV: "production", RESEND_API_KEY: "re_test", EMAIL_FROM: "ino <ino@mail.praiasertao.com.br>" } as unknown as Env;
  const now = "2026-11-01T00:00:00.000Z";
  const user = (id: string, name: string, role: string) => {
    db.prepare("INSERT INTO users (id, email, display_name, is_active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)").run(id, `${id}@example.com`, name, now, now);
    db.prepare("INSERT INTO user_roles (user_id, role_id, granted_at) VALUES (?, ?, ?)").run(id, `role-${role}`, now);
  };
  user("coord", "Victoria Lima", "coordinator");
  for (const [id, name] of [["e1", "Lia Fernandes"], ["e2", "Caio Rocha"], ["e3", "Bia Nogueira"], ["e4", "Rui Matos"]]) user(id, name, "employee");
  db.prepare("INSERT INTO teams (id, name, is_active, created_at, updated_at) VALUES ('t1', 'Produto', 1, ?, ?)").run(now, now);
  db.prepare("INSERT INTO team_coordinators (id, team_id, user_id, starts_at, is_primary, created_at) VALUES ('tc1', 't1', 'coord', ?, 1, ?)").run(now, now);
  for (const id of ["e1", "e2", "e3", "e4"]) db.prepare("INSERT INTO team_members (id, team_id, user_id, starts_at, created_at) VALUES (?, 't1', ?, ?, ?)").run(`tm-${id}`, id, now, now);
  // Week of Monday 2026-11-09 (America/Fortaleza): opens 03:00Z, closes Monday 02:59:59Z, report Monday 12:00Z.
  db.prepare(`INSERT INTO feedback_cycles (id, schedule_id, sequence_number, opens_at, closes_at, report_at, employee_email_at, coordinator_email_at, status, anonymity_threshold_snapshot, created_at, opened_at)
    VALUES ('w1', 'default-fortaleza-weekly', 0, '2026-11-09T03:00:00.000Z', '2026-11-16T02:59:59.000Z', '2026-11-16T12:00:00.000Z', '2026-11-09T03:00:00.000Z', '2026-11-16T12:00:00.000Z', 'open', 3, ?, ?)`).run(now, now);
  return { db, env };
}

async function tick(env: Env, at: string) {
  const now = new Date(at);
  await env.DB.batch([snapshotParticipants(env, "default-fortaleza-weekly", at)]);
  await enqueueNotifications(env, now);
  return dispatchNotifications(env, now);
}

function submit(db: ReturnType<typeof setup>["db"], employee: string, signed = false) {
  const participant = db.prepare("SELECT id FROM feedback_cycle_participants WHERE cycle_id = 'w1' AND employee_user_id = ?").get(employee) as { id: string };
  db.prepare("INSERT INTO feedback_submissions (id, cycle_id, participant_id, submitted_at, state, schema_version, created_at, is_signed) VALUES (?, 'w1', ?, '2026-11-10T12:00:00.000Z', 'submitted', 1, '2026-11-10T12:00:00.000Z', ?)")
    .run(`s-${employee}`, participant.id, signed ? 1 : 0);
}

describe("weekly notification emails", () => {
  let sent: Sent[];
  beforeEach(() => {
    sent = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      sent.push(JSON.parse(String(init?.body)));
      return Response.json({ id: `email_${sent.length}` });
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("schedules Monday 09:00 and Friday 09:00 in Fortaleza, moving around holidays", () => {
    expect(employeeEmailTimes("2026-11-09T03:00:00.000Z", new Set())).toEqual({ openAt: "2026-11-09T12:00:00.000Z", reminderAt: "2026-11-13T12:00:00.000Z" });
    expect(employeeEmailTimes("2026-11-16T03:00:00.000Z", new Set(["2026-11-20"])).reminderAt).toBe("2026-11-19T12:00:00.000Z");
  });

  it("sends the Monday email once to every participant, at 09:00", async () => {
    const { env } = setup();
    expect((await tick(env, "2026-11-09T11:59:00.000Z")).sent).toBe(0);
    expect((await tick(env, "2026-11-09T12:00:00.000Z")).sent).toBe(4);
    expect((await tick(env, "2026-11-09T12:15:00.000Z")).sent).toBe(0);
    expect(sent.map((email) => email.to[0]).sort()).toEqual(["e1@example.com", "e2@example.com", "e3@example.com", "e4@example.com"]);
    expect(sent[0].subject).toMatch(/^Semana nova, .+: tua avaliação tá aberta$/);
    expect(sent[0].html).toContain("https://ino.praiasertao.com.br/#active-feedback");
  });

  it("reminds only those who haven't answered on Friday, with a different message", async () => {
    const { db, env } = setup();
    await tick(env, "2026-11-09T12:00:00.000Z");
    submit(db, "e1"); submit(db, "e2", true);
    sent = [];
    const result = await tick(env, "2026-11-13T12:00:00.000Z");
    expect(result).toMatchObject({ sent: 2, skipped: 2 });
    expect(sent.map((email) => email.to[0]).sort()).toEqual(["e3@example.com", "e4@example.com"]);
    expect(sent[0].subject).toMatch(/^Ainda dá tempo, .+ — a semana fecha domingo$/);
  });

  it("sends the coordinator a summary without numbers or comments, after the week closes", async () => {
    const { db, env } = setup();
    await tick(env, "2026-11-09T11:00:00.000Z");
    submit(db, "e1"); submit(db, "e2"); submit(db, "e3", true);
    db.prepare("UPDATE feedback_cycles SET status = 'closed' WHERE id = 'w1'").run();
    await tick(env, "2026-11-16T11:59:00.000Z");
    expect(sent.filter((email) => email.to[0] === "coord@example.com")).toHaveLength(0);
    await tick(env, "2026-11-16T12:00:00.000Z");
    const report = sent.find((email) => email.to[0] === "coord@example.com");
    expect(report?.subject).toBe("A semana de 9 de novembro fechou");
    expect(report?.text).toContain("Produto: faltou gente responder");
    expect(report?.text).toContain("avaliação assinada");
    expect(report?.text).not.toMatch(/Lia|Caio|Bia|\b[1-5],[0-9]\b/);
  });

  it("releases the coordinator summary as ready at 3 anonymous answers", async () => {
    const { db, env } = setup();
    await tick(env, "2026-11-09T11:00:00.000Z");
    submit(db, "e1"); submit(db, "e2"); submit(db, "e3");
    db.prepare("UPDATE feedback_cycles SET status = 'closed' WHERE id = 'w1'").run();
    await tick(env, "2026-11-16T12:00:00.000Z");
    const report = sent.find((email) => email.to[0] === "coord@example.com");
    expect(report?.subject).toBe("Saiu o resultado da semana do teu time, Victoria");
    expect(report?.text).toContain("Produto: resultado liberado.");
  });

  it("retries failed sends with backoff and gives up after five attempts", async () => {
    const { db, env } = setup();
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 503 }));
    const first = await tick(env, "2026-11-09T12:00:00.000Z");
    expect(first.failed).toBe(4);
    const job = db.prepare("SELECT status, attempt_count AS attempts, scheduled_for AS retryAt, last_error_code AS code FROM email_jobs WHERE recipient_user_id = 'e1' AND job_type = 'checkin_open'").get();
    expect(job).toEqual({ status: "pending", attempts: 1, retryAt: "2026-11-09T12:05:00.000Z", code: "resend_503" });
    let at = Date.parse("2026-11-09T12:05:00.000Z");
    for (let attempt = 2; attempt <= 5; attempt += 1) { await tick(env, new Date(at).toISOString()); at += 5 * 60_000 * 2 ** (attempt - 1); }
    expect(db.prepare("SELECT status FROM email_jobs WHERE recipient_user_id = 'e1' AND job_type = 'checkin_open'").get()).toEqual({ status: "failed" });
  });

  it("skips people who were deactivated before the email went out", async () => {
    const { db, env } = setup();
    await tick(env, "2026-11-09T11:00:00.000Z");
    db.prepare("UPDATE users SET is_active = 0 WHERE id = 'e4'").run();
    const result = await tick(env, "2026-11-09T12:00:00.000Z");
    expect(result).toMatchObject({ sent: 3, skipped: 1 });
  });
});
