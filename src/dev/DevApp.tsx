// Entry for `pnpm dev:mock`: fictional API + role bar around the real App.
// main.tsx imports this module only when Vite runs with `--mode mock`, so production builds never include it.
import "./mockApi";
import "./devBar.css";
import { useSyncExternalStore } from "react";
import { App } from "../App";
import { COORDINATOR_SCENARIOS, devStore, type CoordinatorScenario, type DevRole, type DevState } from "./store";

document.documentElement.classList.add("has-dev-bar");

const ROLES: Array<{ role: DevRole; label: string }> = [
  { role: "admin", label: "Admin" },
  { role: "coordinator", label: "Coordenador" },
  { role: "employee", label: "Funcionário" },
];

export function DevApp() {
  const state = useSyncExternalStore(devStore.subscribe, devStore.get);
  return (
    <>
      <DevRoleBar state={state} />
      <App key={state.version} />
    </>
  );
}

function DevRoleBar({ state }: { state: DevState }) {
  const persona = devStore.persona();
  return (
    <div className="ino-dev-bar" role="region" aria-label="Ferramentas de desenvolvimento">
      <span className="ino-dev-bar__badge">Dev</span>
      <div className="ino-dev-bar__group" role="group" aria-label="Navegar como">
        <span className="ino-dev-bar__label">Navegar como</span>
        {ROLES.map(({ role, label }) => {
          const active = state.signedIn && state.role === role;
          return (
            <button
              key={role}
              type="button"
              className="ino-dev-bar__role"
              aria-pressed={active}
              onClick={() => { if (!active) devStore.navigate({ role, signedIn: true }); }}
            >
              {label}
            </button>
          );
        })}
        <button
          type="button"
          className="ino-dev-bar__role"
          aria-pressed={!state.signedIn}
          onClick={() => { if (state.signedIn) devStore.navigate({ signedIn: false }); }}
        >
          Deslogado
        </button>
      </div>
      <span className="ino-dev-bar__divider" aria-hidden="true" />
      {state.signedIn && state.role === "employee" && (
        <label className="ino-dev-bar__toggle">
          <input type="checkbox" checked={state.cycleOpen} onChange={(event) => devStore.navigate({ cycleOpen: event.target.checked, submitted: false })} />
          Avaliação pendente
        </label>
      )}
      {state.signedIn && state.role === "coordinator" && (
        <label className="ino-dev-bar__toggle">
          Cenário
          <select value={state.coordinatorScenario} onChange={(event) => devStore.navigate({ coordinatorScenario: event.target.value as CoordinatorScenario })}>
            {Object.entries(COORDINATOR_SCENARIOS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
      )}
      <label className="ino-dev-bar__toggle">
        <input type="checkbox" checked={state.showIntro} onChange={(event) => devStore.navigate({ showIntro: event.target.checked })} />
        Mostrar intro
      </label>
      {state.signedIn && <span className="ino-dev-bar__who" title={persona.email}>{persona.displayName}</span>}
    </div>
  );
}
