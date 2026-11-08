import { badRequest, json, type Env } from "../../_lib/http";
import {
  COMPLETION_COLUMNS,
  parseNewTask,
  rowToCompletion,
  rowToTask,
  TASK_COLUMNS,
  type CompletionRow,
  type Task,
  type TaskRow,
} from "../../_lib/tasks";

/** GET /api/tasks — all tasks and all occurrences marked as done. */
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const [tasks, completions] = await env.DB.batch([
    env.DB.prepare(`SELECT ${TASK_COLUMNS} FROM tasks ORDER BY title COLLATE NOCASE`),
    env.DB.prepare(`SELECT ${COMPLETION_COLUMNS} FROM task_completions`),
  ]);
  return json({
    tasks: (tasks.results as TaskRow[]).map(rowToTask),
    completions: (completions.results as CompletionRow[]).map(rowToCompletion),
  });
};

/** POST /api/tasks — body: title, startDate, repeatType and the fields of that repeat type. Returns the task. */
export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON.");
  }
  const task = parseNewTask(body);
  if (typeof task === "string") return badRequest(task);

  const saved: Task = { ...task, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  await env.DB.prepare(
    `INSERT INTO tasks (${TASK_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      saved.id,
      saved.title,
      saved.repeatType,
      saved.startDate,
      saved.interval,
      saved.weekdays.length ? saved.weekdays.join(",") : null,
      saved.monthDay,
      saved.weekOfMonth,
      saved.weekday,
      saved.createdAt,
    )
    .run();

  return json(saved, 201);
};
