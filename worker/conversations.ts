// Signed check-ins and coordinator ↔ employee conversations (ADR-027).
// A check-in becomes visible to the coordinator only when the employee signs it, and only while its week is
// open; signed check-ins never count toward anonymous group results.
import type { Env } from "./env";
import { audit, requireRole } from "./access";
import { HttpError, json, readJson } from "./http";

export type SignedEvaluation = {
  cycleId: string;
  weekStart: string;
  coordinator: number;
  team: number;
  work: number;
  comment: string | null;
};

export type Conversation = {
  id: string;
  heldOn: string;
  coordinatorName: string;
  employeeName: string;
  notes: string;
  updatedAt: string;
};

type EvaluationRow = { cycleId: string; weekStart: string; employeeUserId: string; dimension: string; numericValue: number | null; textValue: string | null };

/** Signed check-ins, optionally limited to those addressed to one coordinator. */
async function signedEvaluations(env: Env, filter: { employeeIds: string[]; coordinatorId?: string }): Promise<Map<string, SignedEvaluation[]>> {
  const result = new Map<string, SignedEvaluation[]>();
  if (!filter.employeeIds.length) return result;
  const placeholders = filter.employeeIds.map(() => "?").join(", ");
  const rows = await env.DB.prepare(`SELECT c.id AS cycleId, c.opens_at AS weekStart, p.employee_user_id AS employeeUserId,
      a.dimension, a.numeric_value AS numericValue, a.text_value AS textValue
    FROM feedback_submissions s
    JOIN feedback_cycle_participants p ON p.id = s.participant_id
    JOIN feedback_cycles c ON c.id = s.cycle_id
    JOIN feedback_answers a ON a.submission_id = s.id
    WHERE s.state = 'submitted' AND s.is_signed = 1 AND p.employee_user_id IN (${placeholders})
      ${filter.coordinatorId ? "AND p.coordinator_user_id = ?" : ""}
    ORDER BY c.opens_at DESC`).bind(...filter.employeeIds, ...(filter.coordinatorId ? [filter.coordinatorId] : [])).all<EvaluationRow>();
  for (const row of rows.results) {
    const list = result.get(row.employeeUserId) ?? [];
    let evaluation = list.find((item) => item.cycleId === row.cycleId);
    if (!evaluation) {
      evaluation = { cycleId: row.cycleId, weekStart: row.weekStart, coordinator: 0, team: 0, work: 0, comment: null };
      list.push(evaluation);
      result.set(row.employeeUserId, list);
    }
    if (row.textValue) evaluation.comment = row.textValue;
    else if (row.numericValue !== null && (row.dimension === "coordinator" || row.dimension === "team" || row.dimension === "work")) evaluation[row.dimension] = Number(row.numericValue);
  }
  for (const list of result.values()) list.splice(12);
  return result;
}

async function conversations(env: Env, where: { employeeIds?: string[]; employeeId?: string; coordinatorId?: string }): Promise<Conversation[]> {
  const clauses: string[] = ["m.status = 'completed'"];
  const params: string[] = [];
  if (where.employeeId) { clauses.push("m.employee_user_id = ?"); params.push(where.employeeId); }
  if (where.employeeIds) {
    if (!where.employeeIds.length) return [];
    clauses.push(`m.employee_user_id IN (${where.employeeIds.map(() => "?").join(", ")})`); params.push(...where.employeeIds);
  }
  if (where.coordinatorId) { clauses.push("m.coordinator_user_id = ?"); params.push(where.coordinatorId); }
  const rows = await env.DB.prepare(`SELECT m.id, substr(m.held_at, 1, 10) AS heldOn, m.employee_user_id AS employeeUserId,
      coordinator.display_name AS coordinatorName, employee.display_name AS employeeName, o.content AS notes, o.updated_at AS updatedAt
    FROM meetings m
    JOIN meeting_outcomes o ON o.meeting_id = m.id AND o.kind = 'growth_opportunity'
    JOIN users coordinator ON coordinator.id = m.coordinator_user_id
    JOIN users employee ON employee.id = m.employee_user_id
    WHERE ${clauses.join(" AND ")}
    ORDER BY m.held_at DESC, m.created_at DESC
    LIMIT 200`).bind(...params).all<Conversation & { employeeUserId: string }>();
  return rows.results;
}

/** What an employee sees about themselves: their own signed check-ins and every conversation note. */
export async function employeeConversations(env: Env, userId: string) {
  const evaluations = await signedEvaluations(env, { employeeIds: [userId] });
  return {
    signedEvaluations: evaluations.get(userId) ?? [],
    conversations: (await conversations(env, { employeeId: userId })).map(({ id, heldOn, coordinatorName, notes, updatedAt }) => ({ id, heldOn, coordinatorName, notes, updatedAt })),
  };
}

export async function handleSignFeedback(request: Request, env: Env): Promise<Response> {
  const user = await requireRole(request, env, "employee");
  const body = await readJson<{ cycleId?: unknown }>(request);
  if (typeof body.cycleId !== "string") throw new HttpError(400, "invalid_feedback", "Choose an active feedback cycle.");
  const now = new Date().toISOString();
  // Only while the week is open: signing after group results exist would let anyone subtract it from the average.
  const result = await env.DB.prepare(`UPDATE feedback_submissions SET is_signed = 1, signed_at = ?
    WHERE is_signed = 0 AND state = 'submitted' AND cycle_id = ? AND participant_id IN (
      SELECT p.id FROM feedback_cycle_participants p JOIN feedback_cycles c ON c.id = p.cycle_id
      WHERE p.employee_user_id = ? AND p.cycle_id = ? AND c.status = 'open' AND c.closes_at > ?)`).bind(now, body.cycleId, user.id, body.cycleId, now).run();
  if ((result.meta.changes ?? 0) !== 1) throw new HttpError(409, "cannot_sign", "This check-in can no longer be signed.");
  await audit(env, user.id, "feedback.signed", "feedback_cycle", body.cycleId, "success");
  return json({ ok: true });
}

/** People on the teams this coordinator currently leads, with their signed check-ins and conversation history. */
export async function handleCoordinatorPeople(request: Request, env: Env): Promise<Response> {
  const user = await requireRole(request, env, "coordinator");
  const members = await env.DB.prepare(`SELECT DISTINCT u.id, u.display_name AS name, t.id AS teamId, t.name AS teamName
    FROM team_coordinators tc
    JOIN teams t ON t.id = tc.team_id AND t.is_active = 1
    JOIN team_members tm ON tm.team_id = t.id AND tm.ends_at IS NULL
    JOIN users u ON u.id = tm.user_id AND u.is_active = 1
    WHERE tc.user_id = ? AND tc.ends_at IS NULL AND u.id != ?
    ORDER BY u.display_name COLLATE NOCASE`).bind(user.id, user.id).all<{ id: string; name: string; teamId: string; teamName: string }>();
  const ids = members.results.map((member) => member.id);
  const evaluations = await signedEvaluations(env, { employeeIds: ids, coordinatorId: user.id });
  const notes = await conversations(env, { employeeIds: ids, coordinatorId: user.id }) as Array<Conversation & { employeeUserId: string }>;
  return json({
    people: members.results.map((member) => ({
      ...member,
      signedEvaluations: evaluations.get(member.id) ?? [],
      conversations: notes.filter((note) => note.employeeUserId === member.id).map(({ id, heldOn, coordinatorName, notes: text, updatedAt }) => ({ id, heldOn, coordinatorName, notes: text, updatedAt })),
    })),
  });
}

function parseNotes(value: unknown): string {
  const notes = typeof value === "string" ? value.trim() : "";
  if (!notes) throw new HttpError(400, "invalid_conversation", "Write what you agreed on.");
  if (notes.length > 20_000) throw new HttpError(400, "invalid_conversation", "These notes are too long.");
  return notes;
}

function parseDay(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T12:00:00Z`))) {
    throw new HttpError(400, "invalid_conversation", "Choose the date of the conversation.");
  }
  return value;
}

export async function handleCreateConversation(request: Request, env: Env): Promise<Response> {
  const user = await requireRole(request, env, "coordinator");
  const body = await readJson<{ employeeUserId?: unknown; heldOn?: unknown; notes?: unknown }>(request, 64_000);
  const notes = parseNotes(body.notes);
  const heldOn = parseDay(body.heldOn);
  if (typeof body.employeeUserId !== "string") throw new HttpError(400, "invalid_conversation", "Choose someone from your team.");
  const member = await env.DB.prepare(`SELECT tm.team_id AS teamId FROM team_coordinators tc
    JOIN teams t ON t.id = tc.team_id AND t.is_active = 1
    JOIN team_members tm ON tm.team_id = tc.team_id AND tm.ends_at IS NULL AND tm.user_id = ?
    JOIN users u ON u.id = tm.user_id AND u.is_active = 1
    WHERE tc.user_id = ? AND tc.ends_at IS NULL AND tm.user_id != ? LIMIT 1`).bind(body.employeeUserId, user.id, user.id).first<{ teamId: string }>();
  if (!member) throw new HttpError(403, "forbidden", "Choose someone from your team.");
  const now = new Date().toISOString();
  const meetingId = crypto.randomUUID();
  const heldAt = `${heldOn}T12:00:00.000Z`;
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO meetings (id, employee_user_id, coordinator_user_id, team_id, scheduled_for, held_at, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?)`).bind(meetingId, body.employeeUserId, user.id, member.teamId, heldAt, heldAt, now, now),
    env.DB.prepare(`INSERT INTO meeting_outcomes (id, meeting_id, kind, content, visibility, created_by_user_id, created_at, updated_at)
      VALUES (?, ?, 'growth_opportunity', ?, 'shared', ?, ?, ?)`).bind(crypto.randomUUID(), meetingId, notes, user.id, now, now),
  ]);
  await audit(env, user.id, "meeting.recorded", "meeting", meetingId, "success");
  return json({ ok: true, id: meetingId }, { status: 201 });
}

export async function handleUpdateConversation(request: Request, env: Env, meetingId: string): Promise<Response> {
  const user = await requireRole(request, env, "coordinator");
  const body = await readJson<{ heldOn?: unknown; notes?: unknown }>(request, 64_000);
  const notes = parseNotes(body.notes);
  const heldOn = body.heldOn === undefined ? undefined : parseDay(body.heldOn);
  const meeting = await env.DB.prepare("SELECT id FROM meetings WHERE id = ? AND coordinator_user_id = ?").bind(meetingId, user.id).first<{ id: string }>();
  if (!meeting) throw new HttpError(404, "conversation_not_found", "Conversation not found.");
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("UPDATE meeting_outcomes SET content = ?, updated_at = ? WHERE meeting_id = ? AND kind = 'growth_opportunity'").bind(notes, now, meetingId),
    env.DB.prepare("UPDATE meetings SET updated_at = ?, held_at = COALESCE(?, held_at), scheduled_for = COALESCE(?, scheduled_for) WHERE id = ?")
      .bind(now, heldOn ? `${heldOn}T12:00:00.000Z` : null, heldOn ? `${heldOn}T12:00:00.000Z` : null, meetingId),
  ]);
  await audit(env, user.id, "meeting.updated", "meeting", meetingId, "success");
  return json({ ok: true });
}
