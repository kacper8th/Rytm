import { badRequest, json, notFound, type Env } from "../../_lib/http";
import { isId, parseNewTask, type Task } from "../../_lib/tasks";

/**
 * PUT /api/tasks/:id — body as in POST /api/tasks: replaces the task's name, start date and repeat rule.
 * Done occurrences are kept (they belong to dates, not to the rule). Returns the task.
 */
export const onRequestPut: PagesFunction<Env, "id"> = async ({ env, params, request }) => {
  if (!isId(params.id)) return badRequest("Invalid id.");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON.");
  }
  const task = parseNewTask(body);
  if (typeof task === "string") return badRequest(task);

  const saved = await env.DB.prepare(
    `UPDATE tasks SET title = ?, repeat_type = ?, start_date = ?, interval = ?, weekdays = ?, month_day = ?,
       week_of_month = ?, weekday = ?
     WHERE id = ? RETURNING created_at`,
  )
    .bind(
      task.title,
      task.repeatType,
      task.startDate,
      task.interval,
      task.weekdays.length ? task.weekdays.join(",") : null,
      task.monthDay,
      task.weekOfMonth,
      task.weekday,
      params.id,
    )
    .first<{ created_at: string }>();
  if (!saved) return notFound("Task not found.");

  const result: Task = { ...task, id: params.id, createdAt: saved.created_at };
  return json(result);
};

/** DELETE /api/tasks/:id — removes the task (the whole series) together with its done occurrences. */
export const onRequestDelete: PagesFunction<Env, "id"> = async ({ env, params }) => {
  if (!isId(params.id)) return badRequest("Invalid id.");
  const [, result] = await env.DB.batch([
    env.DB.prepare("DELETE FROM task_completions WHERE task_id = ?").bind(params.id),
    env.DB.prepare("DELETE FROM tasks WHERE id = ?").bind(params.id),
  ]);
  if (!result.meta.changes) return notFound("Task not found.");

  return new Response(null, { status: 204 });
};
