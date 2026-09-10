import { execFileSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";

const remote = process.argv.includes("--remote");
const email = "funcionario.demo@praiasertao.com.br";
const userId = "demo-employee";
const coordinatorId = "a81906c9-f04b-4585-9e23-1caeb30c0601";
const token = randomBytes(32).toString("base64url");
const tokenDigest = createHash("sha256").update(token).digest("hex");
const now = new Date().toISOString();
const expiresAt = new Date(Date.now() + 48 * 3_600_000).toISOString();
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;

const cycles = [
  { id: "demo-cycle-2026-08-14", sequence: 1, opens: "2026-08-14T12:00:00.000Z", closes: "2026-08-17T02:59:59.000Z", report: "2026-08-17T12:00:00.000Z", status: "reported" },
  { id: "demo-cycle-2026-08-28", sequence: 2, opens: "2026-08-28T12:00:00.000Z", closes: "2026-08-31T02:59:59.000Z", report: "2026-08-31T12:00:00.000Z", status: "reported" },
  { id: "demo-cycle-2026-09-10", sequence: 3, opens: "2026-09-10T12:00:00.000Z", closes: "2026-09-11T02:59:59.000Z", report: "2026-09-11T12:00:00.000Z", status: "open" },
];

const sql = `
INSERT INTO users (id, email, display_name, is_active, created_at, updated_at)
VALUES (${quote(userId)}, ${quote(email)}, 'Funcionário Demo', 1, ${quote(now)}, ${quote(now)})
ON CONFLICT(email) DO UPDATE SET display_name='Funcionário Demo', is_active=1, updated_at=${quote(now)};
INSERT INTO user_roles (user_id, role_id, granted_at)
SELECT ${quote(userId)}, id, ${quote(now)} FROM roles WHERE key='employee'
ON CONFLICT(user_id, role_id) DO UPDATE SET revoked_at=NULL;
INSERT INTO user_roles (user_id, role_id, granted_at)
SELECT ${quote(coordinatorId)}, id, ${quote(now)} FROM roles WHERE key='coordinator'
ON CONFLICT(user_id, role_id) DO UPDATE SET revoked_at=NULL;
INSERT INTO teams (id, name, description, is_active, created_at, updated_at)
VALUES ('demo-team', 'Praia Sertão — Demonstração', 'Equipe com dados fictícios para validação do produto.', 1, ${quote(now)}, ${quote(now)})
ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, is_active=1, updated_at=excluded.updated_at;
INSERT INTO team_members (id, team_id, user_id, starts_at, created_at)
VALUES ('demo-team-member', 'demo-team', ${quote(userId)}, '2026-08-01T12:00:00.000Z', ${quote(now)})
ON CONFLICT(id) DO NOTHING;
INSERT INTO team_coordinators (id, team_id, user_id, starts_at, is_primary, created_at)
VALUES ('demo-team-coordinator', 'demo-team', ${quote(coordinatorId)}, '2026-08-01T12:00:00.000Z', 1, ${quote(now)})
ON CONFLICT(id) DO NOTHING;
INSERT INTO feedback_schedules (id, name, timezone, anchor_open_local_date, interval_days, open_local_time, close_local_time, report_local_time, anonymity_threshold, is_active, created_at, updated_at)
VALUES ('demo-feedback-schedule', 'Cenário de demonstração', 'America/Fortaleza', '2026-08-14', 14, '09:00:00', '23:59:59', '09:00:00', 3, 0, ${quote(now)}, ${quote(now)})
ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at;
${cycles.map((cycle) => `INSERT INTO feedback_cycles (id, schedule_id, sequence_number, opens_at, closes_at, report_at, employee_email_at, coordinator_email_at, status, anonymity_threshold_snapshot, created_at, opened_at, closed_at, reported_at)
VALUES (${quote(cycle.id)}, 'demo-feedback-schedule', ${cycle.sequence}, ${quote(cycle.opens)}, ${quote(cycle.closes)}, ${quote(cycle.report)}, ${quote(cycle.opens)}, ${quote(cycle.report)}, ${quote(cycle.status)}, 3, ${quote(now)}, ${quote(cycle.opens)}, ${cycle.status === "reported" ? quote(cycle.closes) : "NULL"}, ${cycle.status === "reported" ? quote(cycle.report) : "NULL"})
ON CONFLICT(id) DO UPDATE SET opens_at=excluded.opens_at, closes_at=excluded.closes_at, report_at=excluded.report_at, status=excluded.status;`).join("\n")}
${cycles.map((cycle) => `INSERT INTO feedback_cycle_participants (id, cycle_id, employee_user_id, team_id, coordinator_user_id, eligibility_status, created_at)
VALUES (${quote(`${cycle.id}-participant`)}, ${quote(cycle.id)}, ${quote(userId)}, 'demo-team', ${quote(coordinatorId)}, 'eligible', ${quote(now)})
ON CONFLICT(id) DO NOTHING;`).join("\n")}
${cycles.slice(0, 2).map((cycle) => `INSERT INTO feedback_submissions (id, cycle_id, participant_id, submitted_at, state, schema_version, created_at)
VALUES (${quote(`${cycle.id}-submission`)}, ${quote(cycle.id)}, ${quote(`${cycle.id}-participant`)}, ${quote(cycle.closes)}, 'submitted', 1, ${quote(now)})
ON CONFLICT(id) DO NOTHING;
INSERT INTO feedback_answers (id, submission_id, dimension, question_key, numeric_value, created_at) VALUES
(${quote(`${cycle.id}-coordinator`)}, ${quote(`${cycle.id}-submission`)}, 'coordinator', 'coordinator_csat', 4, ${quote(now)}),
(${quote(`${cycle.id}-team`)}, ${quote(`${cycle.id}-submission`)}, 'team', 'team_csat', 5, ${quote(now)}),
(${quote(`${cycle.id}-work`)}, ${quote(`${cycle.id}-submission`)}, 'work', 'work_csat', 4, ${quote(now)})
ON CONFLICT(id) DO NOTHING;`).join("\n")}
UPDATE account_invitations SET revoked_at=${quote(now)} WHERE user_id=${quote(userId)} AND accepted_at IS NULL AND revoked_at IS NULL;
INSERT INTO account_invitations (id, user_id, email_snapshot, token_digest, expires_at, created_by_user_id, created_at)
VALUES (${quote(randomUUID())}, ${quote(userId)}, ${quote(email)}, ${quote(tokenDigest)}, ${quote(expiresAt)}, ${quote(coordinatorId)}, ${quote(now)});
`;

execFileSync("pnpm", ["exec", "wrangler", "d1", "execute", "feedback", remote ? "--remote" : "--local", "--command", sql], { stdio: "inherit" });
console.log(JSON.stringify({ email, invitationUrl: `https://ino.praiasertao.com.br/accept-invite#token=${token}`, expiresAt }, null, 2));
