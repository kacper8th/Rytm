import { badRequest, json, notFound, type Env } from "../../_lib/http";
import {
  HABIT_SELECT,
  habitValues,
  parseNewHabit,
  rowToHabit,
  type HabitKind,
  type HabitRow,
} from "../../_lib/habits";
import { isId } from "../../_lib/validation";

/**
 * PUT /api/habits/:id — body as in POST /api/habits; the kind cannot change. Goal / limit: replaces all fields;
 * entries are kept and judged by the new target. Counter: replaces the name and the start date of the current run
 * (not before the start of the previous run; the previous run then ends on the new date). Returns the habit.
 */
export const onRequestPut: PagesFunction<Env, "id"> = async ({ env, params, request }) => {
  if (!isId(params.id)) return badRequest("Invalid id.");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON.");
  }
  const current = await env.DB.prepare("SELECT kind FROM habits WHERE id = ?")
    .bind(params.id)
    .first<{ kind: HabitKind }>();
  if (!current) return notFound("Habit not found.");
  const habit = parseNewHabit(body, current.kind);
  if (typeof habit === "string") return badRequest(habit);

  if (habit.kind === "counter") {
    const runs = await env.DB.prepare(
      "SELECT id, start_date, end_date FROM counter_runs WHERE habit_id = ? ORDER BY start_date DESC, end_date IS NULL DESC LIMIT 2",
    )
      .bind(params.id)
      .all<{ id: string; start_date: string; end_date: string | null }>();
    const [run, previous] = runs.results;
    if (!run) return notFound("Counter has no run.");
    if (previous && habit.startDate < previous.start_date) {
      return badRequest("`startDate` is before the start of the previous run.");
    }
    const statements = [
      env.DB.prepare("UPDATE counter_runs SET start_date = ? WHERE id = ?").bind(habit.startDate, run.id),
      // Without earlier runs the counter's start date is the start of its only run.
      env.DB.prepare("UPDATE habits SET name = ?, start_date = CASE WHEN ? THEN start_date ELSE ? END WHERE id = ?").bind(
        habit.name,
        previous ? 1 : 0,
        habit.startDate,
        params.id,
      ),
    ];
    if (previous) {
      statements.push(env.DB.prepare("UPDATE counter_runs SET end_date = ? WHERE id = ?").bind(habit.startDate, previous.id));
    }
    await env.DB.batch(statements);
  } else {
    await env.DB.prepare(
      `UPDATE habits SET name = ?, start_date = ?, schedule = ?, repeat_type = ?, interval = ?, weekdays = ?, month_day = ?,
         week_of_month = ?, weekday = ?, period = ?, target = ?, unit = ?, button_values = ?
       WHERE id = ?`,
    )
      .bind(...habitValues(habit), params.id)
      .run();
  }

  const saved = await env.DB.prepare(`${HABIT_SELECT} WHERE h.id = ?`).bind(params.id).first<HabitRow>();
  if (!saved) return notFound("Habit not found.");
  return json(rowToHabit(saved));
};

/** DELETE /api/habits/:id — removes the habit together with all its entries and runs. */
export const onRequestDelete: PagesFunction<Env, "id"> = async ({ env, params }) => {
  if (!isId(params.id)) return badRequest("Invalid id.");
  const [, , result] = await env.DB.batch([
    env.DB.prepare("DELETE FROM habit_entries WHERE habit_id = ?").bind(params.id),
    env.DB.prepare("DELETE FROM counter_runs WHERE habit_id = ?").bind(params.id),
    env.DB.prepare("DELETE FROM habits WHERE id = ?").bind(params.id),
  ]);
  if (!result.meta.changes) return notFound("Habit not found.");

  return new Response(null, { status: 204 });
};
