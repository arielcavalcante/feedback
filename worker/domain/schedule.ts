export type CycleTiming = { sequenceNumber: number; openLocalDate: string; closeLocalDate: string; reportLocalDate: string; employeeEmailLocalDate: string; coordinatorEmailLocalDate: string; opensAt: string; closesAt: string; reportAt: string; employeeEmailAt: string; coordinatorEmailAt: string };
export type ScheduleDefinition = { anchorOpenLocalDate: string; intervalDays: number; timezone: string; openLocalTime: string; closeLocalTime: string; reportLocalTime: string };

export function cycleTiming(schedule: ScheduleDefinition, sequenceNumber: number, holidays: ReadonlySet<string>): CycleTiming {
  if (!Number.isInteger(sequenceNumber) || sequenceNumber < 0) throw new Error("Sequence number must be a non-negative integer");
  const openLocalDate = addLocalDays(schedule.anchorOpenLocalDate, schedule.intervalDays * sequenceNumber);
  const closeLocalDate = addLocalDays(openLocalDate, 2);
  const reportLocalDate = addLocalDays(openLocalDate, 3);
  const employeeEmailLocalDate = previousOrSameWorkday(openLocalDate, holidays);
  const coordinatorEmailLocalDate = nextOrSameWorkday(reportLocalDate, holidays);
  return { sequenceNumber, openLocalDate, closeLocalDate, reportLocalDate, employeeEmailLocalDate, coordinatorEmailLocalDate,
    opensAt: localDateTimeToUtc(openLocalDate, schedule.openLocalTime, schedule.timezone), closesAt: localDateTimeToUtc(closeLocalDate, schedule.closeLocalTime, schedule.timezone),
    reportAt: localDateTimeToUtc(reportLocalDate, schedule.reportLocalTime, schedule.timezone), employeeEmailAt: localDateTimeToUtc(employeeEmailLocalDate, schedule.openLocalTime, schedule.timezone),
    coordinatorEmailAt: localDateTimeToUtc(coordinatorEmailLocalDate, schedule.reportLocalTime, schedule.timezone) };
}
export function previousOrSameWorkday(localDate: string, holidays: ReadonlySet<string>): string { let candidate = localDate; while (!isWorkday(candidate, holidays)) candidate = addLocalDays(candidate, -1); return candidate; }
export function nextOrSameWorkday(localDate: string, holidays: ReadonlySet<string>): string { let candidate = localDate; while (!isWorkday(candidate, holidays)) candidate = addLocalDays(candidate, 1); return candidate; }
export function isWorkday(localDate: string, holidays: ReadonlySet<string>): boolean { const day = new Date(`${localDate}T00:00:00Z`).getUTCDay(); return day !== 0 && day !== 6 && !holidays.has(localDate); }
export function addLocalDays(localDate: string, days: number): string { const date = new Date(`${localDate}T00:00:00Z`); if (Number.isNaN(date.getTime())) throw new Error(`Invalid local date: ${localDate}`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
export function daysBetween(startLocalDate: string, endLocalDate: string): number { return Math.floor((Date.parse(`${endLocalDate}T00:00:00Z`) - Date.parse(`${startLocalDate}T00:00:00Z`)) / 86_400_000); }
export function localDateInZone(instant: Date, timezone: string): string { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant); const value = Object.fromEntries(parts.map((part) => [part.type, part.value])); return `${value.year}-${value.month}-${value.day}`; }
export function localDateTimeToUtc(localDate: string, localTime: string, timezone: string): string {
  const [year, month, day] = localDate.split("-").map(Number); const [hour, minute, second = 0] = localTime.split(":").map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute, second); let candidate = desired;
  for (let attempt = 0; attempt < 3; attempt += 1) { const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(candidate)); const value = Object.fromEntries(parts.map((part) => [part.type, part.value])); const represented = Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day), Number(value.hour), Number(value.minute), Number(value.second)); const correction = desired - represented; candidate += correction; if (correction === 0) return new Date(candidate).toISOString(); }
  throw new Error(`Unable to resolve ${localDate} ${localTime} in ${timezone}`);
}
