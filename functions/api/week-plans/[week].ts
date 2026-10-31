import { badRequest, json, parseWeekStart, rowToDay, type Env, type WeekPlanDayRow } from "../../_lib/week-plan";

/** GET /api/week-plans/:week — saved days of the week (days without a plan are left out). */
export const onRequestGet: PagesFunction<Env, "week"> = async ({ env, params }) => {
  const weekStart = parseWeekStart(params.week);
  if (!weekStart) return badRequest("Week must be a Monday as YYYY-MM-DD.");

  const { results } = await env.DB.prepare(
    "SELECT day, items, source, updated_at FROM week_plan_days WHERE week_start = ? ORDER BY day",
  )
    .bind(weekStart)
    .all<WeekPlanDayRow>();

  return json({ weekStart, days: results.map(rowToDay) });
};
