import { parseRepeatRule, rowToRepeatRule, type RepeatRuleFields, type RepeatRuleRow } from "./repeat-rule";
import { isIsoDate, isRecord } from "./validation";

/**
 * Tasks API helpers — validation and row mapping. See documentation: Modules/Tasks.
 * Occurrences are not stored: the app computes them from the repeat rule; only occurrences marked as done are saved.
 */

export type Task = RepeatRuleFields & {
  id: string;
  title: string;
  startDate: string;
  createdAt: string;
};

export type TaskRow = RepeatRuleRow & {
  id: string;
  title: string;
  start_date: string;
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
    ...rowToRepeatRule(row),
    startDate: row.start_date,
    createdAt: row.created_at,
  };
}

export function rowToCompletion(row: CompletionRow): Completion {
  return { taskId: row.task_id, date: row.date, doneAt: row.done_at };
}

/** Values of a new task, in column order of the INSERT in POST /api/tasks. */
export type NewTask = Omit<Task, "id" | "createdAt">;

/** Checks the body of POST /api/tasks. Fields not used by the repeat type are cleared. Returns the task or an error. */
export function parseNewTask(body: unknown): NewTask | string {
  if (!isRecord(body)) return "Body must be an object.";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (title.length < 1 || title.length > 200) return "`title` must have 1–200 characters.";
  if (!isIsoDate(body.startDate)) return "`startDate` must be a date YYYY-MM-DD.";
  const rule = parseRepeatRule(body);
  if (typeof rule === "string") return rule;
  return { title, startDate: body.startDate, ...rule };
}
