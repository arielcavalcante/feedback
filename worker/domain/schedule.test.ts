import { describe, expect, it } from "vitest";
import { cycleTiming, nextOrSameWorkday, previousOrSameWorkday } from "./schedule";
const schedule = { anchorOpenLocalDate: "2026-11-09", intervalDays: 7, timezone: "America/Fortaleza", openLocalTime: "00:00:00", closeLocalTime: "23:59:59", reportLocalTime: "09:00:00" };
describe("cycleTiming", () => {
  it("opens Monday 00:00, closes Sunday 23:59:59 and reports the next Monday 09:00", () => {
    expect(cycleTiming(schedule, 0, new Set())).toMatchObject({ openLocalDate: "2026-11-09", closeLocalDate: "2026-11-15", reportLocalDate: "2026-11-16", opensAt: "2026-11-09T03:00:00.000Z", closesAt: "2026-11-16T02:59:59.000Z", reportAt: "2026-11-16T12:00:00.000Z" });
    expect(cycleTiming(schedule, 1, new Set()).openLocalDate).toBe("2026-11-16");
  });
  it("leaves no gap between consecutive weekly cycles", () => {
    const first = cycleTiming(schedule, 0, new Set()); const second = cycleTiming(schedule, 1, new Set());
    expect(Date.parse(second.opensAt) - Date.parse(first.closesAt)).toBe(1000);
  });
  it("moves a holiday report email to the next workday", () => { const timing = cycleTiming(schedule, 0, new Set(["2026-11-16"])); expect(timing.coordinatorEmailLocalDate).toBe("2026-11-17"); expect(timing.reportLocalDate).toBe("2026-11-16"); });
  it("walks across weekends and consecutive holidays", () => { expect(previousOrSameWorkday("2026-09-21", new Set(["2026-09-21", "2026-09-18"]))).toBe("2026-09-17"); expect(nextOrSameWorkday("2026-09-18", new Set(["2026-09-18", "2026-09-21"]))).toBe("2026-09-22"); });
});
