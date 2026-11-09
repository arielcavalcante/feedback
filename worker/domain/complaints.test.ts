import { describe, expect, it } from "vitest";
import { complaintWeek, projectComplaints, type ComplaintRow } from "./complaints";

const row = (id: string, author: string, overrides: Partial<ComplaintRow> = {}): ComplaintRow => ({
  id, authorUserId: author, authorName: null, weekStart: "2026-11-02", releaseAt: "2026-11-09T12:00:00.000Z",
  body: `texto ${id}`, isSigned: 0, topicKeys: "software,equipment", ...overrides,
});
const after = "2026-11-10T00:00:00.000Z";

describe("complaint projection", () => {
  it("withholds an anonymous week with fewer than 3 distinct people, even with many complaints", () => {
    const result = projectComplaints([row("a", "u1"), row("b", "u1"), row("c", "u2")], after);
    expect(result.anonymousWeeks).toEqual([]);
    expect(result.withheldWeeks).toEqual(["2026-11-02"]);
    expect(JSON.stringify(result)).not.toContain("texto");
  });

  it("releases the week at 3 distinct people, without authors", () => {
    const result = projectComplaints([row("c", "u3"), row("a", "u1"), row("b", "u2")], after);
    expect(result.anonymousWeeks[0].items.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(JSON.stringify(result)).not.toMatch(/u1|u2|u3/);
    expect(result.anonymousWeeks[0].items[0].topics).toEqual(["equipment", "software"]);
  });

  it("keeps the current week hidden until its release time", () => {
    const rows = [row("a", "u1"), row("b", "u2"), row("c", "u3")];
    expect(projectComplaints(rows, "2026-11-08T12:00:00.000Z").anonymousWeeks).toEqual([]);
  });

  it("shows signed complaints right away with the author's name", () => {
    const result = projectComplaints([row("s", "u9", { isSigned: 1, authorName: "Lia", releaseAt: "2099-01-01T00:00:00.000Z" })], after);
    expect(result.signed).toEqual([{ id: "s", weekStart: "2026-11-02", authorName: "Lia", topics: ["equipment", "software"], body: "texto s" }]);
  });
});

describe("complaintWeek", () => {
  it("uses Monday in Fortaleza and releases the next Monday at 09:00", () => {
    expect(complaintWeek(new Date("2026-11-16T02:30:00.000Z"))).toEqual({ weekStart: "2026-11-09", releaseAt: "2026-11-16T12:00:00.000Z" }); // Sunday 23:30 local
    expect(complaintWeek(new Date("2026-11-16T03:00:00.000Z")).weekStart).toBe("2026-11-16"); // Monday 00:00 local
  });
});
