import { badRequest, json, type Env } from "../../_lib/http";
import {
  HABIT_SELECT,
  HABIT_VALUE_COLUMNS,
  habitValues,
  parseNewHabit,
  rowToHabit,
  type Habit,
  type HabitRow,
} from "../../_lib/habits";

/** GET /api/habits — all goals, limits and counters (counters with the start of their current run), by name. */
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare(`${HABIT_SELECT} ORDER BY h.name COLLATE NOCASE`).all<HabitRow>();
  return json(results.map(rowToHabit));
};

/**
 * POST /api/habits — body: kind, name, startDate and the fields of that kind (goal: schedule + rule or period,
 * target, unit, buttonValues; limit: period, target, unit, buttonValues). A counter starts its first run on
 * startDate. Returns the habit.
 */
export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON.");
  }
  const habit = parseNewHabit(body);
  if (typeof habit === "string") return badRequest(habit);

  const saved: Habit = {
    ...habit,
    id: crypto.randomUUID(),
    runStart: habit.kind === "counter" ? habit.startDate : null,
    createdAt: new Date().toISOString(),
  };
  const insert = env.DB.prepare(
    `INSERT INTO habits (id, kind, ${HABIT_VALUE_COLUMNS}, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(saved.id, saved.kind, ...habitValues(saved), saved.createdAt);
  const statements = [insert];
  if (saved.kind === "counter") {
    statements.push(
      env.DB.prepare("INSERT INTO counter_runs (id, habit_id, start_date, end_date) VALUES (?, ?, ?, NULL)").bind(
        crypto.randomUUID(),
        saved.id,
        saved.startDate,
      ),
    );
  }
  await env.DB.batch(statements);

  return json(saved, 201);
};
