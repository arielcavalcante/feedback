import type { Env } from "./env";
import { audit, requireRole } from "./access";
import { HttpError, json, readJson } from "./http";
import { COMPLAINT_MAX_LENGTH, COMPLAINT_TOPIC_KEYS } from "../shared/complaints";
import { complaintWeek, projectComplaints, type ComplaintRow, type CoordinatorComplaints } from "./domain/complaints";

/** Current team and its primary coordinator for a person (one current membership in MVP). */
export async function currentTeam(env: Env, userId: string) {
  return env.DB.prepare(`SELECT t.id AS teamId, t.name AS teamName, coordinator.id AS coordinatorId, coordinator.display_name AS coordinatorName
    FROM team_members tm
    JOIN teams t ON t.id = tm.team_id AND t.is_active = 1
    LEFT JOIN team_coordinators tc ON tc.id = (SELECT c.id FROM team_coordinators c WHERE c.team_id = tm.team_id AND c.ends_at IS NULL ORDER BY c.is_primary DESC, c.starts_at LIMIT 1)
    LEFT JOIN users coordinator ON coordinator.id = tc.user_id AND coordinator.is_active = 1
    WHERE tm.user_id = ? AND tm.ends_at IS NULL
    ORDER BY tm.starts_at DESC LIMIT 1`).bind(userId).first<{ teamId: string; teamName: string; coordinatorId: string | null; coordinatorName: string | null }>();
}

export async function handleSubmitComplaint(request: Request, env: Env): Promise<Response> {
  const user = await requireRole(request, env, "employee");
  const body = await readJson<{ topics?: unknown; body?: unknown; signed?: unknown }>(request, 256_000);
  const topics = Array.isArray(body.topics) ? [...new Set(body.topics)] : [];
  if (!topics.length || !topics.every((topic) => typeof topic === "string" && COMPLAINT_TOPIC_KEYS.includes(topic))) {
    throw new HttpError(400, "invalid_complaint", "Choose at least one topic.");
  }
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) throw new HttpError(400, "invalid_complaint", "Write what’s bothering you.");
  if (text.length > COMPLAINT_MAX_LENGTH) throw new HttpError(400, "invalid_complaint", "That text is too long. Split it into two complaints.");
  if (body.signed !== undefined && typeof body.signed !== "boolean") throw new HttpError(400, "invalid_complaint", "Write what’s bothering you.");

  const team = await currentTeam(env, user.id);
  if (!team?.coordinatorId || team.coordinatorId === user.id) {
    throw new HttpError(409, "no_team", "You need to be on a team with a coordinator to send a complaint.");
  }
  const now = new Date();
  const { weekStart, releaseAt } = complaintWeek(now);
  const id = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO complaints (id, author_user_id, team_id, coordinator_user_id, week_start_local_date, release_at, body, is_signed, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, user.id, team.teamId, team.coordinatorId, weekStart, releaseAt, text, body.signed ? 1 : 0, now.toISOString()),
    ...(topics as string[]).map((topic) => env.DB.prepare("INSERT INTO complaint_topics (complaint_id, topic_key) VALUES (?, ?)").bind(id, topic)),
  ]);
  // No resource id: the audit trail must not link the actor to an anonymous complaint.
  await audit(env, user.id, "complaint.submitted", "complaint", null, "success");
  return json({ ok: true, signed: Boolean(body.signed), releaseAt }, { status: 201 });
}

/** Complaints addressed to this coordinator for one team over the last weeks, after privacy projection. */
export async function coordinatorComplaints(env: Env, coordinatorId: string, teamId: string, now: Date): Promise<CoordinatorComplaints> {
  const since = complaintWeek(new Date(now.getTime() - 8 * 7 * 86_400_000)).weekStart;
  const rows = await env.DB.prepare(`SELECT c.id, c.author_user_id AS authorUserId,
      CASE WHEN c.is_signed = 1 THEN u.display_name END AS authorName,
      c.week_start_local_date AS weekStart, c.release_at AS releaseAt, c.body, c.is_signed AS isSigned,
      (SELECT GROUP_CONCAT(ct.topic_key) FROM complaint_topics ct WHERE ct.complaint_id = c.id) AS topicKeys
    FROM complaints c JOIN users u ON u.id = c.author_user_id
    WHERE c.coordinator_user_id = ? AND c.team_id = ? AND c.week_start_local_date >= ?
    LIMIT 500`).bind(coordinatorId, teamId, since).all<ComplaintRow>();
  return projectComplaints(rows.results, now.toISOString());
}
