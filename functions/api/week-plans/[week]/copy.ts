import { badRequest, json, type Env } from "../../../_lib/http";
import { parseWeekStart, rowToDay, type WeekPlanDayRow } from "../../../_lib/week-plan";

/**
 * POST /api/week-plans/:week/copy — body { from }: the week becomes an exact copy of the `from` week
 * (its own days are removed first). Runs as one transaction; returns the week as saved.
 */
export const onRequestPost: PagesFunction<Env, "week"> = async ({ env, params, request }) => {
  const weekStart = parseWeekStart(params.week);
  if (!weekStart) return badRequest("Week must be a Monday as YYYY-MM-DD.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON.");
  }
  const from = parseWeekStart((body as { from?: unknown } | null)?.from);
  if (!from) return badRequest("`from` must be a Monday as YYYY-MM-DD.");
  if (from === weekStart) return badRequest("Source and target week are the same.");

  const source = await env.DB.prepare("SELECT COUNT(*) AS days FROM week_plan_days WHERE week_start = ?")
    .bind(from)
    .first<{ days: number }>();
  if (!source?.days) return badRequest("Source week has no saved days.");

  const updatedAt = new Date().toISOString();
  const [, , saved] = await env.DB.batch([
    env.DB.prepare("DELETE FROM week_plan_days WHERE week_start = ?").bind(weekStart),
    env.DB.prepare(
      `INSERT INTO week_plan_days (week_start, day, items, source, updated_at)
       SELECT ?, day, items, source, ? FROM week_plan_days WHERE week_start = ?`,
    ).bind(weekStart, updatedAt, from),
    env.DB.prepare("SELECT day, items, source, updated_at FROM week_plan_days WHERE week_start = ? ORDER BY day").bind(
      weekStart,
    ),
  ]);

  return json({ weekStart, days: (saved.results as WeekPlanDayRow[]).map(rowToDay) });
};
