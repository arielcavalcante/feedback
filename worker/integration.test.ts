// End-to-end API test against the real migrations, using Node's built-in SQLite as a D1 stand-in.
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { beforeAll, describe, expect, it } from "vitest";
import worker from "./index";
import type { Env } from "./env";
import { createSession } from "./auth/session";
import { runScheduler, snapshotParticipants } from "./scheduler/run";

type Params = Array<string | number | null>;
class Statement {
  constructor(private db: DatabaseSync, private sql: string, private params: Params = []) {}
  bind(...params: Params) { return new Statement(this.db, this.sql, params); }
  async first<T>() { return (this.db.prepare(this.sql).get(...this.params) as T | undefined) ?? null; }
  async all<T>() { return { results: this.db.prepare(this.sql).all(...this.params) as T[] }; }
  async run() { return this.runSync(); }
  runSync() { return { meta: { changes: Number(this.db.prepare(this.sql).run(...this.params).changes) } }; }
}
function d1(db: DatabaseSync) {
  return {
    prepare: (sql: string) => new Statement(db, sql),
    async batch(statements: Statement[]) {
      db.exec("BEGIN");
      try { const results = statements.map((statement) => statement.runSync()); db.exec("COMMIT"); return results; }
      catch (error) { db.exec("ROLLBACK"); throw error; }
    },
  };
}

const origin = "http://localhost:5173";
const db = new DatabaseSync(":memory:");
for (const file of readdirSync("drizzle").filter((name) => name.endsWith(".sql")).sort()) db.exec(readFileSync(`drizzle/${file}`, "utf8"));
const env = {
  DB: d1(db), APP_ORIGIN: origin, APP_ENV: "local", AUTH_PEPPER: "test-pepper", SESSION_IDLE_DAYS: "7", SESSION_ABSOLUTE_DAYS: "30",
  INVITATION_TTL_HOURS: "48", PASSWORD_RESET_TTL_MINUTES: "30", PASSWORD_PBKDF2_ITERATIONS: "1000",
} as unknown as Env;

async function call<T = Record<string, unknown>>(cookie: string, method: string, path: string, body?: unknown) {
  const response = await worker.fetch(new Request(`${origin}${path}`, {
    method, headers: { Origin: origin, Cookie: cookie, "Content-Type": "application/json", "X-Feedback-Locale": "en" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), env);
  return { status: response.status, body: await response.json() as T };
}
async function sessionFor(userId: string) { return `feedback_session=${(await createSession(env, userId)).token}`; }
async function invite(adminCookie: string, displayName: string, roles: string[], teamId?: string) {
  const email = `${displayName.toLowerCase().replaceAll(" ", ".")}@example.com`;
  const result = await call<{ invitation: { userId: string } }>(adminCookie, "POST", "/api/admin/invitations", { email, displayName, roles, teamId });
  expect(result.status).toBe(201);
  return result.body.invitation.userId;
}

let admin = ""; let adminId = ""; let coordinatorId = ""; let teamId = ""; const employees: string[] = [];

beforeAll(async () => {
  const now = new Date().toISOString();
  adminId = "admin-1";
  db.prepare("INSERT INTO users (id, email, display_name, is_active, created_at, updated_at) VALUES (?, 'admin@example.com', 'Admin', 1, ?, ?)").run(adminId, now, now);
  db.prepare("INSERT INTO user_roles (user_id, role_id, granted_at) VALUES (?, 'role-admin', ?)").run(adminId, now);
  admin = await sessionFor(adminId);
});

describe("admin organization API", () => {
  it("creates people, a team with coordination, and assigns members", async () => {
    coordinatorId = await invite(admin, "Davi Holanda", ["coordinator", "employee"]);
    const team = await call<{ team: { id: string; coordinatorUserId: string } }>(admin, "POST", "/api/admin/teams", { name: "Produto", coordinatorUserId: coordinatorId });
    expect(team.status).toBe(201);
    teamId = team.body.team.id;
    expect(team.body.team.coordinatorUserId).toBe(coordinatorId);
    for (const name of ["Lia Um", "Caio Dois", "Bia Tres", "Rui Quatro"]) employees.push(await invite(admin, name, ["employee"], teamId));
    const users = await call<{ users: Array<{ id: string; status: string; teamId: string | null; roles: string[] }> }>(admin, "GET", "/api/admin/users");
    expect(users.body.users.filter((user) => user.teamId === teamId)).toHaveLength(4);
    expect(users.body.users.find((user) => user.id === employees[0])?.status).toBe("invited");
    expect(JSON.stringify(users.body)).not.toMatch(/password|token|digest/i);
  });

  it("edits roles, refuses self-lockout, and deactivation revokes access", async () => {
    const lockout = await call(admin, "PATCH", `/api/admin/users/${adminId}`, { roles: ["employee"] });
    expect(lockout.status).toBe(409);
    const extra = await invite(admin, "Temporaria Cinco", ["employee"], teamId);
    const cookie = await sessionFor(extra);
    expect((await call(cookie, "GET", "/api/auth/me")).status).toBe(200);
    const updated = await call<{ user: { status: string; teamId: string | null } }>(admin, "PATCH", `/api/admin/users/${extra}`, { isActive: false });
    expect(updated.body.user).toMatchObject({ status: "inactive", teamId: null });
    expect((await call(cookie, "GET", "/api/auth/me")).status).toBe(401);
    const roles = await call<{ user: { roles: string[] } }>(admin, "PATCH", `/api/admin/users/${extra}`, { roles: ["coordinator", "employee"], isActive: true });
    expect(roles.body.user.roles).toEqual(["coordinator", "employee"]);
  });

  it("shows the employee's current team and coordinator before any cycle opens", async () => {
    const employee = await sessionFor(employees[0]);
    const dashboard = await call<{ team: { name: string; coordinatorName: string | null }; activeCycle: unknown }>(employee, "GET", "/api/employee/dashboard");
    expect(dashboard.body.team).toEqual({ name: "Produto", coordinatorName: "Davi Holanda" });
  });

  it("forbids non-admins", async () => {
    const employee = await sessionFor(employees[0]);
    expect((await call(employee, "GET", "/api/admin/users")).status).toBe(403);
    expect((await call(employee, "PATCH", `/api/admin/users/${employees[1]}`, { isActive: false })).status).toBe(403);
    expect((await call(employee, "GET", "/api/coordinator/dashboard")).status).toBe(403);
  });
});

describe("cycle snapshot and coordinator privacy", () => {
  const opened = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString();
  function openCycle(id: string, sequence: number, opensAt: string, closesAt: string, reportAt: string) {
    db.prepare(`INSERT INTO feedback_cycles (id, schedule_id, sequence_number, opens_at, closes_at, report_at, employee_email_at, coordinator_email_at, status, anonymity_threshold_snapshot, created_at, opened_at)
      VALUES (?, 'default-fortaleza-biweekly', ?, ?, ?, ?, ?, ?, 'open', 3, ?, ?)`).run(id, sequence, opensAt, closesAt, reportAt, opensAt, reportAt, opensAt, opensAt);
  }

  it("snapshots eligible employees when a cycle opens, excluding the coordinator", async () => {
    // Memberships started "now"; move them back so they predate the test cycles.
    db.prepare("UPDATE team_members SET starts_at = '2026-01-01T00:00:00.000Z'").run();
    db.prepare("UPDATE team_coordinators SET starts_at = '2026-01-01T00:00:00.000Z'").run();
    db.prepare("DELETE FROM team_members WHERE ends_at IS NOT NULL").run();
    openCycle("cycle-past", 900, opened(-17), opened(-15), opened(-14));
    await env.DB.batch([snapshotParticipants(env, "default-fortaleza-biweekly", new Date().toISOString()) as never]);
    const participants = db.prepare("SELECT employee_user_id AS id, coordinator_user_id AS coordinator FROM feedback_cycle_participants WHERE cycle_id = 'cycle-past'").all() as Array<{ id: string; coordinator: string }>;
    expect(participants.map((row) => row.id).sort()).toEqual([...employees].sort());
    expect(participants.every((row) => row.coordinator === coordinatorId)).toBe(true);
    // Idempotent on retry.
    await env.DB.batch([snapshotParticipants(env, "default-fortaleza-biweekly", new Date().toISOString()) as never]);
    expect((db.prepare("SELECT COUNT(*) AS n FROM feedback_cycle_participants WHERE cycle_id = 'cycle-past'").get() as { n: number }).n).toBe(4);
  });

  it("shows nothing below the threshold and averages at the threshold", async () => {
    const coordinator = await sessionFor(coordinatorId);
    const submit = async (index: number, cycleId: string) => {
      const participant = db.prepare("SELECT id FROM feedback_cycle_participants WHERE cycle_id = ? AND employee_user_id = ?").get(cycleId, employees[index]) as { id: string };
      const submission = `${cycleId}-s${index}`;
      db.prepare("INSERT INTO feedback_submissions (id, cycle_id, participant_id, submitted_at, state, schema_version, created_at) VALUES (?, ?, ?, ?, 'submitted', 1, ?)").run(submission, cycleId, participant.id, opened(-16), opened(-16));
      for (const [dimension, value] of [["coordinator", 4], ["team", 5], ["work", 3 + (index % 2)]] as const) {
        db.prepare("INSERT INTO feedback_answers (id, submission_id, dimension, question_key, numeric_value, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(`${submission}-${dimension}`, submission, dimension, `${dimension}_csat`, value, opened(-16));
      }
    };
    await submit(0, "cycle-past"); await submit(1, "cycle-past");
    let dashboard = await call<{ teams: Array<{ latest: Record<string, unknown> }> }>(coordinator, "GET", "/api/coordinator/dashboard");
    expect(dashboard.body.teams[0].latest).toMatchObject({ status: "insufficient_responses" });
    expect(dashboard.body.teams[0].latest).not.toHaveProperty("responseCount");
    expect(dashboard.body.teams[0].latest).not.toHaveProperty("dimensions");

    await submit(2, "cycle-past");
    dashboard = await call(coordinator, "GET", "/api/coordinator/dashboard");
    expect(dashboard.body.teams[0].latest).toMatchObject({ status: "ready", responseCount: 3, dimensions: { coordinator: 4, team: 5, work: 3.3 } });
    expect(JSON.stringify(dashboard.body)).not.toMatch(/participant|submission|employee_user|submitted_?at|@example\.com/i);
  });

  it("reports only a threshold bit for the open cycle", async () => {
    openCycle("cycle-now", 901, opened(-1), opened(1), opened(2));
    await runScheduler(env, new Date());
    const coordinator = await sessionFor(coordinatorId);
    const dashboard = await call<{ teams: Array<{ openCycle: Record<string, unknown> }> }>(coordinator, "GET", "/api/coordinator/dashboard");
    expect(dashboard.body.teams[0].openCycle).toEqual(expect.objectContaining({ participantCount: 4, threshold: 3, thresholdReached: false }));
    expect(Object.keys(dashboard.body.teams[0].openCycle).sort()).toEqual(["closesAt", "cycleId", "opensAt", "participantCount", "threshold", "thresholdReached"]);
  });

  it("returns 409 instead of 500 for a duplicate submission", async () => {
    const employee = await sessionFor(employees[3]);
    const body = { cycleId: "cycle-now", coordinator: 4, team: 4, work: 4 };
    expect((await call(employee, "POST", "/api/employee/feedback", body)).status).toBe(201);
    expect((await call(employee, "POST", "/api/employee/feedback", body)).status).toBe(409);
  });
});
