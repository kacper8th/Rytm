import { badRequest, notFound, type Env } from "../../../../_lib/http";
import { isId, isIsoDate } from "../../../../_lib/tasks";

/**
 * PUT /api/tasks/:id/completions/:date — marks the occurrence on that date as done (again = no change).
 * The server checks only that the task exists and the date is not before its start; the app picks real occurrences.
 */
export const onRequestPut: PagesFunction<Env, "id" | "date"> = async ({ env, params }) => {
  if (!isId(params.id)) return badRequest("Invalid id.");
  if (!isIsoDate(params.date)) return badRequest("Date must be YYYY-MM-DD.");

  const task = await env.DB.prepare("SELECT start_date FROM tasks WHERE id = ?")
    .bind(params.id)
    .first<{ start_date: string }>();
  if (!task) return notFound("Task not found.");
  if (params.date < task.start_date) return badRequest("Date is before the task's start date.");

  await env.DB.prepare(
    "INSERT INTO task_completions (task_id, date, done_at) VALUES (?, ?, ?) ON CONFLICT (task_id, date) DO NOTHING",
  )
    .bind(params.id, params.date, new Date().toISOString())
    .run();

  return new Response(null, { status: 204 });
};

/** DELETE /api/tasks/:id/completions/:date — unmarks the occurrence; it becomes overdue or due again by its date. */
export const onRequestDelete: PagesFunction<Env, "id" | "date"> = async ({ env, params }) => {
  if (!isId(params.id)) return badRequest("Invalid id.");
  if (!isIsoDate(params.date)) return badRequest("Date must be YYYY-MM-DD.");

  const result = await env.DB.prepare("DELETE FROM task_completions WHERE task_id = ? AND date = ?")
    .bind(params.id, params.date)
    .run();
  if (!result.meta.changes) return notFound("Occurrence is not marked as done.");

  return new Response(null, { status: 204 });
};
