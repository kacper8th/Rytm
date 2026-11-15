import { badRequest, json, notFound, type Env } from "../../../_lib/http";
import { rowToRun, RUN_COLUMNS, type RunRow } from "../../../_lib/habits";
import { isId } from "../../../_lib/validation";

/** GET /api/habits/:id/runs — all runs of a counter, the newest first (the current run has no end date). */
export const onRequestGet: PagesFunction<Env, "id"> = async ({ env, params }) => {
  if (!isId(params.id)) return badRequest("Invalid id.");
  const habit = await env.DB.prepare("SELECT kind FROM habits WHERE id = ?").bind(params.id).first();
  if (!habit) return notFound("Habit not found.");

  const { results } = await env.DB.prepare(
    `SELECT ${RUN_COLUMNS} FROM counter_runs WHERE habit_id = ? ORDER BY start_date DESC, end_date IS NULL DESC`,
  )
    .bind(params.id)
    .all<RunRow>();
  return json(results.map(rowToRun));
};
