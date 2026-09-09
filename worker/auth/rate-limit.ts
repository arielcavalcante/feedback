import type { Env } from "../env";
import { digestToken } from "./crypto";

export async function consumeAuthLimit(request: Request, env: Env, action: string, identity: string, limit = 10, windowSeconds = 900): Promise<boolean> {
  const ip = request.headers.get("CF-Connecting-IP") ?? "local";
  const keys = await Promise.all([
    digestToken(`${env.AUTH_PEPPER}|identity|${identity}`),
    digestToken(`${env.AUTH_PEPPER}|ip|${ip}`),
  ]);
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowSeconds * 1000).toISOString();
  const blockUntil = new Date(now.getTime() + windowSeconds * 1000).toISOString();
  for (const key of keys) {
    await env.DB.prepare(`INSERT INTO auth_rate_limits (key_hash, action, window_started_at, attempts, blocked_until, updated_at)
      VALUES (?, ?, ?, 1, NULL, ?)
      ON CONFLICT(key_hash, action) DO UPDATE SET
        attempts = CASE WHEN window_started_at < ? THEN 1 ELSE attempts + 1 END,
        window_started_at = CASE WHEN window_started_at < ? THEN excluded.window_started_at ELSE window_started_at END,
        blocked_until = CASE WHEN window_started_at >= ? AND attempts + 1 >= ? THEN ? ELSE NULL END,
        updated_at = excluded.updated_at`).bind(key, action, now.toISOString(), now.toISOString(), windowStart, windowStart, windowStart, limit, blockUntil).run();
    const row = await env.DB.prepare("SELECT blocked_until AS blockedUntil FROM auth_rate_limits WHERE key_hash = ? AND action = ?").bind(key, action).first<{ blockedUntil: string | null }>();
    if (row?.blockedUntil && row.blockedUntil > now.toISOString()) return false;
  }
  return true;
}

export async function clearAuthLimit(env: Env, action: string, identity: string): Promise<void> {
  const key = await digestToken(`${env.AUTH_PEPPER}|identity|${identity}`);
  await env.DB.prepare("DELETE FROM auth_rate_limits WHERE key_hash = ? AND action = ?").bind(key, action).run();
}
