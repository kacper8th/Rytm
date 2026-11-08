import { fromIsoDate, toIsoDate, weekStartOf } from "../../shared/dates";
import type { Task } from "./tasks";

/**
 * Occurrences of recurring tasks, computed from the repeat rule — they are not stored.
 * Dates are YYYY-MM-DD; days of the week 0 = Monday … 6 = Sunday.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAY_SHORT = ["pn", "wt", "śr", "czw", "pt", "sob", "nd"];
const WEEKDAY_ACCUSATIVE = ["poniedziałek", "wtorek", "środę", "czwartek", "piątek", "sobotę", "niedzielę"];
/** środa, sobota, niedziela — "ostatnią", the others "ostatni". */
const FEMININE_DAYS = new Set([2, 5, 6]);

/** Whole days from `a` to `b` (both YYYY-MM-DD); not affected by daylight saving time. */
function daysBetween(a: string, b: string): number {
  const utc = (v: string) => {
    const [y, m, d] = v.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(b) - utc(a)) / DAY_MS);
}

function addDays(date: string, days: number): string {
  const d = fromIsoDate(date);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

const weekdayOf = (date: Date) => (date.getDay() + 6) % 7;

/** Whether the task has an occurrence on `date` (start date included). */
export function occursOn(task: Task, date: string): boolean {
  if (date < task.startDate) return false;
  const d = fromIsoDate(date);
  switch (task.repeatType) {
    case "days":
      return daysBetween(task.startDate, date) % task.interval === 0;
    case "weekly": {
      if (!task.weekdays.includes(weekdayOf(d))) return false;
      const weeks = daysBetween(weekStartOf(fromIsoDate(task.startDate)), weekStartOf(d)) / 7;
      return weeks % task.interval === 0;
    }
    case "month_day":
      return d.getDate() === task.monthDay;
    case "month_weekday": {
      if (weekdayOf(d) !== task.weekday) return false;
      if (task.weekOfMonth === -1) {
        const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        return d.getDate() + 7 > daysInMonth;
      }
      return Math.ceil(d.getDate() / 7) === task.weekOfMonth;
    }
  }
}

/** Occurrence dates from `from` to `to` (both included), oldest first. */
export function occurrencesBetween(task: Task, from: string, to: string): string[] {
  const dates: string[] = [];
  for (let date = from < task.startDate ? task.startDate : from; date <= to; date = addDays(date, 1)) {
    if (occursOn(task, date)) dates.push(date);
  }
  return dates;
}

/** Occurrences before `today` that are not done, oldest first. */
export function overdueDates(task: Task, done: ReadonlySet<string>, today: string): string[] {
  return occurrencesBetween(task, task.startDate, addDays(today, -1)).filter((date) => !done.has(date));
}

/** The repeat rule in Polish, e.g. "co 3 dni", "pn, czw · co 2 tyg.", "w 2. wtorek miesiąca". */
export function ruleLabel(task: Task): string {
  switch (task.repeatType) {
    case "days":
      return task.interval === 1 ? "codziennie" : `co ${task.interval} dni`;
    case "weekly": {
      const days = task.weekdays.map((d) => WEEKDAY_SHORT[d]).join(", ");
      return task.interval === 1 ? `${days} · co tydzień` : `${days} · co ${task.interval} tyg.`;
    }
    case "month_day":
      return `${task.monthDay}. dnia miesiąca`;
    case "month_weekday": {
      const day = task.weekday ?? 0;
      const which = task.weekOfMonth === -1 ? (FEMININE_DAYS.has(day) ? "ostatnią" : "ostatni") : `${task.weekOfMonth}.`;
      return `w ${which} ${WEEKDAY_ACCUSATIVE[day]} miesiąca`;
    }
  }
}

/** For forms: weekday names (0 = Monday). */
export const WEEKDAY_NAMES = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"];
export const WEEKDAY_SHORT_NAMES = WEEKDAY_SHORT;
