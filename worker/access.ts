import type { Env } from "./env";
import { currentUser, type SessionUser } from "./auth/session";
import { HttpError } from "./http";

export type RoleKey = SessionUser["roles"][number];
export const ROLE_KEYS: readonly RoleKey[] = ["admin", "coordinator", "employee"];

export async function requireRole(request: Request, env: Env, role: RoleKey): Promise<SessionUser> {
  const user = await currentUser(request, env);
  if (!user) throw new HttpError(401, "unauthenticated", "Please sign in.");
  if (!user.roles.includes(role)) throw new HttpError(403, "forbidden", "You do not have access to this action.");
  return user;
}

export async function audit(env: Env, actorUserId: string | null, action: string, resourceType: string, resourceId: string | null, outcome: string): Promise<void> {
  await env.DB.prepare("INSERT INTO audit_logs (id, occurred_at, actor_user_id, action, resource_type, resource_id, outcome) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), new Date().toISOString(), actorUserId, action, resourceType, resourceId, outcome).run();
}

export function normalizeEmail(email: string): string { return email.trim().toLowerCase(); }

export function parseRoles(value: unknown): RoleKey[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (!value.every((role) => typeof role === "string" && (ROLE_KEYS as readonly string[]).includes(role))) return null;
  return [...new Set(value as RoleKey[])];
}
