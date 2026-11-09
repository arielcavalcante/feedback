// Organization administration: people, access profiles (roles), teams, and coordinator assignments.
// These endpoints never read survey submissions or answers (docs/PRIVACY.md invariant 9).
import type { Env } from "./env";
import { audit, parseRoles, requireRole, ROLE_KEYS, type RoleKey } from "./access";
import { HttpError, json, readJson } from "./http";

type UserRow = {
  id: string;
  email: string;
  displayName: string;
  isActive: number;
  hasPassword: number;
  invitationExpiresAt: string | null;
  roleKeys: string | null;
  teamId: string | null;
};

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  roles: RoleKey[];
  teamId: string | null;
  status: "active" | "invited" | "invite_expired" | "inactive";
};

const USER_SELECT = `SELECT u.id, u.email, u.display_name AS displayName, u.is_active AS isActive,
    EXISTS (SELECT 1 FROM auth_credentials c WHERE c.user_id = u.id) AS hasPassword,
    (SELECT MAX(i.expires_at) FROM account_invitations i WHERE i.user_id = u.id AND i.accepted_at IS NULL AND i.revoked_at IS NULL) AS invitationExpiresAt,
    (SELECT GROUP_CONCAT(r.key) FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id AND ur.revoked_at IS NULL) AS roleKeys,
    (SELECT tm.team_id FROM team_members tm WHERE tm.user_id = u.id AND tm.ends_at IS NULL ORDER BY tm.starts_at DESC LIMIT 1) AS teamId
  FROM users u`;

export function projectUser(row: UserRow, now = new Date().toISOString()): AdminUser {
  const roles = (row.roleKeys?.split(",") ?? []).filter((role): role is RoleKey => (ROLE_KEYS as readonly string[]).includes(role));
  const status = !row.isActive ? "inactive" : row.hasPassword ? "active" : row.invitationExpiresAt && row.invitationExpiresAt > now ? "invited" : "invite_expired";
  return { id: row.id, email: row.email, displayName: row.displayName, roles: ROLE_KEYS.filter((role) => roles.includes(role)), teamId: row.teamId, status };
}

export async function handleAdminUsers(request: Request, env: Env): Promise<Response> {
  await requireRole(request, env, "admin");
  const rows = await env.DB.prepare(`${USER_SELECT} ORDER BY u.is_active DESC, u.display_name COLLATE NOCASE`).all<UserRow>();
  const now = new Date().toISOString();
  return json({ users: rows.results.map((row) => projectUser(row, now)) });
}

async function loadUser(env: Env, userId: string): Promise<AdminUser | null> {
  const row = await env.DB.prepare(`${USER_SELECT} WHERE u.id = ?`).bind(userId).first<UserRow>();
  return row ? projectUser(row) : null;
}

/** Validates an optional team reference: `undefined` = unchanged, `null` = no team, string = active team id. */
export async function validTeamId(env: Env, value: unknown): Promise<string | null | undefined> {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new HttpError(400, "invalid_team", "Choose a valid team.");
  const team = await env.DB.prepare("SELECT id FROM teams WHERE id = ? AND is_active = 1").bind(value).first<{ id: string }>();
  if (!team) throw new HttpError(400, "invalid_team", "Choose a valid team.");
  return team.id;
}

/** Grants the listed roles and revokes the others, keeping grant history. */
export function roleStatements(env: Env, userId: string, roles: readonly RoleKey[], actorId: string, now: string): D1PreparedStatement[] {
  return ROLE_KEYS.map((role) => roles.includes(role)
    ? env.DB.prepare(`INSERT INTO user_roles (user_id, role_id, granted_at, granted_by_user_id)
        SELECT ?, id, ?, ? FROM roles WHERE key = ?
        ON CONFLICT(user_id, role_id) DO UPDATE SET revoked_at = NULL, granted_at = excluded.granted_at, granted_by_user_id = excluded.granted_by_user_id
        WHERE user_roles.revoked_at IS NOT NULL`).bind(userId, now, actorId, role)
    : env.DB.prepare(`UPDATE user_roles SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL
        AND role_id = (SELECT id FROM roles WHERE key = ?)`).bind(now, userId, role));
}

/** MVP rule (docs/SETUP.md §7): one current team membership per person. */
export function membershipStatements(env: Env, userId: string, teamId: string | null, actorId: string, now: string): D1PreparedStatement[] {
  const statements = [env.DB.prepare(`UPDATE team_members SET ends_at = ? WHERE user_id = ? AND ends_at IS NULL AND team_id IS NOT ?`).bind(now, userId, teamId)];
  if (teamId) statements.push(env.DB.prepare(`INSERT INTO team_members (id, team_id, user_id, starts_at, created_at, created_by_user_id)
    SELECT ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM team_members WHERE user_id = ? AND team_id = ? AND ends_at IS NULL)`)
    .bind(crypto.randomUUID(), teamId, userId, now, now, actorId, userId, teamId));
  return statements;
}

export async function handleAdminUpdateUser(request: Request, env: Env, userId: string): Promise<Response> {
  const actor = await requireRole(request, env, "admin");
  const body = await readJson<{ displayName?: unknown; roles?: unknown; isActive?: unknown; teamId?: unknown }>(request);
  const target = await loadUser(env, userId);
  if (!target) throw new HttpError(404, "user_not_found", "User not found.");

  const displayName = body.displayName === undefined ? undefined : typeof body.displayName === "string" ? body.displayName.trim() : "";
  if (displayName !== undefined && (displayName.length < 2 || displayName.length > 120)) throw new HttpError(400, "invalid_user", "Provide a valid email, name, and role.");
  const roles = body.roles === undefined ? undefined : parseRoles(body.roles);
  if (roles === null) throw new HttpError(400, "invalid_user", "Provide a valid email, name, and role.");
  if (body.isActive !== undefined && typeof body.isActive !== "boolean") throw new HttpError(400, "invalid_user", "Provide a valid email, name, and role.");
  const isActive = body.isActive as boolean | undefined;
  const teamId = await validTeamId(env, body.teamId);

  // An administrator cannot lock themselves out; this also guarantees at least one active admin remains.
  if (userId === actor.id && (isActive === false || (roles && !roles.includes("admin")))) {
    throw new HttpError(409, "self_lockout", "You can’t remove your own admin access.");
  }

  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];
  if (displayName !== undefined) statements.push(env.DB.prepare("UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?").bind(displayName, now, userId));
  if (roles) {
    statements.push(...roleStatements(env, userId, roles, actor.id, now));
    if (!roles.includes("coordinator")) statements.push(env.DB.prepare("UPDATE team_coordinators SET ends_at = ? WHERE user_id = ? AND ends_at IS NULL").bind(now, userId));
  }
  if (teamId !== undefined) statements.push(...membershipStatements(env, userId, teamId, actor.id, now));
  if (isActive === false && target.status !== "inactive") {
    statements.push(
      env.DB.prepare("UPDATE users SET is_active = 0, deactivated_at = ?, updated_at = ? WHERE id = ?").bind(now, now, userId),
      env.DB.prepare("UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL").bind(now, userId),
      env.DB.prepare("UPDATE account_invitations SET revoked_at = ? WHERE user_id = ? AND accepted_at IS NULL AND revoked_at IS NULL").bind(now, userId),
      env.DB.prepare("UPDATE password_reset_tokens SET revoked_at = ? WHERE user_id = ? AND used_at IS NULL AND revoked_at IS NULL").bind(now, userId),
      env.DB.prepare("UPDATE team_members SET ends_at = ? WHERE user_id = ? AND ends_at IS NULL").bind(now, userId),
      env.DB.prepare("UPDATE team_coordinators SET ends_at = ? WHERE user_id = ? AND ends_at IS NULL").bind(now, userId),
    );
  }
  if (isActive === true && target.status === "inactive") {
    statements.push(env.DB.prepare("UPDATE users SET is_active = 1, deactivated_at = NULL, updated_at = ? WHERE id = ?").bind(now, userId));
  }
  if (statements.length) await env.DB.batch(statements);
  const action = isActive === false ? "admin.user_deactivated" : isActive === true ? "admin.user_reactivated" : "admin.user_updated";
  await audit(env, actor.id, action, "user", userId, "success");
  return json({ user: await loadUser(env, userId) });
}

type TeamRow = { id: string; name: string; isActive: number; coordinatorUserId: string | null; memberCount: number };
export type AdminTeam = { id: string; name: string; isActive: boolean; coordinatorUserId: string | null; memberCount: number };

const TEAM_SELECT = `SELECT t.id, t.name, t.is_active AS isActive,
    (SELECT tc.user_id FROM team_coordinators tc WHERE tc.team_id = t.id AND tc.ends_at IS NULL ORDER BY tc.is_primary DESC, tc.starts_at LIMIT 1) AS coordinatorUserId,
    (SELECT COUNT(*) FROM team_members tm JOIN users u ON u.id = tm.user_id WHERE tm.team_id = t.id AND tm.ends_at IS NULL AND u.is_active = 1) AS memberCount
  FROM teams t`;

const projectTeam = (row: TeamRow): AdminTeam => ({ ...row, isActive: Boolean(row.isActive) });

export async function handleAdminTeams(request: Request, env: Env): Promise<Response> {
  await requireRole(request, env, "admin");
  const rows = await env.DB.prepare(`${TEAM_SELECT} ORDER BY t.is_active DESC, t.name COLLATE NOCASE`).all<TeamRow>();
  return json({ teams: rows.results.map(projectTeam) });
}

async function validCoordinator(env: Env, value: unknown): Promise<string | null | undefined> {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new HttpError(400, "invalid_coordinator", "Choose an active person with the coordinator profile.");
  const row = await env.DB.prepare(`SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id = u.id AND ur.revoked_at IS NULL
    JOIN roles r ON r.id = ur.role_id AND r.key = 'coordinator' WHERE u.id = ? AND u.is_active = 1`).bind(value).first<{ id: string }>();
  if (!row) throw new HttpError(400, "invalid_coordinator", "Choose an active person with the coordinator profile.");
  return row.id;
}

function coordinatorStatements(env: Env, teamId: string, coordinatorId: string | null, actorId: string, now: string): D1PreparedStatement[] {
  const statements = [env.DB.prepare("UPDATE team_coordinators SET ends_at = ? WHERE team_id = ? AND ends_at IS NULL AND user_id IS NOT ?").bind(now, teamId, coordinatorId)];
  if (coordinatorId) statements.push(env.DB.prepare(`INSERT INTO team_coordinators (id, team_id, user_id, starts_at, is_primary, created_at, created_by_user_id)
    SELECT ?, ?, ?, ?, 1, ?, ? WHERE NOT EXISTS (SELECT 1 FROM team_coordinators WHERE team_id = ? AND user_id = ? AND ends_at IS NULL)`)
    .bind(crypto.randomUUID(), teamId, coordinatorId, now, now, actorId, teamId, coordinatorId));
  return statements;
}

function teamName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (name.length < 2 || name.length > 80) throw new HttpError(400, "invalid_team", "Give the team a name between 2 and 80 characters.");
  return name;
}

export async function handleAdminCreateTeam(request: Request, env: Env): Promise<Response> {
  const actor = await requireRole(request, env, "admin");
  const body = await readJson<{ name?: unknown; coordinatorUserId?: unknown }>(request);
  const name = teamName(body.name);
  const coordinatorId = await validCoordinator(env, body.coordinatorUserId);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO teams (id, name, is_active, created_at, updated_at) VALUES (?, ?, 1, ?, ?)").bind(id, name, now, now),
    ...(coordinatorId ? coordinatorStatements(env, id, coordinatorId, actor.id, now) : []),
  ]);
  await audit(env, actor.id, "admin.team_created", "team", id, "success");
  const row = await env.DB.prepare(`${TEAM_SELECT} WHERE t.id = ?`).bind(id).first<TeamRow>();
  return json({ team: row && projectTeam(row) }, { status: 201 });
}

export async function handleAdminUpdateTeam(request: Request, env: Env, teamId: string): Promise<Response> {
  const actor = await requireRole(request, env, "admin");
  const body = await readJson<{ name?: unknown; coordinatorUserId?: unknown; isActive?: unknown }>(request);
  const team = await env.DB.prepare("SELECT id, is_active AS isActive FROM teams WHERE id = ?").bind(teamId).first<{ id: string; isActive: number }>();
  if (!team) throw new HttpError(404, "team_not_found", "Team not found.");
  if (body.isActive !== undefined && typeof body.isActive !== "boolean") throw new HttpError(400, "invalid_team", "Give the team a name between 2 and 80 characters.");
  const name = body.name === undefined ? undefined : teamName(body.name);
  const coordinatorId = await validCoordinator(env, body.coordinatorUserId);
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];
  if (name !== undefined) statements.push(env.DB.prepare("UPDATE teams SET name = ?, updated_at = ? WHERE id = ?").bind(name, now, teamId));
  if (coordinatorId !== undefined) statements.push(...coordinatorStatements(env, teamId, coordinatorId, actor.id, now));
  if (body.isActive === false && team.isActive) {
    // Ending assignments keeps history while leaving members free to join another team.
    statements.push(
      env.DB.prepare("UPDATE teams SET is_active = 0, updated_at = ? WHERE id = ?").bind(now, teamId),
      env.DB.prepare("UPDATE team_members SET ends_at = ? WHERE team_id = ? AND ends_at IS NULL").bind(now, teamId),
      env.DB.prepare("UPDATE team_coordinators SET ends_at = ? WHERE team_id = ? AND ends_at IS NULL").bind(now, teamId),
    );
  }
  if (body.isActive === true && !team.isActive) statements.push(env.DB.prepare("UPDATE teams SET is_active = 1, updated_at = ? WHERE id = ?").bind(now, teamId));
  if (statements.length) await env.DB.batch(statements);
  await audit(env, actor.id, body.isActive === false ? "admin.team_deactivated" : "admin.team_updated", "team", teamId, "success");
  const row = await env.DB.prepare(`${TEAM_SELECT} WHERE t.id = ?`).bind(teamId).first<TeamRow>();
  return json({ team: row && projectTeam(row) });
}
