import { badRequest, json, notFound, type Env } from "../../../_lib/http";
import { parseDateBody, type HabitKind, type Run } from "../../../_lib/habits";
import { isId } from "../../../_lib/validation";

type RunRow = { id: string; start_date: string };

/** The counter's current run, or a response when the habit is missing or not a counter. */
async function currentRun(env: Env, id: string): Promise<RunRow | Response> {
  const habit = await env.DB.prepare("SELECT kind FROM habits WHERE id = ?").bind(id).first<{ kind: HabitKind }>();
  if (!habit) return notFound("Habit not found.");
  if (habit.kind !== "counter") return badRequest("Only counters can be restarted.");
  const run = await env.DB.prepare("SELECT id, start_date FROM counter_runs WHERE habit_id = ? AND end_date IS NULL")
    .bind(id)
    .first<RunRow>();
  return run ?? notFound("Counter has no current run.");
}

/**
 * POST /api/habits/:id/restart — body: date. Ends the counter's current run on that date and starts a new run on
 * it. The date must not be before the start of the current run or in the future. Returns the new run.
 */
export const onRequestPost: PagesFunction<Env, "id"> = async ({ env, params, request }) => {
  if (!isId(params.id)) return badRequest("Invalid id.");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON.");
  }
  const date = parseDateBody(body);
  if (!date) return badRequest("`date` must be a date YYYY-MM-DD, not in the future.");

  const run = await currentRun(env, params.id);
  if (run instanceof Response) return run;
  if (date < run.start_date) return badRequest("Date is before the start of the current run.");

  const saved: Run = { id: crypto.randomUUID(), habitId: params.id, startDate: date, endDate: null };
  await env.DB.batch([
    env.DB.prepare("UPDATE counter_runs SET end_date = ? WHERE id = ?").bind(date, run.id),
    env.DB.prepare("INSERT INTO counter_runs (id, habit_id, start_date, end_date) VALUES (?, ?, ?, NULL)").bind(
      saved.id,
      saved.habitId,
      saved.startDate,
    ),
  ]);

  return json(saved, 201);
};

/**
 * DELETE /api/habits/:id/restart — undoes the last restart: deletes the current run and opens the previous run
 * again. Fails when the counter was never restarted.
 */
export const onRequestDelete: PagesFunction<Env, "id"> = async ({ env, params }) => {
  if (!isId(params.id)) return badRequest("Invalid id.");
  const run = await currentRun(env, params.id);
  if (run instanceof Response) return run;

  const previous = await env.DB.prepare(
    "SELECT id FROM counter_runs WHERE habit_id = ? AND end_date IS NOT NULL ORDER BY end_date DESC, start_date DESC LIMIT 1",
  )
    .bind(params.id)
    .first<{ id: string }>();
  if (!previous) return badRequest("The counter was never restarted.");

  await env.DB.batch([
    env.DB.prepare("DELETE FROM counter_runs WHERE id = ?").bind(run.id),
    env.DB.prepare("UPDATE counter_runs SET end_date = NULL WHERE id = ?").bind(previous.id),
  ]);

  return new Response(null, { status: 204 });
};
