import type { Env } from "./env";
import { digestToken, randomToken } from "./auth/crypto";
import { hashPassword, validatePassword, verifyPassword } from "./auth/password";
import { clearAuthLimit, consumeAuthLimit } from "./auth/rate-limit";
import { clearSessionCookie, createSession, currentUser, readCookie, SESSION_COOKIE, sessionCookie, type SessionUser } from "./auth/session";
import { sendAccountEmail } from "./email";
import { assertSameOrigin, HttpError, json, readJson } from "./http";
import { runScheduler } from "./scheduler/run";

const API_ERROR = "The email or password is incorrect.";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (!url.pathname.startsWith("/api/")) return new Response("Not found", { status: 404 });
      if (request.method !== "GET") assertSameOrigin(request, env.APP_ORIGIN);

      if (request.method === "GET" && url.pathname === "/api/health") {
        const db = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
        return json({ status: db?.ok === 1 ? "ok" : "degraded", service: "feedback", time: new Date().toISOString() });
      }
      if (request.method === "GET" && url.pathname === "/api/auth/me") return handleMe(request, env);
      if (request.method === "POST" && url.pathname === "/api/auth/login") return handleLogin(request, env);
      if (request.method === "POST" && url.pathname === "/api/auth/logout") return handleLogout(request, env);
      if (request.method === "POST" && url.pathname === "/api/auth/password-reset/request") return handleResetRequest(request, env);

      if (request.method === "POST" && url.pathname === "/api/auth/invitations/resolve") return handleInviteLookup(request, env);
      if (request.method === "POST" && url.pathname === "/api/auth/invitations/accept") return handleInviteAccept(request, env);
      if (request.method === "POST" && url.pathname === "/api/auth/password-reset/accept") return handleResetAccept(request, env);
      if (request.method === "POST" && url.pathname === "/api/admin/invitations") return handleCreateInvitation(request, env);

      return json({ error: { code: "not_found", message: "Route not found." } }, { status: 404 });
    } catch (error) {
      if (error instanceof HttpError) return json({ error: { code: error.code, message: error.message } }, { status: error.status });
      const requestId = crypto.randomUUID();
      console.error(JSON.stringify({ event: "request_failed", requestId, error: error instanceof Error ? error.message : "unknown" }));
      return json({ error: { code: "internal_error", message: "Something went wrong.", requestId } }, { status: 500 });
    }
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runScheduler(env, new Date()));
  },
};

async function handleMe(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return json({ error: { code: "unauthenticated", message: "Please sign in." } }, { status: 401 });
  return json({ user });
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ email?: unknown; password?: unknown }>(request);
  if (typeof body.email !== "string" || typeof body.password !== "string" || body.password.length > 256) throw new HttpError(401, "invalid_credentials", API_ERROR);
  const email = normalizeEmail(body.email);
  if (!await consumeAuthLimit(request, env, "login", email)) throw new HttpError(429, "try_later", "Too many attempts. Try again later.");
  const row = await env.DB.prepare(`SELECT u.id, u.email, u.display_name AS displayName, u.is_active AS isActive, c.password_hash AS passwordHash
    FROM users u JOIN auth_credentials c ON c.user_id = u.id WHERE u.email = ?`).bind(email).first<{ id: string; email: string; displayName: string; isActive: number; passwordHash: string }>();
  const iterations = passwordIterations(env);
  const valid = row ? await verifyPassword(body.password, row.passwordHash, env.AUTH_PEPPER) : await consumePasswordWork(body.password, env, iterations);
  if (!row || !row.isActive || !valid) throw new HttpError(401, "invalid_credentials", API_ERROR);
  await clearAuthLimit(env, "login", email);
  const user = await userWithRoles(env, row.id);
  const session = await createSession(env, row.id);
  const maxAge = Math.max(0, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000));
  return json({ user }, { headers: { "Set-Cookie": sessionCookie(session.token, maxAge) } });
}

async function consumePasswordWork(password: string, env: Env, iterations: number): Promise<false> {
  const safeInput = password.length >= 15 && password.length <= 128 ? password : "invalid-password-placeholder";
  await hashPassword(safeInput, env.AUTH_PEPPER, iterations);
  return false;
}

async function handleLogout(request: Request, env: Env): Promise<Response> {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) await env.DB.prepare("UPDATE auth_sessions SET revoked_at = ? WHERE token_digest = ? AND revoked_at IS NULL").bind(new Date().toISOString(), await digestToken(token)).run();
  return json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie() } });
}

async function handleInviteLookup(request: Request, env: Env): Promise<Response> {
  const { token } = await readJson<{ token?: unknown }>(request);
  if (typeof token !== "string") throw new HttpError(404, "invitation_unavailable", "This invitation is invalid or has expired.");
  const row = await validInvitation(env, token);
  if (!row) throw new HttpError(404, "invitation_unavailable", "This invitation is invalid or has expired.");
  return json({ invitation: { email: row.email, displayName: row.displayName, expiresAt: row.expiresAt } });
}

async function handleInviteAccept(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ token?: unknown; password?: unknown }>(request);
  if (typeof body.token !== "string" || typeof body.password !== "string") throw new HttpError(400, "invalid_invitation", "The invitation request is invalid.");
  const token = body.token;
  const policy = validatePassword(body.password);
  if (!policy.valid) throw new HttpError(400, "invalid_password", policy.message);
  const invitation = await validInvitation(env, token);
  if (!invitation) throw new HttpError(404, "invitation_unavailable", "This invitation is invalid or has expired.");
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(body.password, env.AUTH_PEPPER, passwordIterations(env));
  const digest = await digestToken(token);
  const result = await env.DB.batch([
    env.DB.prepare(`INSERT INTO auth_credentials (user_id, password_hash, password_changed_at, must_change_password, created_at, updated_at)
      SELECT user_id, ?, ?, 0, ?, ? FROM account_invitations
      WHERE token_digest = ? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > ?
      ON CONFLICT(user_id) DO NOTHING`).bind(passwordHash, now, now, now, digest, now),
    env.DB.prepare("UPDATE account_invitations SET accepted_at = ? WHERE token_digest = ? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > ?").bind(now, digest, now),
  ]);
  if ((result[0].meta.changes ?? 0) !== 1 || (result[1].meta.changes ?? 0) !== 1) throw new HttpError(409, "invitation_unavailable", "This invitation is invalid or has already been used.");
  const user = await userWithRoles(env, invitation.userId);
  const session = await createSession(env, invitation.userId);
  const maxAge = Math.max(0, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000));
  return json({ user }, { status: 201, headers: { "Set-Cookie": sessionCookie(session.token, maxAge) } });
}

async function handleCreateInvitation(request: Request, env: Env): Promise<Response> {
  const actor = await requireRole(request, env, "admin");
  const body = await readJson<{ email?: unknown; displayName?: unknown; roles?: unknown }>(request);
  if (typeof body.email !== "string" || typeof body.displayName !== "string" || !Array.isArray(body.roles)) throw new HttpError(400, "invalid_user", "Provide an email, name, and roles.");
  const email = normalizeEmail(body.email);
  const roleKeys = [...new Set(body.roles)].filter((role): role is "admin" | "coordinator" | "employee" => typeof role === "string" && ["admin", "coordinator", "employee"].includes(role));
  if (!email || body.displayName.trim().length < 2 || roleKeys.length === 0) throw new HttpError(400, "invalid_user", "Provide a valid email, name, and role.");
  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{ id: string }>();
  const userId = existing?.id ?? crypto.randomUUID();
  const invitationId = crypto.randomUUID();
  const token = randomToken();
  const digest = await digestToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + Number.parseInt(env.INVITATION_TTL_HOURS, 10) * 3_600_000).toISOString();
  const statements = [
    env.DB.prepare(`INSERT INTO users (id, email, display_name, is_active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)
      ON CONFLICT(email) DO UPDATE SET display_name = excluded.display_name, is_active = 1, updated_at = excluded.updated_at`).bind(userId, email, body.displayName.trim(), now.toISOString(), now.toISOString()),
    env.DB.prepare("UPDATE account_invitations SET revoked_at = ? WHERE user_id = ? AND accepted_at IS NULL AND revoked_at IS NULL").bind(now.toISOString(), userId),
    env.DB.prepare(`INSERT INTO account_invitations (id, user_id, email_snapshot, token_digest, expires_at, created_by_user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(invitationId, userId, email, digest, expiresAt, actor.id, now.toISOString()),
    ...roleKeys.map((role) => env.DB.prepare(`INSERT INTO user_roles (user_id, role_id, granted_at, granted_by_user_id)
      SELECT ?, id, ?, ? FROM roles WHERE key = ? ON CONFLICT(user_id, role_id) DO UPDATE SET revoked_at = NULL, granted_at = excluded.granted_at, granted_by_user_id = excluded.granted_by_user_id`).bind(userId, now.toISOString(), actor.id, role)),
  ];
  await env.DB.batch(statements);
  const actionUrl = `${env.APP_ORIGIN}/accept-invite#token=${encodeURIComponent(token)}`;
  await sendAccountEmail(env, { to: email, subject: "You’re invited to Team Feedback", heading: `Welcome, ${body.displayName.trim()}`, body: `Create your account before ${expiresAt}.`, actionLabel: "Create account", actionUrl });
  await audit(env, actor.id, "account.invitation_created", "user", userId, "success");
  return json({ invitation: { userId, email, expiresAt, ...(env.APP_ENV === "local" ? { actionUrl } : {}) } }, { status: 201 });
}

async function handleResetRequest(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ email?: unknown }>(request);
  if (typeof body.email === "string") {
    const email = normalizeEmail(body.email);
    if (!await consumeAuthLimit(request, env, "password_reset", email, 5, 900)) return json({ ok: true, message: "If that account exists, a reset email will arrive shortly." }, { status: 202 });
    const user = await env.DB.prepare("SELECT id, email, display_name AS displayName FROM users WHERE email = ? AND is_active = 1").bind(email).first<{ id: string; email: string; displayName: string }>();
    if (user) {
      const token = randomToken(); const digest = await digestToken(token); const now = new Date();
      const expiresAt = new Date(now.getTime() + Number.parseInt(env.PASSWORD_RESET_TTL_MINUTES, 10) * 60_000).toISOString();
      await env.DB.batch([
        env.DB.prepare("UPDATE password_reset_tokens SET revoked_at = ? WHERE user_id = ? AND used_at IS NULL AND revoked_at IS NULL").bind(now.toISOString(), user.id),
        env.DB.prepare("INSERT INTO password_reset_tokens (id, user_id, token_digest, expires_at, created_at) VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(), user.id, digest, expiresAt, now.toISOString()),
      ]);
      const actionUrl = `${env.APP_ORIGIN}/reset-password#token=${encodeURIComponent(token)}`;
      await sendAccountEmail(env, { to: user.email, subject: "Reset your Team Feedback password", heading: "Reset your password", body: `This link expires at ${expiresAt}.`, actionLabel: "Reset password", actionUrl }).catch((error) => {
        console.error(JSON.stringify({ event: "password_reset_delivery_failed", code: error instanceof Error ? error.message : "unknown" }));
      });
    }
  }
  return json({ ok: true, message: "If that account exists, a reset email will arrive shortly." }, { status: 202 });
}

async function handleResetAccept(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ token?: unknown; password?: unknown }>(request);
  if (typeof body.token !== "string" || typeof body.password !== "string") throw new HttpError(400, "invalid_reset", "The reset request is invalid.");
  const token = body.token;
  const policy = validatePassword(body.password); if (!policy.valid) throw new HttpError(400, "invalid_password", policy.message);
  const digest = await digestToken(token); const now = new Date().toISOString();
  const reset = await env.DB.prepare(`SELECT user_id AS userId FROM password_reset_tokens
    WHERE token_digest = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > ?`).bind(digest, now).first<{ userId: string }>();
  if (!reset) throw new HttpError(404, "reset_unavailable", "This reset link is invalid or has expired.");
  const passwordHash = await hashPassword(body.password, env.AUTH_PEPPER, passwordIterations(env));
  const results = await env.DB.batch([
    env.DB.prepare(`UPDATE auth_credentials SET password_hash = ?, password_changed_at = ?, updated_at = ? WHERE user_id = ?
      AND EXISTS (SELECT 1 FROM password_reset_tokens WHERE token_digest = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > ?)`).bind(passwordHash, now, now, reset.userId, digest, now),
    env.DB.prepare("UPDATE password_reset_tokens SET used_at = ? WHERE token_digest = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > ?").bind(now, digest, now),
    env.DB.prepare("UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL").bind(now, reset.userId),
  ]);
  if ((results[0].meta.changes ?? 0) !== 1 || (results[1].meta.changes ?? 0) !== 1) throw new HttpError(409, "reset_unavailable", "This reset link is invalid or has already been used.");
  return json({ ok: true });
}

async function validInvitation(env: Env, token: string) {
  if (token.length < 40 || token.length > 128) return null;
  const digest = await digestToken(token); const now = new Date().toISOString();
  return env.DB.prepare(`SELECT i.user_id AS userId, i.email_snapshot AS email, i.expires_at AS expiresAt, u.display_name AS displayName
    FROM account_invitations i JOIN users u ON u.id = i.user_id
    WHERE i.token_digest = ? AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > ? AND u.is_active = 1`).bind(digest, now).first<{ userId: string; email: string; expiresAt: string; displayName: string }>();
}

async function requireRole(request: Request, env: Env, role: SessionUser["roles"][number]): Promise<SessionUser> {
  const user = await currentUser(request, env);
  if (!user) throw new HttpError(401, "unauthenticated", "Please sign in.");
  if (!user.roles.includes(role)) throw new HttpError(403, "forbidden", "You do not have access to this action.");
  return user;
}

async function userWithRoles(env: Env, userId: string): Promise<SessionUser> {
  const rows = await env.DB.prepare(`SELECT u.id, u.email, u.display_name AS displayName, r.key AS roleKey FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.revoked_at IS NULL LEFT JOIN roles r ON r.id = ur.role_id WHERE u.id = ?`).bind(userId).all<{ id: string; email: string; displayName: string; roleKey: SessionUser["roles"][number] | null }>();
  const first = rows.results[0]; if (!first) throw new HttpError(404, "user_not_found", "User not found.");
  return { id: first.id, email: first.email, displayName: first.displayName, roles: rows.results.flatMap((row) => row.roleKey ? [row.roleKey] : []) };
}

async function audit(env: Env, actorUserId: string | null, action: string, resourceType: string, resourceId: string | null, outcome: string): Promise<void> {
  await env.DB.prepare("INSERT INTO audit_logs (id, occurred_at, actor_user_id, action, resource_type, resource_id, outcome) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), new Date().toISOString(), actorUserId, action, resourceType, resourceId, outcome).run();
}

function normalizeEmail(email: string): string { return email.trim().toLowerCase(); }
function passwordIterations(env: Env): number { return Number.parseInt(env.PASSWORD_PBKDF2_ITERATIONS, 10); }
