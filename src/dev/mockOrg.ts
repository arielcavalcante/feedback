// Development-only fictional organization for `pnpm dev:mock`: admin CRUD and coordinator views.
// Mirrors worker/admin.ts and worker/coordinator.ts response shapes and guards.
import type { AdminTeam, AdminUser, CoordinatorComplaints, CoordinatorDashboardData, CoordinatorTeam, RoleKey } from "../types";
import { COMPLAINT_MAX_LENGTH, COMPLAINT_TOPIC_KEYS } from "../../shared/complaints";
import { devStore, DEV_PERSONAS } from "./store";

type Body = Record<string, unknown>;
type Reply = { status: number; data: unknown };
const ok = (data: unknown, status = 200): Reply => ({ status, data });
const fail = (status: number, code: string, message: string): Reply => ({ status, data: { error: { code, message } } });
const DAY = 86_400_000;
const ROLES: RoleKey[] = ["admin", "coordinator", "employee"];

const teams: AdminTeam[] = [
  { id: "team-produto", name: "Praia Sertão — Produto", isActive: true, coordinatorUserId: DEV_PERSONAS.coordinator.id, memberCount: 0 },
  { id: "team-atendimento", name: "Atendimento", isActive: true, coordinatorUserId: null, memberCount: 0 },
];
const users: AdminUser[] = [
  { ...pick(DEV_PERSONAS.admin), roles: ["admin"], teamId: null, status: "active" },
  { ...pick(DEV_PERSONAS.coordinator), roles: ["coordinator"], teamId: null, status: "active" },
  { ...pick(DEV_PERSONAS.employee), roles: ["employee"], teamId: "team-produto", status: "active" },
  { id: "dev-u4", email: "caio.rocha@dev.local", displayName: "Caio Rocha", roles: ["employee"], teamId: "team-produto", status: "active" },
  { id: "dev-u5", email: "bia.nogueira@dev.local", displayName: "Bia Nogueira", roles: ["employee"], teamId: "team-produto", status: "active" },
  { id: "dev-u6", email: "rui.matos@dev.local", displayName: "Rui Matos", roles: ["employee"], teamId: "team-produto", status: "invited" },
  { id: "dev-u7", email: "joana.lima@dev.local", displayName: "Joana Lima", roles: ["employee"], teamId: null, status: "invite_expired" },
  { id: "dev-u8", email: "pedro.alves@dev.local", displayName: "Pedro Alves", roles: ["employee", "coordinator"], teamId: null, status: "inactive" },
];

function pick(user: { id: string; email: string; displayName: string }) {
  return { id: user.id, email: user.email, displayName: user.displayName };
}

function teamsWithCounts(): AdminTeam[] {
  return teams.map((team) => ({ ...team, memberCount: users.filter((user) => user.teamId === team.id && user.status !== "inactive").length }));
}

function validRoles(value: unknown): RoleKey[] | null {
  if (!Array.isArray(value) || !value.length || !value.every((role) => ROLES.includes(role as RoleKey))) return null;
  return ROLES.filter((role) => value.includes(role));
}

function validTeam(value: unknown): string | null | undefined | false {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return teams.some((team) => team.id === value && team.isActive) ? value as string : false;
}

function requireAdmin(): Reply | null {
  if (!devStore.get().signedIn) return fail(401, "unauthenticated", "Please sign in.");
  return devStore.persona().roles.includes("admin") ? null : fail(403, "forbidden", "You do not have access to this action.");
}

export function handleOrg(method: string, path: string, body: Body): Reply | null {
  if (path.startsWith("/api/admin/")) {
    const denied = requireAdmin();
    if (denied) return denied;
    const actorId = devStore.persona().id;

    if (method === "GET" && path === "/api/admin/users") return ok({ users });
    if (method === "GET" && path === "/api/admin/teams") return ok({ teams: teamsWithCounts() });

    if (method === "POST" && path === "/api/admin/invitations") {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
      const roles = validRoles(body.roles);
      const teamId = validTeam(body.teamId);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || displayName.length < 2 || !roles) return fail(400, "invalid_user", "Provide a valid email, name, and role.");
      if (teamId === false) return fail(400, "invalid_team", "Choose a valid team.");
      const existing = users.find((user) => user.email === email);
      if (existing && (existing.status === "active" || existing.status === "inactive")) return fail(409, "user_exists", "This person already has an account.");
      const user: AdminUser = existing ?? { id: crypto.randomUUID(), email, displayName, roles, teamId: null, status: "invited" };
      Object.assign(user, { displayName, roles, status: "invited", ...(teamId !== undefined ? { teamId } : {}) });
      if (!existing) users.push(user);
      return ok({ invitation: { userId: user.id, email, expiresAt: new Date(Date.now() + 2 * DAY).toISOString(), actionUrl: `${location.origin}/accept-invite#token=dev-mock-token` } }, 201);
    }

    if (method === "POST" && path === "/api/admin/teams") {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (name.length < 2 || name.length > 80) return fail(400, "invalid_team", "Give the team a name between 2 and 80 characters.");
      const coordinator = body.coordinatorUserId ? users.find((user) => user.id === body.coordinatorUserId && user.status !== "inactive" && user.roles.includes("coordinator")) : null;
      if (body.coordinatorUserId && !coordinator) return fail(400, "invalid_coordinator", "Choose an active person with the coordinator profile.");
      const team: AdminTeam = { id: crypto.randomUUID(), name, isActive: true, coordinatorUserId: coordinator?.id ?? null, memberCount: 0 };
      teams.push(team);
      return ok({ team }, 201);
    }

    const match = path.match(/^\/api\/admin\/(users|teams)\/([A-Za-z0-9-]+)$/);
    if (method === "PATCH" && match?.[1] === "users") {
      const user = users.find((item) => item.id === match[2]);
      if (!user) return fail(404, "user_not_found", "User not found.");
      const roles = body.roles === undefined ? undefined : validRoles(body.roles);
      const teamId = validTeam(body.teamId);
      if (roles === null) return fail(400, "invalid_user", "Provide a valid email, name, and role.");
      if (teamId === false) return fail(400, "invalid_team", "Choose a valid team.");
      if (user.id === actorId && (body.isActive === false || (roles && !roles.includes("admin")))) return fail(409, "self_lockout", "You can’t remove your own admin access.");
      if (typeof body.displayName === "string") user.displayName = body.displayName.trim();
      if (roles) {
        user.roles = roles;
        if (!roles.includes("coordinator")) teams.forEach((team) => { if (team.coordinatorUserId === user.id) team.coordinatorUserId = null; });
      }
      if (teamId !== undefined) user.teamId = teamId;
      if (body.isActive === false) {
        user.status = "inactive"; user.teamId = null;
        teams.forEach((team) => { if (team.coordinatorUserId === user.id) team.coordinatorUserId = null; });
      }
      if (body.isActive === true && user.status === "inactive") user.status = "active";
      return ok({ user });
    }
    if (method === "PATCH" && match?.[1] === "teams") {
      const team = teams.find((item) => item.id === match[2]);
      if (!team) return fail(404, "team_not_found", "Team not found.");
      if (body.name !== undefined) {
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (name.length < 2 || name.length > 80) return fail(400, "invalid_team", "Give the team a name between 2 and 80 characters.");
        team.name = name;
      }
      if (body.coordinatorUserId !== undefined) {
        const coordinator = body.coordinatorUserId ? users.find((user) => user.id === body.coordinatorUserId && user.status !== "inactive" && user.roles.includes("coordinator")) : null;
        if (body.coordinatorUserId && !coordinator) return fail(400, "invalid_coordinator", "Choose an active person with the coordinator profile.");
        team.coordinatorUserId = coordinator?.id ?? null;
      }
      if (body.isActive === false) {
        team.isActive = false; team.coordinatorUserId = null;
        users.forEach((user) => { if (user.teamId === team.id) user.teamId = null; });
      }
      if (body.isActive === true) team.isActive = true;
      return ok({ team: teamsWithCounts().find((item) => item.id === team.id) });
    }
    return fail(404, "not_found", "Route not found.");
  }

  if (method === "GET" && path === "/api/coordinator/dashboard") {
    if (!devStore.get().signedIn) return fail(401, "unauthenticated", "Please sign in.");
    if (!devStore.persona().roles.includes("coordinator")) return fail(403, "forbidden", "You do not have access to this action.");
    return ok(coordinatorDashboard());
  }
  return null;
}

/** Weekly cycle `index` relative to the current one (Monday 00:00 → Sunday 23:59:59, report Monday 09:00, UTC-3). */
function cycleAt(index: number) {
  const local = new Date(Date.now() - 3 * 3_600_000);
  const monday = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - ((local.getUTCDay() + 6) % 7) + index * 7);
  return {
    opensAt: new Date(monday + 3 * 3_600_000).toISOString(),
    closesAt: new Date(monday + 7 * DAY + 2 * 3_600_000 + 59 * 60_000 + 59_000).toISOString(),
    reportAt: new Date(monday + 7 * DAY + 12 * 3_600_000).toISOString(),
  };
}

function coordinatorDashboard(): CoordinatorDashboardData {
  const scenario = devStore.get().coordinatorScenario;
  const team = teams.find((item) => item.id === "team-produto")!;
  const memberCount = users.filter((user) => user.teamId === team.id && user.status !== "inactive").length;
  const current = cycleAt(0);
  const pastHistory: CoordinatorTeam["history"] = [1, 2, 3, 4, 5].map((back, index) => ({
    cycleId: `dev-past-${back}`, opensAt: cycleAt(-back).opensAt, status: index === 2 ? "insufficient_responses" : "ready",
  }));
  const ready: CoordinatorTeam["latest"] = {
    cycleId: "dev-past-1", ...cycleAt(-1), threshold: 3, status: "ready", responseCount: 4,
    dimensions: { coordinator: 4.3, team: 4.6, work: 3.8 },
    comments: [
      "As dailies tão mais objetivas, ajudou muito.",
      "Sinto falta de mais clareza sobre prioridades quando chega demanda urgente.",
      "Time massa demais, mas a sexta tá pesada.",
    ],
  };
  const base: CoordinatorTeam = { id: team.id, name: team.name, memberCount, isCurrent: true, openCycle: null, awaitingReport: null, latest: null, history: [], complaints: sampleComplaints(scenario !== "empty") };
  const nextCycle = { opensAt: cycleAt(1).opensAt, closesAt: cycleAt(1).closesAt };
  const open = (thresholdReached: boolean) => ({ cycleId: "dev-now", opensAt: current.opensAt, closesAt: new Date(Date.now() + 2 * DAY).toISOString(), participantCount: 4, threshold: 3, thresholdReached });

  switch (scenario) {
    case "no_team": return { nextCycle, teams: [] };
    case "empty": return { nextCycle, teams: [base] };
    case "open_below": return { nextCycle, teams: [{ ...base, openCycle: open(false), latest: { cycleId: "dev-past-1", ...cycleAt(-1), threshold: 3, status: "insufficient_responses" }, history: [{ ...pastHistory[0], status: "insufficient_responses" }, ...pastHistory.slice(1)] }] };
    case "open_reached": return { nextCycle, teams: [{ ...base, openCycle: open(true), history: [] }] };
    case "awaiting": return { nextCycle, teams: [{ ...base, awaitingReport: { cycleId: "dev-now", closesAt: new Date(Date.now() - 3_600_000).toISOString(), reportAt: new Date(Date.now() + 9 * 3_600_000).toISOString() }, history: [] }] };
    case "insufficient": return { nextCycle, teams: [{ ...base, latest: { cycleId: "dev-past-1", ...cycleAt(-1), threshold: 3, status: "insufficient_responses" }, history: [{ ...pastHistory[0], status: "insufficient_responses" }, ...pastHistory.slice(1)] }] };
    default: return { nextCycle, teams: [{ ...base, latest: ready, history: pastHistory }] };
  }
}

// Complaints sent during this dev session; signed ones show up for the coordinator right away.
const sessionComplaints: CoordinatorComplaints["signed"] = [];

export function recordComplaint(body: Body): Reply {
  const topics = Array.isArray(body.topics) ? [...new Set(body.topics)] : [];
  if (!topics.length || !topics.every((topic) => typeof topic === "string" && COMPLAINT_TOPIC_KEYS.includes(topic))) return fail(400, "invalid_complaint", "Choose at least one topic.");
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) return fail(400, "invalid_complaint", "Write what’s bothering you.");
  if (text.length > COMPLAINT_MAX_LENGTH) return fail(400, "invalid_complaint", "That text is too long. Split it into two complaints.");
  if (body.signed) sessionComplaints.unshift({ id: crypto.randomUUID(), weekStart: mondayOf(0), authorName: devStore.persona().displayName, topics: (topics as string[]).sort(), body: text });
  return ok({ ok: true, signed: Boolean(body.signed) }, 201);
}

function mondayOf(weeksBack: number) {
  const local = new Date(Date.now() - 3 * 3_600_000);
  const monday = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - ((local.getUTCDay() + 6) % 7) - weeksBack * 7);
  return new Date(monday).toISOString().slice(0, 10);
}

function sampleComplaints(withSamples: boolean): CoordinatorComplaints {
  if (!withSamples) return { signed: [...sessionComplaints], anonymousWeeks: [], withheldWeeks: [] };
  return {
    signed: [
      ...sessionComplaints,
      { id: "s1", weekStart: mondayOf(0), authorName: "Caio Rocha", topics: ["equipment"], body: "Meu notebook tá desligando sozinho quando abro o Figma junto com o navegador. Já perdi trabalho duas vezes essa semana." },
    ],
    anonymousWeeks: [{
      weekStart: mondayOf(1),
      items: [
        { id: "a1", topics: ["working_conditions", "infrastructure"], body: "O ar-condicionado da sala do fundo tá pingando de novo, e à tarde fica impossível de trabalhar lá." },
        { id: "a2", topics: ["office_return"], body: "Voltar pro presencial todo dia tá pesando. Pelo menos um dia de casa já ajudaria muito." },
        { id: "a3", topics: ["software", "processes"], body: "A gente aprova a mesma coisa em três ferramentas diferentes. Dava pra simplificar esse fluxo." },
      ],
    }],
    withheldWeeks: [mondayOf(2)],
  };
}
