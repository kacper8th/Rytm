import { parseRepeatRule, rowToRepeatRule, type RepeatRuleFields, type RepeatRuleRow } from "./repeat-rule";
import { isIsoDate, isRecord } from "./validation";

/**
 * Habits API helpers — validation and row mapping. See documentation: Modules/Habits.
 * Goals and limits get entries (amounts on a date); counters get runs (start and end dates).
 */

export type HabitKind = "goal" | "limit" | "counter";
export type Period = "day" | "week" | "month";

export type Habit = {
  id: string;
  kind: HabitKind;
  name: string;
  /** YYYY-MM-DD — goal / limit: no entries before it (and the rule's first occurrence); counter: start of the first run. */
  startDate: string;
  /** Goal: by repeat rule or by period; null for limits (always a period) and counters. */
  schedule: "rule" | "period" | null;
  /** Goal with schedule "rule". */
  rule: RepeatRuleFields | null;
  /** Goal with schedule "period", limit. */
  period: Period | null;
  /** Goal: at least (> 0) per day of the rule or per period; limit: at most (>= 0) per period. */
  target: number | null;
  unit: string | null;
  /** Amounts of the quick buttons, ascending. */
  buttonValues: number[];
  /** Counter: start date of the current run. */
  runStart: string | null;
  createdAt: string;
};

export type HabitRow = {
  id: string;
  kind: HabitKind;
  name: string;
  start_date: string;
  schedule: "rule" | "period" | null;
  repeat_type: RepeatRuleRow["repeat_type"] | null;
  interval: number | null;
  weekdays: string | null;
  month_day: number | null;
  week_of_month: number | null;
  weekday: number | null;
  period: Period | null;
  target: number | null;
  unit: string | null;
  button_values: string | null;
  created_at: string;
  run_start: string | null;
};

/** SELECT of habits with the start of the counter's current run; read by rowToHabit(). */
export const HABIT_SELECT = `SELECT h.id, h.kind, h.name, h.start_date, h.schedule, h.repeat_type, h.interval, h.weekdays,
    h.month_day, h.week_of_month, h.weekday, h.period, h.target, h.unit, h.button_values, h.created_at,
    r.start_date AS run_start
  FROM habits h LEFT JOIN counter_runs r ON r.habit_id = h.id AND r.end_date IS NULL`;

export function rowToHabit(row: HabitRow): Habit {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    startDate: row.start_date,
    schedule: row.schedule,
    rule: row.repeat_type ? rowToRepeatRule({ ...row, repeat_type: row.repeat_type, interval: row.interval ?? 1 }) : null,
    period: row.period,
    target: row.target,
    unit: row.unit,
    buttonValues: row.button_values ? row.button_values.split(",").map(Number) : [],
    runStart: row.run_start,
    createdAt: row.created_at,
  };
}

export type Entry = { id: string; habitId: string; date: string; amount: number; createdAt: string };
export type EntryRow = { id: string; habit_id: string; date: string; amount: number; created_at: string };
export const ENTRY_COLUMNS = "id, habit_id, date, amount, created_at";

export function rowToEntry(row: EntryRow): Entry {
  return { id: row.id, habitId: row.habit_id, date: row.date, amount: row.amount, createdAt: row.created_at };
}

export type Run = { id: string; habitId: string; startDate: string; endDate: string | null };
export type RunRow = { id: string; habit_id: string; start_date: string; end_date: string | null };
export const RUN_COLUMNS = "id, habit_id, start_date, end_date";

export function rowToRun(row: RunRow): Run {
  return { id: row.id, habitId: row.habit_id, startDate: row.start_date, endDate: row.end_date };
}

/** An amount of an entry, target or button: a number > 0 (decimals allowed), at most 1 000 000. */
export const isAmount = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0 && v <= 1_000_000;

/**
 * The latest date the server accepts as "today or earlier". The server does not know the user's time zone, so it
 * allows one day after today in UTC; the app itself never offers a date after the user's today.
 */
export function latestAllowedDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** A date YYYY-MM-DD that is not in the future (see latestAllowedDate). */
export const isPastOrToday = (v: unknown): v is string => isIsoDate(v) && v <= latestAllowedDate();

const PERIODS: readonly Period[] = ["day", "week", "month"];
const isPeriod = (v: unknown): v is Period => PERIODS.includes(v as Period);

/** Values of a new habit, as saved (without id, runStart, createdAt). */
export type NewHabit = Omit<Habit, "id" | "runStart" | "createdAt">;

function parseName(body: Record<string, unknown>): string | null {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  return name.length >= 1 && name.length <= 200 ? name : null;
}

/** Target, unit and button values of a goal or limit, or an error. */
function parseAmounts(body: Record<string, unknown>, kind: "goal" | "limit") {
  const target = body.target;
  if (kind === "goal" ? !isAmount(target) : !(target === 0 || isAmount(target))) {
    return kind === "goal" ? "`target` must be a number > 0." : "`target` must be a number >= 0.";
  }
  const unit = typeof body.unit === "string" ? body.unit.trim() : "";
  if (unit.length < 1 || unit.length > 20) return "`unit` must have 1–20 characters.";
  const values = body.buttonValues;
  if (!Array.isArray(values) || values.length < 1 || values.length > 8 || !values.every(isAmount)) {
    return "`buttonValues` must be a list of 1–8 numbers > 0.";
  }
  const buttonValues = [...new Set(values as number[])].sort((a, b) => a - b);
  return { target: target as number, unit, buttonValues };
}

/**
 * Checks the body of POST /api/habits (and of PUT /api/habits/:id, with the kind of the saved habit).
 * Fields not used by the kind or schedule are cleared. Returns the habit or an error.
 */
export function parseNewHabit(body: unknown, savedKind?: HabitKind): NewHabit | string {
  if (!isRecord(body)) return "Body must be an object.";
  const kind = savedKind ?? body.kind;
  if (kind !== "goal" && kind !== "limit" && kind !== "counter") return "`kind` must be goal, limit or counter.";
  const name = parseName(body);
  if (!name) return "`name` must have 1–200 characters.";
  if (!isPastOrToday(body.startDate)) return "`startDate` must be a date YYYY-MM-DD, not in the future.";
  const base: NewHabit = {
    kind: kind as HabitKind,
    name,
    startDate: body.startDate,
    schedule: null,
    rule: null,
    period: null,
    target: null,
    unit: null,
    buttonValues: [],
  };

  if (kind === "counter") return base;

  const amounts = parseAmounts(body, kind);
  if (typeof amounts === "string") return amounts;

  if (kind === "limit") {
    if (!isPeriod(body.period)) return "`period` must be day, week or month.";
    return { ...base, ...amounts, period: body.period };
  }

  if (body.schedule === "period") {
    if (!isPeriod(body.period)) return "`period` must be day, week or month.";
    return { ...base, ...amounts, schedule: "period", period: body.period };
  }
  if (body.schedule === "rule") {
    const rule = parseRepeatRule(body.rule);
    if (typeof rule === "string") return rule;
    return { ...base, ...amounts, schedule: "rule", rule };
  }
  return "`schedule` must be rule or period.";
}

/** Values bound to the columns name … button_values, in the order of HABIT_VALUE_COLUMNS. */
export const HABIT_VALUE_COLUMNS =
  "name, start_date, schedule, repeat_type, interval, weekdays, month_day, week_of_month, weekday, period, target, unit, button_values";

export function habitValues(habit: NewHabit): (string | number | null)[] {
  const rule = habit.rule;
  return [
    habit.name,
    habit.startDate,
    habit.schedule,
    rule?.repeatType ?? null,
    rule?.interval ?? null,
    rule && rule.weekdays.length ? rule.weekdays.join(",") : null,
    rule?.monthDay ?? null,
    rule?.weekOfMonth ?? null,
    rule?.weekday ?? null,
    habit.period,
    habit.target,
    habit.unit,
    habit.buttonValues.length ? habit.buttonValues.join(",") : null,
  ];
}

/** Checks the body of POST /api/habits/:id/entries. Returns { date, amount } or an error. */
export function parseNewEntry(body: unknown): { date: string; amount: number } | string {
  if (!isRecord(body)) return "Body must be an object.";
  if (!isPastOrToday(body.date)) return "`date` must be a date YYYY-MM-DD, not in the future.";
  if (!isAmount(body.amount)) return "`amount` must be a number > 0, at most 1 000 000.";
  return { date: body.date, amount: body.amount };
}

/** The date of a body { date } (restart), or null when it is missing, invalid or in the future. */
export function parseDateBody(body: unknown): string | null {
  return isRecord(body) && isPastOrToday(body.date) ? body.date : null;
}
