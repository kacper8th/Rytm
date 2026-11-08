import { request } from "../../shared/api";

/**
 * Tasks — user data saved on the server (Cloudflare D1 via /api/tasks).
 * The only way screens get or change tasks. See documentation: Modules/Tasks.
 */

/** days = every N days · weekly = chosen weekdays every N weeks · month_day = day 1–28 · month_weekday = n-th weekday. */
export type RepeatType = "days" | "weekly" | "month_day" | "month_weekday";

export type Task = {
  id: string;
  title: string;
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
  createdAt: string;
};

/** An occurrence marked as done. */
export type Completion = { taskId: string; date: string; doneAt: string };

export type NewTask = Omit<Task, "id" | "createdAt">;

export type TasksData = { tasks: Task[]; completions: Completion[] };

const taskUrl = (id: string) => `/api/tasks/${encodeURIComponent(id)}`;
const completionUrl = (id: string, date: string) => `${taskUrl(id)}/completions/${date}`;

export async function getTasks(): Promise<TasksData> {
  const response = await request("/api/tasks");
  return (await response.json()) as TasksData;
}

export async function addTask(task: NewTask): Promise<Task> {
  const response = await request("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task),
  });
  return (await response.json()) as Task;
}

/** Replaces the name, start date and repeat rule; done occurrences are kept. Returns the task. */
export async function updateTask(id: string, task: NewTask): Promise<Task> {
  const response = await request(taskUrl(id), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task),
  });
  return (await response.json()) as Task;
}

/** Deletes the whole series together with its done occurrences. */
export async function deleteTask(id: string): Promise<void> {
  await request(taskUrl(id), { method: "DELETE" });
}

export async function markDone(id: string, date: string): Promise<void> {
  await request(completionUrl(id, date), { method: "PUT" });
}

/** The occurrence becomes overdue or due again, depending on its date. */
export async function unmarkDone(id: string, date: string): Promise<void> {
  await request(completionUrl(id, date), { method: "DELETE" });
}
