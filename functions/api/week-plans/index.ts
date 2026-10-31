import { json, type Env } from "../../_lib/week-plan";

/** GET /api/week-plans — weeks that have saved days, newest first (for picking a week to copy from). */
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare(
    "SELECT week_start, COUNT(*) AS days FROM week_plan_days GROUP BY week_start ORDER BY week_start DESC",
  ).all<{ week_start: string; days: number }>();

  return json({ weeks: results.map((row) => ({ weekStart: row.week_start, days: row.days })) });
};
