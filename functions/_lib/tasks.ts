/**
 * Tasks API helpers — validation and row mapping. See documentation: Modules/Tasks.
 * Occurrences are not stored: the app computes them from the repeat rule; only occurrences marked as done are saved.
 */

export type RepeatType = "days" | "weekly" | "month_day" | "month_weekday";

export type Task = {
  id: string;
  title: string;
  repeatType: RepeatType;
  startDate: string;
  interval: number;
  weekdays: number[];
  monthDay: number | null;
  weekOfMonth: number | null;
  weekday: number | null;
  createdAt: string;
};

export type TaskRow = {
  id: string;
  title: string;
  repeat_type: RepeatType;
  start_date: string;
  interval: number;
  weekdays: string | null;
  month_day: number | null;
  week_of_month: number | null;
  weekday: number | null;
  created_at: string;
};

export type Completion = { taskId: string; date: string; doneAt: string };
export type CompletionRow = { task_id: string; date: string; done_at: string };

/** Columns of tasks read by rowToTask(). */
export const TASK_COLUMNS = "id, title, repeat_type, start_date, interval, weekdays, month_day, week_of_month, weekday, created_at";
export const COMPLETION_COLUMNS = "task_id, date, done_at";

export function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    repeatType: row.repeat_type,
    startDate: row.start_date,
    interval: row.interval,
    weekdays: row.weekdays ? row.weekdays.split(",").map(Number) : [],
    monthDay: row.month_day,
    weekOfMonth: row.week_of_month,
    weekday: row.weekday,
    createdAt: row.created_at,
  };
}

export function rowToCompletion(row: CompletionRow): Completion {
  return { taskId: row.task_id, date: row.date, doneAt: row.done_at };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

export const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 100;

/** A real calendar date as YYYY-MM-DD. */
export function isIsoDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Values of a new task, in column order of the INSERT in POST /api/tasks. */
export type NewTask = Omit<Task, "id" | "createdAt">;

/** Checks the body of POST /api/tasks. Fields not used by the repeat type are cleared. Returns the task or an error. */
export function parseNewTask(body: unknown): NewTask | string {
  if (!isRecord(body)) return "Body must be an object.";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (title.length < 1 || title.length > 200) return "`title` must have 1–200 characters.";
  if (!isIsoDate(body.startDate)) return "`startDate` must be a date YYYY-MM-DD.";

  const base = { title, startDate: body.startDate, interval: 1, weekdays: [], monthDay: null, weekOfMonth: null, weekday: null };
  switch (body.repeatType) {
    case "days":
      if (!isInt(body.interval, 1, 365)) return "`interval` must be 1–365 days.";
      return { ...base, repeatType: "days", interval: body.interval };
    case "weekly": {
      if (!isInt(body.interval, 1, 52)) return "`interval` must be 1–52 weeks.";
      const days = body.weekdays;
      if (!Array.isArray(days) || days.length === 0 || !days.every((d) => isInt(d, 0, 6))) {
        return "`weekdays` must be a non-empty list of days 0–6.";
      }
      const weekdays = [...new Set(days as number[])].sort((a, b) => a - b);
      return { ...base, repeatType: "weekly", interval: body.interval, weekdays };
    }
    case "month_day":
      if (!isInt(body.monthDay, 1, 28)) return "`monthDay` must be 1–28 (not every month has days 29–31).";
      return { ...base, repeatType: "month_day", monthDay: body.monthDay };
    case "month_weekday":
      if (!(isInt(body.weekOfMonth, 1, 4) || body.weekOfMonth === -1)) return "`weekOfMonth` must be 1–4 or -1 (last).";
      if (!isInt(body.weekday, 0, 6)) return "`weekday` must be 0–6.";
      return { ...base, repeatType: "month_weekday", weekOfMonth: body.weekOfMonth, weekday: body.weekday };
    default:
      return "`repeatType` must be days, weekly, month_day or month_weekday.";
  }
}
