// Development-only fetch interceptor for `pnpm dev:mock`. It mirrors the response shapes and
// authorization rules of worker/index.ts with fictional data, so no Worker, D1, or secrets are needed.
import { devStore, DEV_PERSONAS } from "./store";
import { employeeConversations, handleOrg, recordComplaint, signThisWeek, thisWeekSigned } from "./mockOrg";

type Body = Record<string, unknown>;
const LATENCY_MS = 220;
const DAY = 86_400_000;

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}
const fail = (status: number, code: string, message: string) => respond({ error: { code, message } }, status);

/** Current weekly cycle: Monday 00:00 to Sunday 23:59:59 in America/Fortaleza (UTC-3, no DST). */
function cycleWindow(now = new Date()) {
  const local = new Date(now.getTime() - 3 * 3_600_000);
  const sinceMonday = (local.getUTCDay() + 6) % 7;
  const monday = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - sinceMonday);
  return { opensAt: new Date(monday + 3 * 3_600_000), closesAt: new Date(monday + 7 * DAY + 2 * 3_600_000 + 59 * 60_000 + 59_000) };
}

function employeeDashboard() {
  const { cycleOpen, submitted } = devStore.get();
  const { opensAt, closesAt } = cycleWindow();
  const statuses = ["done", "done", "skipped", "done", "skipped", "done"] as const;
  const coordinator = DEV_PERSONAS.coordinator.displayName;
  return {
    team: { name: "Praia Sertão — Produto", coordinatorName: coordinator },
    answeredThisWeek: !cycleOpen || submitted,
    thisWeek: !cycleOpen || submitted ? { cycleId: "dev-cycle-current", closesAt: closesAt.toISOString(), signed: thisWeekSigned() } : null,
    ...employeeConversations(DEV_PERSONAS.employee.id),
    activeCycle: cycleOpen && !submitted ? {
      id: "dev-cycle-current",
      opensAt: opensAt.toISOString(),
      closesAt: closesAt.toISOString(),
      teamName: "Praia Sertão — Produto",
      coordinatorName: coordinator,
    } : null,
    history: statuses.map((status, index) => ({
      cycleId: `dev-cycle-${index + 1}`,
      opensAt: new Date(opensAt.getTime() - (index + 1) * 7 * DAY).toISOString(),
      status,
    })),
  };
}

function requireRole(role: "admin" | "coordinator" | "employee") {
  const { signedIn } = devStore.get();
  if (!signedIn) return fail(401, "unauthenticated", "Please sign in.");
  if (!devStore.persona().roles.includes(role)) return fail(403, "forbidden", "You do not have access to this action.");
  return null;
}

const validPassword = (value: unknown) => typeof value === "string" && value.length >= 15 && value.length <= 128;

function handle(method: string, path: string, body: Body): Response {
  const route = `${method} ${path}`;
  switch (route) {
    case "GET /api/health":
      return respond({ status: "ok", service: "feedback-mock", time: new Date().toISOString() });
    case "GET /api/auth/me":
      return devStore.get().signedIn ? respond({ user: devStore.persona() }) : fail(401, "unauthenticated", "Please sign in.");
    case "POST /api/auth/login":
      if (typeof body.email !== "string" || !body.email || typeof body.password !== "string" || !body.password) {
        return fail(401, "invalid_credentials", "The email or password is incorrect.");
      }
      devStore.patch({ signedIn: true });
      return respond({ user: devStore.persona() });
    case "POST /api/auth/logout":
      devStore.patch({ signedIn: false });
      return respond({ ok: true });
    case "POST /api/auth/password-reset/request":
      return respond({ ok: true, message: "If that account exists, a reset email will arrive shortly." }, 202);
    case "POST /api/auth/password-reset/accept":
      return validPassword(body.password) ? respond({ ok: true }) : fail(400, "invalid_password", "Use at least 15 characters.");
    case "POST /api/auth/invitations/resolve": {
      const persona = DEV_PERSONAS.employee;
      return respond({ invitation: { email: persona.email, displayName: persona.displayName, expiresAt: new Date(Date.now() + 2 * DAY).toISOString() } });
    }
    case "POST /api/auth/invitations/accept":
      if (!validPassword(body.password)) return fail(400, "invalid_password", "Use at least 15 characters.");
      devStore.patch({ role: "employee", signedIn: true });
      return respond({ user: DEV_PERSONAS.employee }, 201);
    case "POST /api/employee/complaints": {
      const denied = requireRole("employee");
      if (denied) return denied;
      const reply = recordComplaint(body);
      return respond(reply.data, reply.status);
    }
    case "GET /api/employee/dashboard":
      return requireRole("employee") ?? respond(employeeDashboard());
    case "POST /api/employee/feedback": {
      const denied = requireRole("employee");
      if (denied) return denied;
      const ratings = [body.coordinator, body.team, body.work];
      if (!ratings.every((rating) => Number.isInteger(rating) && Number(rating) >= 1 && Number(rating) <= 5)) {
        return fail(400, "invalid_feedback", "Rate every feedback area from 1 to 5.");
      }
      const { cycleOpen, submitted } = devStore.get();
      if (!cycleOpen || body.cycleId !== "dev-cycle-current") return fail(404, "feedback_unavailable", "This feedback cycle is not available.");
      if (submitted) return fail(409, "feedback_submitted", "You already completed this feedback cycle.");
      devStore.patch({ submitted: true });
      if (body.signed === true) signThisWeek(DEV_PERSONAS.employee.id, { coordinator: Number(body.coordinator), team: Number(body.team), work: Number(body.work), comment: typeof body.comment === "string" && body.comment.trim() ? body.comment.trim() : null });
      return respond({ ok: true }, 201);
    }
    case "POST /api/employee/feedback/sign": {
      const denied = requireRole("employee");
      if (denied) return denied;
      const { cycleOpen, submitted } = devStore.get();
      if (!(submitted || !cycleOpen) || thisWeekSigned()) return fail(409, "cannot_sign", "This check-in can no longer be signed.");
      signThisWeek(DEV_PERSONAS.employee.id, { coordinator: 3, team: 4, work: 3, comment: null });
      return respond({ ok: true });
    }
    default: {
      const reply = handleOrg(method, path, body);
      return reply ? respond(reply.data, reply.status) : fail(404, "not_found", "Route not found.");
    }
  }
}

function parseBody(body: BodyInit | null | undefined): Body {
  if (typeof body !== "string") return {};
  try { return JSON.parse(body) as Body; } catch { return {}; }
}

const originalFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(href, window.location.origin);
  if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/")) return originalFetch(input, init);
  await new Promise((resolve) => window.setTimeout(resolve, LATENCY_MS));
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  return handle(method, url.pathname, parseBody(init?.body));
};
