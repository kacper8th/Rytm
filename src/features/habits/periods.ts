import { addDays, dateLabel, daysBetween, fromIsoDate, toIsoDate, weekLabel, weekStartOf } from "../../shared/dates";
import { occursOn } from "../../shared/recurrence";
import { goalRule, type Entry, type Habit, type Period, type Settings } from "./habits";

/**
 * Periods, sums and states of goals and limits — shared by the Habits sub-modules.
 * Dates are YYYY-MM-DD; a week is Monday–Sunday, a month is a calendar month.
 */

export type Range = { from: string; to: string };

const MONTH_NAMES = [
  "styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec",
  "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień",
];

/** The period of `period` kind that contains `date`. */
export function periodRange(period: Period, date: string): Range {
  switch (period) {
    case "day":
      return { from: date, to: date };
    case "week": {
      const from = weekStartOf(fromIsoDate(date));
      return { from, to: addDays(from, 6) };
    }
    case "month": {
      const d = fromIsoDate(date);
      return {
        from: toIsoDate(new Date(d.getFullYear(), d.getMonth(), 1)),
        to: toIsoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
      };
    }
  }
}

/** The range a goal or limit sums its entries over on `date`: its period, or the day itself (goal with a rule). */
export function habitRange(habit: Habit, date: string): Range {
  return habit.period ? periodRange(habit.period, date) : { from: date, to: date };
}

/** E.g. "Pon 9.11", "9–15 lis 2026", "listopad 2026". */
export function periodLabel(period: Period, date: string): string {
  const range = periodRange(period, date);
  if (period === "day") return dateLabel(date);
  if (period === "week") return weekLabel(range.from);
  const d = fromIsoDate(date);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

/** How a period is named next to a target, e.g. "2000 ml dziennie". */
export const PERIOD_ADVERBS: Record<Period, string> = { day: "dziennie", week: "w tygodniu", month: "w miesiącu" };

/** The range that covers both the week and the month of `date` — what a screen loads entries for. */
export function loadRange(date: string): Range {
  const week = periodRange("week", date);
  const month = periodRange("month", date);
  return { from: week.from < month.from ? week.from : month.from, to: week.to > month.to ? week.to : month.to };
}

/** Whether the habit is shown on `date`: not before its start; a goal with a rule only on the days of its rule. */
export function showsOn(habit: Habit, date: string): boolean {
  if (date < habit.startDate) return false;
  const rule = goalRule(habit);
  return rule ? occursOn(rule, date) : true;
}

/** Entries of one habit within a range, in the order added. */
export function entriesIn(entries: readonly Entry[], habitId: string, range: Range): Entry[] {
  return entries.filter((e) => e.habitId === habitId && e.date >= range.from && e.date <= range.to);
}

export const sumOf = (entries: readonly Entry[]) => entries.reduce((sum, e) => sum + e.amount, 0);

/**
 * State of a goal in a range: done when the sum reaches the target; otherwise "open" while the range has not ended
 * (it includes today or later), "missed" after it.
 */
export function goalState(sum: number, target: number, range: Range, today: string): "done" | "open" | "missed" {
  if (sum >= target) return "done";
  return range.to >= today ? "open" : "missed";
}

/** State of a limit in its period: exceeded as soon as the sum is over the limit, otherwise within it. */
export function limitState(sum: number, limit: number): "within" | "exceeded" {
  return sum > limit ? "exceeded" : "within";
}

/** Entries in the order they were added (the last one is what "undo last" deletes). */
export const byAdded = (a: Entry, b: Entry) => a.createdAt.localeCompare(b.createdAt);

/** The days the Home card covers: from today to the end of the range (today, today + N-1 days, this week, this month). */
export function homeRange(settings: Settings, today: string): Range {
  switch (settings.homeRange) {
    case "day":
      return { from: today, to: today };
    case "days":
      return { from: today, to: addDays(today, settings.homeDays - 1) };
    case "week":
      return { from: today, to: periodRange("week", today).to };
    case "month":
      return { from: today, to: periodRange("month", today).to };
  }
}

/**
 * Whether a goal or limit summed over `period` belongs to the Home range: daily ones always; weekly ones for
 * this week, this month or 7+ days; monthly ones for this month or 28+ days.
 */
export function periodInHome(period: Period, settings: Settings): boolean {
  if (period === "day") return true;
  const days = settings.homeRange === "days" ? settings.homeDays : 0;
  if (period === "week") return settings.homeRange === "week" || settings.homeRange === "month" || days >= 7;
  return settings.homeRange === "month" || days >= 28;
}

/** The first day from `from` to `to` (both included) the goal is shown on, or null. */
export function firstDayShown(habit: Habit, range: Range): string | null {
  for (let date = range.from; date <= range.to; date = addDays(date, 1)) {
    if (showsOn(habit, date)) return date;
  }
  return null;
}

/** A number of days in Polish, e.g. "1 dzień", "12 dni". */
export const daysLabel = (days: number) => `${days} ${days === 1 ? "dzień" : "dni"}`;

/** Days of a counter run from `start` to `end`, or when it starts if `start` is still ahead: "12 dni", "start jutro", "start za 3 dni". */
export function runLabel(start: string, end: string): string {
  const days = daysBetween(start, end);
  if (days >= 0) return daysLabel(days);
  return days === -1 ? "start jutro" : `start za ${-days} dni`;
}

/** An amount in Polish notation: up to 2 decimals, decimal comma, e.g. "0,5", "2000". */
export function formatAmount(value: number): string {
  return value.toLocaleString("pl-PL", { maximumFractionDigits: 2, useGrouping: false });
}

/** A number typed by the user: dot or comma as the decimal mark; NaN when it is not a number. */
export function parseAmount(text: string): number {
  const value = text.trim().replace(",", ".");
  return /^\d+(\.\d+)?$/.test(value) ? Number(value) : NaN;
}

/** The date from a `?date=YYYY-MM-DD` URL parameter; today when missing, invalid or in the future. */
export function dateFromParam(value: string | null, today: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return today;
  const date = fromIsoDate(value);
  if (Number.isNaN(date.getTime()) || toIsoDate(date) !== value) return today;
  return value > today ? today : value;
}
