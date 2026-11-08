/**
 * Date helpers shared by modules — local time, dates as YYYY-MM-DD, a week is identified by its Monday.
 * Days of the week are numbered 0 = Monday … 6 = Sunday.
 */

export const DAYS_IN_WEEK = 7;

const DAY_NAMES = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"];
const MONTH_NAMES = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];

export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromIsoDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Date of a day of the week (0 = Monday). */
export function dayDate(weekStart: string, day: number): Date {
  const date = fromIsoDate(weekStart);
  date.setDate(date.getDate() + day);
  return date;
}

/** Monday of the week that contains `date`, as YYYY-MM-DD. */
export function weekStartOf(date: Date): string {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return toIsoDate(monday);
}

export function currentWeekStart(): string {
  return weekStartOf(new Date());
}

/** The week from a `?week=YYYY-MM-DD` URL parameter (any day → its Monday); the current week when missing or invalid. */
export function weekFromParam(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return currentWeekStart();
  const date = fromIsoDate(value);
  return Number.isNaN(date.getTime()) ? currentWeekStart() : weekStartOf(date);
}

export function shiftWeek(weekStart: string, weeks: number): string {
  return toIsoDate(dayDate(weekStart, weeks * DAYS_IN_WEEK));
}

/** Today's day of the week (0–6) when the week is the current one, otherwise null. */
export function todayIn(weekStart: string): number | null {
  const today = new Date();
  return weekStartOf(today) === weekStart ? (today.getDay() + 6) % 7 : null;
}

/** E.g. "2–8 lis 2026", "30 lis – 6 gru 2026", "29 gru 2025 – 4 sty 2026". */
export function weekLabel(weekStart: string): string {
  return dateRangeLabel(weekStart, toIsoDate(dayDate(weekStart, DAYS_IN_WEEK - 1)));
}

/** A range of dates (YYYY-MM-DD, both included), e.g. "6–9 lis 2026", "30 lis – 2 gru 2026", "6 lis 2026". */
export function dateRangeLabel(from: string, to: string): string {
  const first = fromIsoDate(from);
  const last = fromIsoDate(to);
  const month = (d: Date) => MONTH_NAMES[d.getMonth()];
  if (from === to) return `${first.getDate()} ${month(first)} ${first.getFullYear()}`;
  if (first.getFullYear() !== last.getFullYear()) {
    return `${first.getDate()} ${month(first)} ${first.getFullYear()} – ${last.getDate()} ${month(last)} ${last.getFullYear()}`;
  }
  if (first.getMonth() !== last.getMonth()) {
    return `${first.getDate()} ${month(first)} – ${last.getDate()} ${month(last)} ${last.getFullYear()}`;
  }
  return `${first.getDate()}–${last.getDate()} ${month(last)} ${last.getFullYear()}`;
}

/** E.g. "Pon 2.11". */
export function dayLabel(weekStart: string, day: number): string {
  return dateLabel(toIsoDate(dayDate(weekStart, day)));
}

/** A date (YYYY-MM-DD) as e.g. "Pon 2.11". */
export function dateLabel(value: string): string {
  const date = fromIsoDate(value);
  return `${DAY_NAMES[(date.getDay() + 6) % 7]} ${date.getDate()}.${date.getMonth() + 1}`;
}
