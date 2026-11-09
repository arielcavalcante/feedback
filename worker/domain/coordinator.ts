// Pure privacy projection for coordinator views. Raw counts stay inside the Worker; only the
// fields documented in docs/PRIVACY.md and ADR-023 leave this module.

export type CohortRow = {
  cycleId: string;
  teamId: string;
  teamName: string;
  opensAt: string;
  closesAt: string;
  reportAt: string;
  threshold: number;
  eligibleCount: number;
  submittedCount: number;
};

export type DimensionAverages = { coordinator: number; team: number; work: number };

export type TeamCohortSummary = {
  openCycle: null | { cycleId: string; opensAt: string; closesAt: string; participantCount: number; threshold: number; thresholdReached: boolean };
  awaitingReport: null | { cycleId: string; closesAt: string; reportAt: string };
  latestReported: null | { cycleId: string; opensAt: string; closesAt: string; threshold: number; ready: boolean; responseCount?: number };
  history: Array<{ cycleId: string; opensAt: string; status: "ready" | "insufficient_responses" }>;
};

/** The project-wide floor is 3 even if a snapshot was stored lower by mistake. */
export const effectiveThreshold = (threshold: number) => Math.max(3, threshold);
export const meetsThreshold = (row: Pick<CohortRow, "threshold" | "submittedCount">) => row.submittedCount >= effectiveThreshold(row.threshold);

/** Rows must belong to one team and be sorted by `opensAt` descending. */
export function summarizeTeam(rows: readonly CohortRow[], now: string): TeamCohortSummary {
  const open = rows.find((row) => row.opensAt <= now && row.closesAt > now);
  const awaiting = rows.find((row) => row.closesAt <= now && row.reportAt > now);
  const reported = rows.filter((row) => row.reportAt <= now);
  const latest = reported[0];
  return {
    openCycle: open ? {
      cycleId: open.cycleId, opensAt: open.opensAt, closesAt: open.closesAt,
      participantCount: open.eligibleCount, threshold: effectiveThreshold(open.threshold),
      // ADR-023: a single bit, never the exact count, while the cycle is open.
      thresholdReached: meetsThreshold(open),
    } : null,
    awaitingReport: awaiting ? { cycleId: awaiting.cycleId, closesAt: awaiting.closesAt, reportAt: awaiting.reportAt } : null,
    latestReported: latest ? {
      cycleId: latest.cycleId, opensAt: latest.opensAt, closesAt: latest.closesAt, threshold: effectiveThreshold(latest.threshold),
      ready: meetsThreshold(latest),
      ...(meetsThreshold(latest) ? { responseCount: latest.submittedCount } : {}),
    } : null,
    history: reported.map((row) => ({ cycleId: row.cycleId, opensAt: row.opensAt, status: meetsThreshold(row) ? "ready" as const : "insufficient_responses" as const })),
  };
}

export const roundAverage = (value: number) => Math.round(value * 10) / 10;
