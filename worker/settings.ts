// Organization-wide check-in pause (ADR-030). While paused: no cycle opens, the current week is closed
// (or cancelled if nobody answered), check-ins and signing are refused, and check-in emails stop.
// Complaints, conversations and past results keep working.
import type { Env } from "./env";
import { audit, requireRole } from "./access";
import { HttpError, json, readJson } from "./http";

export type PauseState = { paused: boolean; since: string | null; byName: string | null };

export async function pauseState(env: Env): Promise<PauseState> {
  const row = await env.DB.prepare(`SELECT s.value, s.updated_at AS since, u.display_name AS byName
    FROM app_settings s LEFT JOIN users u ON u.id = s.updated_by_user_id WHERE s.key = 'checkins_paused'`).first<{ value: string; since: string; byName: string | null }>();
  return { paused: row?.value === "1", since: row?.value === "1" ? row.since : null, byName: row?.value === "1" ? row.byName : null };
}

export async function checkinsPaused(env: Env): Promise<boolean> {
  return (await pauseState(env)).paused;
}

/**
 * Stops the week in progress: a cycle nobody answered is cancelled (it disappears from everyone's history);
 * a cycle with answers closes now and still reports on Monday if it reached the minimum.
 */
export function pauseStatements(env: Env, now: string): D1PreparedStatement[] {
  return [
    env.DB.prepare(`UPDATE feedback_cycles SET status = 'cancelled'
      WHERE status IN ('scheduled', 'open') AND opens_at <= ?
        AND NOT EXISTS (SELECT 1 FROM feedback_submissions s WHERE s.cycle_id = feedback_cycles.id)`).bind(now),
    env.DB.prepare("UPDATE feedback_cycles SET status = 'closed', closes_at = ?, closed_at = ? WHERE status = 'open' AND closes_at > ?").bind(now, now, now),
  ];
}

export async function handleGetSettings(request: Request, env: Env): Promise<Response> {
  await requireRole(request, env, "admin");
  return json({ checkins: await pauseState(env) });
}

export async function handleUpdateSettings(request: Request, env: Env): Promise<Response> {
  const actor = await requireRole(request, env, "admin");
  const body = await readJson<{ checkinsPaused?: unknown }>(request);
  if (typeof body.checkinsPaused !== "boolean") throw new HttpError(400, "invalid_settings", "The request body is invalid.");
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO app_settings (key, value, updated_at, updated_by_user_id) VALUES ('checkins_paused', ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by_user_id = excluded.updated_by_user_id`)
      .bind(body.checkinsPaused ? "1" : "0", now, actor.id),
    ...(body.checkinsPaused ? pauseStatements(env, now) : []),
  ]);
  await audit(env, actor.id, body.checkinsPaused ? "settings.checkins_paused" : "settings.checkins_resumed", "app_settings", "checkins_paused", "success");
  return json({ checkins: await pauseState(env) });
}
