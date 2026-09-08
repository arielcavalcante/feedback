import type { Env } from "../env";
import { digestToken, randomToken } from "./crypto";

export const SESSION_COOKIE = "feedback_session";

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  roles: Array<"admin" | "coordinator" | "employee">;
};

export function readCookie(request: Request, name: string): string | undefined {
  const cookies = request.headers.get("Cookie") ?? "";
  for (const value of cookies.split(";")) {
    const [key, ...rest] = value.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export function sessionCookie(token: string, maxAgeSeconds: number): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function createSession(env: Env, userId: string, now = new Date()): Promise<{ token: string; expiresAt: string }> {
  const token = randomToken();
  const tokenDigest = await digestToken(token);
  const absoluteDays = Number.parseInt(env.SESSION_ABSOLUTE_DAYS, 10);
  const idleDays = Number.parseInt(env.SESSION_IDLE_DAYS, 10);
  const expiresAt = new Date(now.getTime() + absoluteDays * 86_400_000).toISOString();
  const idleExpiresAt = new Date(now.getTime() + idleDays * 86_400_000).toISOString();
  await env.DB.prepare(`INSERT INTO auth_sessions (id, user_id, token_digest, created_at, last_seen_at, expires_at, idle_expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), userId, tokenDigest, now.toISOString(), now.toISOString(), expiresAt, idleExpiresAt).run();
  return { token, expiresAt };
}

export async function currentUser(request: Request, env: Env): Promise<SessionUser | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const digest = await digestToken(token);
  const now = new Date().toISOString();
  const row = await env.DB.prepare(`SELECT u.id, u.email, u.display_name AS displayName, s.id AS sessionId,
      GROUP_CONCAT(r.key) AS roleKeys
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.revoked_at IS NULL
    LEFT JOIN roles r ON r.id = ur.role_id
    WHERE s.token_digest = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND s.idle_expires_at > ? AND u.is_active = 1
    GROUP BY u.id, s.id`).bind(digest, now, now).first<{ id: string; email: string; displayName: string; sessionId: string; roleKeys: string | null }>();
  if (!row) return null;

  const nextIdle = new Date(Date.now() + Number.parseInt(env.SESSION_IDLE_DAYS, 10) * 86_400_000).toISOString();
  env.DB.prepare(`UPDATE auth_sessions SET last_seen_at = ?, idle_expires_at = MIN(expires_at, ?)
    WHERE id = ? AND last_seen_at < datetime(?, '-1 day')`).bind(now, nextIdle, row.sessionId, now).run().catch(() => undefined);
  const roles = (row.roleKeys?.split(",") ?? []).filter((role): role is SessionUser["roles"][number] => ["admin", "coordinator", "employee"].includes(role));
  return { id: row.id, email: row.email, displayName: row.displayName, roles };
}
