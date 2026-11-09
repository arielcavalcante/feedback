import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { LocaleProvider } from "./i18n";
import "./styles.css";

const root = createRoot(document.getElementById("root")!);
const render = (children: ReactNode) => root.render(
  <StrictMode>
    <LocaleProvider>{children}</LocaleProvider>
  </StrictMode>,
);

// `pnpm dev:mock` only: Vite replaces MODE at build time, so this branch and the dev module
// are dropped from production bundles (scripts/assert-safe-build.mjs checks it).
if (import.meta.env.MODE === "mock") void import("./dev/DevApp").then(({ DevApp }) => render(<DevApp />));
else render(<App />);
