// Development-only state for `pnpm dev:mock`. Never imported by the production bundle.
import type { CurrentUser } from "../api";

export type DevRole = CurrentUser["roles"][number];
export const COORDINATOR_SCENARIOS = {
  ready: "Resultado pronto",
  open_below: "Ciclo aberto · mínimo não atingido",
  open_reached: "Ciclo aberto · mínimo atingido",
  awaiting: "Fechou · aguardando segunda",
  insufficient: "Último ciclo sem mínimo",
  empty: "Nenhum ciclo fechado",
  no_team: "Sem equipe",
} as const;
export type CoordinatorScenario = keyof typeof COORDINATOR_SCENARIOS;
export type DevState = {
  role: DevRole;
  signedIn: boolean;
  cycleOpen: boolean;
  submitted: boolean;
  showIntro: boolean;
  coordinatorScenario: CoordinatorScenario;
  checkinsPaused: boolean;
  pausedSince: string | null;
  /** Bumped by bar actions to remount the app with fresh data. */
  version: number;
};

export const DEV_PERSONAS: Record<DevRole, CurrentUser> = {
  admin: { id: "dev-admin", email: "renata.admin@dev.local", displayName: "Renata Moreira", roles: ["admin"] },
  coordinator: { id: "dev-coordinator", email: "davi.coordenacao@dev.local", displayName: "Davi Holanda", roles: ["coordinator"] },
  employee: { id: "dev-employee", email: "lia.fernandes@dev.local", displayName: "Lia Fernandes", roles: ["employee"] },
};

const STORAGE_KEY = "feedback:dev-state";
const DEFAULTS: DevState = { role: "employee", signedIn: true, cycleOpen: true, submitted: false, showIntro: false, coordinatorScenario: "open_below", checkinsPaused: false, pausedSince: null, version: 0 };
const introKey = (userId: string) => `feedback:intro-completed:${userId}`;

function load(): DevState {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") }; } catch { return DEFAULTS; }
}

/** Keeps the first-visit introduction in sync with the bar toggle before the app mounts. */
function syncIntro(next: DevState) {
  try {
    for (const persona of Object.values(DEV_PERSONAS)) {
      if (next.showIntro) localStorage.removeItem(introKey(persona.id));
      else localStorage.setItem(introKey(persona.id), "1");
    }
  } catch { /* Storage can be unavailable; the intro then follows the app default. */ }
}

let state = load();
syncIntro(state);
const listeners = new Set<() => void>();

function commit(next: DevState) {
  state = next;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* In-memory state still works. */ }
  listeners.forEach((listener) => listener());
}

export const devStore = {
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  /** Updates state from inside the mock API without remounting the app. */
  patch(patch: Partial<DevState>) { commit({ ...state, ...patch }); },
  /** Updates state from the dev bar and remounts the app so it reloads like a fresh visit. */
  navigate(patch: Partial<DevState>) {
    const next = { ...state, ...patch, version: state.version + 1 };
    syncIntro(next);
    commit(next);
  },
  persona: () => DEV_PERSONAS[state.role],
};
