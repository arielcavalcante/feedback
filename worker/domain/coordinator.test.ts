import { describe, expect, it } from "vitest";
import { summarizeTeam, type CohortRow } from "./coordinator";

const now = "2026-11-14T15:00:00.000Z"; // Saturday, during an open cycle
const row = (overrides: Partial<CohortRow>): CohortRow => ({
  cycleId: "c", teamId: "t", teamName: "Time", threshold: 3, eligibleCount: 6, submittedCount: 0,
  opensAt: "2026-11-13T12:00:00.000Z", closesAt: "2026-11-16T02:59:59.000Z", reportAt: "2026-11-16T12:00:00.000Z", ...overrides,
});
const past = (submittedCount: number) => row({ cycleId: "past", submittedCount, opensAt: "2026-10-30T12:00:00.000Z", closesAt: "2026-11-02T02:59:59.000Z", reportAt: "2026-11-02T12:00:00.000Z" });

describe("coordinator cohort projection", () => {
  it("hides results at threshold n-1 and shows them at n and n+1", () => {
    expect(summarizeTeam([past(2)], now).latestReported).toEqual(expect.objectContaining({ ready: false }));
    expect(summarizeTeam([past(2)], now).latestReported).not.toHaveProperty("responseCount");
    expect(summarizeTeam([past(3)], now).latestReported).toEqual(expect.objectContaining({ ready: true, responseCount: 3 }));
    expect(summarizeTeam([past(4)], now).latestReported).toEqual(expect.objectContaining({ ready: true, responseCount: 4 }));
  });

  it("exposes only whether an open cycle reached the minimum, never the count", () => {
    const below = summarizeTeam([row({ submittedCount: 2 })], now).openCycle;
    const above = summarizeTeam([row({ submittedCount: 5 })], now).openCycle;
    expect(below).toEqual(expect.objectContaining({ thresholdReached: false, participantCount: 6 }));
    expect(above).toEqual(expect.objectContaining({ thresholdReached: true }));
    expect(JSON.stringify(below)).not.toContain("submitted");
    expect(JSON.stringify(above)).not.toMatch(/\b5\b/);
  });

  it("never lowers protection below three responses", () => {
    expect(summarizeTeam([{ ...past(2), threshold: 1 }], now).latestReported?.ready).toBe(false);
  });

  it("keeps a closed cycle hidden until its report time", () => {
    const summary = summarizeTeam([past(4)], "2026-11-02T05:00:00.000Z");
    expect(summary.awaitingReport).toEqual(expect.objectContaining({ cycleId: "past" }));
    expect(summary.latestReported).toBeNull();
  });
});
