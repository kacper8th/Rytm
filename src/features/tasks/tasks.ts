import { request } from "../../shared/api";
import type { RepeatRule } from "../../shared/recurrence";

/**
 * Tasks — user data saved on the server (Cloudflare D1 via /api/tasks).
 * The only way screens get or change tasks. See documentation: Modules/Tasks.
 */

/** A recurring task: its name and repeat rule (the rule's start date = the first possible occurrence). */
export type Task = RepeatRule & {
  id: string;
  title: string;
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
