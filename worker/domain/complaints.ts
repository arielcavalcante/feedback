// Privacy projection for complaints shown to a coordinator (ADR-026).
import { effectiveThreshold } from "./coordinator";
import { addLocalDays, localDateInZone, localDateTimeToUtc } from "./schedule";

export type ComplaintRow = {
  id: string;
  authorUserId: string;
  /** Only selected for signed complaints. */
  authorName: string | null;
  weekStart: string;
  releaseAt: string;
  body: string;
  isSigned: number | boolean;
  topicKeys: string | null;
};

export type CoordinatorComplaints = {
  signed: Array<{ id: string; weekStart: string; authorName: string; topics: string[]; body: string }>;
  anonymousWeeks: Array<{ weekStart: string; items: Array<{ id: string; topics: string[]; body: string }> }>;
  withheldWeeks: string[];
};

const topicsOf = (row: ComplaintRow) => (row.topicKeys?.split(",") ?? []).filter(Boolean).sort();

/** Rows must be scoped to one coordinator and team. */
export function projectComplaints(rows: readonly ComplaintRow[], now: string, threshold = 3): CoordinatorComplaints {
  const signed = rows.filter((row) => row.isSigned)
    .map((row) => ({ id: row.id, weekStart: row.weekStart, authorName: row.authorName ?? "", topics: topicsOf(row), body: row.body }))
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart) || a.id.localeCompare(b.id));

  const weeks = new Map<string, ComplaintRow[]>();
  for (const row of rows) {
    // Anonymous complaints stay invisible until their week is over and the report time has passed.
    if (row.isSigned || row.releaseAt > now) continue;
    weeks.set(row.weekStart, [...(weeks.get(row.weekStart) ?? []), row]);
  }
  const anonymousWeeks: CoordinatorComplaints["anonymousWeeks"] = [];
  const withheldWeeks: string[] = [];
  for (const [weekStart, weekRows] of [...weeks].sort(([a], [b]) => b.localeCompare(a))) {
    const authors = new Set(weekRows.map((row) => row.authorUserId)).size;
    if (authors >= effectiveThreshold(threshold)) {
      // Random ids give an order unrelated to who wrote what or when.
      anonymousWeeks.push({ weekStart, items: weekRows.map((row) => ({ id: row.id, topics: topicsOf(row), body: row.body })).sort((a, b) => a.id.localeCompare(b.id)) });
    } else {
      withheldWeeks.push(weekStart);
    }
  }
  return { signed, anonymousWeeks, withheldWeeks };
}

/** Monday of the current week in the zone, and when that week's anonymous complaints may be released. */
export function complaintWeek(now: Date, timezone = "America/Fortaleza") {
  const today = localDateInZone(now, timezone);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const weekStart = addLocalDays(today, -((weekday + 6) % 7));
  return { weekStart, releaseAt: localDateTimeToUtc(addLocalDays(weekStart, 7), "09:00:00", timezone) };
}
