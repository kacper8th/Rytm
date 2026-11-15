import { addDays, daysBetween, fromIsoDate, weekStartOf } from "./dates";

/**
 * Repeat rules — shared by modules whose items repeat on a schedule (recurring tasks, habit goals).
 * Occurrences are computed from the rule, never stored. Dates are YYYY-MM-DD; days of the week 0 = Monday … 6 = Sunday.
 */

/** days = every N days · weekly = chosen weekdays every N weeks · month_day = day 1–28 · month_weekday = n-th weekday. */
export type RepeatType = "days" | "weekly" | "month_day" | "month_weekday";

export type RepeatRule = {
  repeatType: RepeatType;
  /** YYYY-MM-DD — no occurrence before it; also the start of the "every N days / weeks" count. */
  startDate: string;
  /** Every N days (days) or every N weeks (weekly); 1 for the monthly types. */
  interval: number;
  /** weekly: days 0 = Monday … 6 = Sunday. */
  weekdays: number[];
  /** month_day: 1–28. */
  monthDay: number | null;
  /** month_weekday: 1–4, -1 = last. */
  weekOfMonth: number | null;
  /** month_weekday: 0 = Monday … 6 = Sunday. */
  weekday: number | null;
};

const WEEKDAY_SHORT = ["pn", "wt", "śr", "czw", "pt", "sob", "nd"];
const WEEKDAY_ACCUSATIVE = ["poniedziałek", "wtorek", "środę", "czwartek", "piątek", "sobotę", "niedzielę"];
/** Days whose Polish name is feminine (Wednesday, Saturday, Sunday) — they take the feminine form of "last". */
const FEMININE_DAYS = new Set([2, 5, 6]);

const weekdayOf = (date: Date) => (date.getDay() + 6) % 7;

/** Whether the rule has an occurrence on `date` (start date included). */
export function occursOn(rule: RepeatRule, date: string): boolean {
  if (date < rule.startDate) return false;
  const d = fromIsoDate(date);
  switch (rule.repeatType) {
    case "days":
      return daysBetween(rule.startDate, date) % rule.interval === 0;
    case "weekly": {
      if (!rule.weekdays.includes(weekdayOf(d))) return false;
      const weeks = daysBetween(weekStartOf(fromIsoDate(rule.startDate)), weekStartOf(d)) / 7;
      return weeks % rule.interval === 0;
    }
    case "month_day":
      return d.getDate() === rule.monthDay;
    case "month_weekday": {
      if (weekdayOf(d) !== rule.weekday) return false;
      if (rule.weekOfMonth === -1) {
        const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        return d.getDate() + 7 > daysInMonth;
      }
      return Math.ceil(d.getDate() / 7) === rule.weekOfMonth;
    }
  }
}

/** Occurrence dates from `from` to `to` (both included), oldest first. */
export function occurrencesBetween(rule: RepeatRule, from: string, to: string): string[] {
  const dates: string[] = [];
  for (let date = from < rule.startDate ? rule.startDate : from; date <= to; date = addDays(date, 1)) {
    if (occursOn(rule, date)) dates.push(date);
  }
  return dates;
}

/** Occurrences before `today` that are not in `done`, oldest first. */
export function overdueDates(rule: RepeatRule, done: ReadonlySet<string>, today: string): string[] {
  return occurrencesBetween(rule, rule.startDate, addDays(today, -1)).filter((date) => !done.has(date));
}

/** The repeat rule as a short Polish label for the interface: the interval, the chosen days or the day of the month. */
export function ruleLabel(rule: RepeatRule): string {
  switch (rule.repeatType) {
    case "days":
      return rule.interval === 1 ? "codziennie" : `co ${rule.interval} dni`;
    case "weekly": {
      const days = rule.weekdays.map((d) => WEEKDAY_SHORT[d]).join(", ");
      return rule.interval === 1 ? `${days} · co tydzień` : `${days} · co ${rule.interval} tyg.`;
    }
    case "month_day":
      return `${rule.monthDay}. dnia miesiąca`;
    case "month_weekday": {
      const day = rule.weekday ?? 0;
      const which = rule.weekOfMonth === -1 ? (FEMININE_DAYS.has(day) ? "ostatnią" : "ostatni") : `${rule.weekOfMonth}.`;
      return `w ${which} ${WEEKDAY_ACCUSATIVE[day]} miesiąca`;
    }
  }
}

/** For forms: weekday names (0 = Monday). */
export const WEEKDAY_NAMES = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"];
export const WEEKDAY_SHORT_NAMES = WEEKDAY_SHORT;
