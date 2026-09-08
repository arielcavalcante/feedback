import { describe, expect, it } from "vitest";
import { cycleTiming, nextOrSameWorkday, previousOrSameWorkday } from "./schedule";
const schedule = { anchorOpenLocalDate: "2026-09-18", intervalDays: 14, timezone: "America/Fortaleza", openLocalTime: "09:00:00", closeLocalTime: "23:59:59", reportLocalTime: "09:00:00" };
describe("cycleTiming", () => {
  it("uses the approved anchor and repeats every fourteen days", () => { expect(cycleTiming(schedule, 0, new Set())).toMatchObject({ openLocalDate: "2026-09-18", closeLocalDate: "2026-09-20", reportLocalDate: "2026-09-21", opensAt: "2026-09-18T12:00:00.000Z", closesAt: "2026-09-21T02:59:59.000Z", reportAt: "2026-09-21T12:00:00.000Z" }); expect(cycleTiming(schedule, 1, new Set()).openLocalDate).toBe("2026-10-02"); });
  it("moves a Friday employee email to the previous workday", () => { const timing = cycleTiming(schedule, 0, new Set(["2026-09-18"])); expect(timing.employeeEmailLocalDate).toBe("2026-09-17"); expect(timing.openLocalDate).toBe("2026-09-18"); });
  it("moves a Monday coordinator email to the next workday", () => { const timing = cycleTiming(schedule, 0, new Set(["2026-09-21"])); expect(timing.coordinatorEmailLocalDate).toBe("2026-09-22"); expect(timing.reportLocalDate).toBe("2026-09-21"); });
  it("walks across weekends and consecutive holidays", () => { expect(previousOrSameWorkday("2026-09-21", new Set(["2026-09-21", "2026-09-18"]))).toBe("2026-09-17"); expect(nextOrSameWorkday("2026-09-18", new Set(["2026-09-18", "2026-09-21"]))).toBe("2026-09-22"); });
});
