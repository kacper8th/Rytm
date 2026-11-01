import { badRequest, json, type Env } from "../../../../_lib/http";
import { parseDay, parseDayBody, parseWeekStart } from "../../../../_lib/week-plan";

type Params = "week" | "day";

function parseParams(params: Record<Params, string | string[]>): { weekStart: string; day: number } | Response {
  const weekStart = parseWeekStart(params.week);
  if (!weekStart) return badRequest("Week must be a Monday as YYYY-MM-DD.");
  const day = parseDay(params.day);
  if (day === null) return badRequest("Day must be 0 (Monday) … 6 (Sunday).");
  return { weekStart, day };
}

/** PUT /api/week-plans/:week/days/:day — saves the day (replaces the previous one). Last save wins. */
export const onRequestPut: PagesFunction<Env, Params> = async ({ env, params, request }) => {
  const target = parseParams(params);
  if (target instanceof Response) return target;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON.");
  }
  const parsed = parseDayBody(body);
  if (typeof parsed === "string") return badRequest(parsed);

  const updatedAt = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO week_plan_days (week_start, day, items, source, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (week_start, day) DO UPDATE SET items = excluded.items, source = excluded.source, updated_at = excluded.updated_at`,
  )
    .bind(target.weekStart, target.day, JSON.stringify(parsed.items), parsed.source && JSON.stringify(parsed.source), updatedAt)
    .run();

  return json({ day: target.day, items: parsed.items, source: parsed.source, updatedAt });
};

/** DELETE /api/week-plans/:week/days/:day — clears the day. */
export const onRequestDelete: PagesFunction<Env, Params> = async ({ env, params }) => {
  const target = parseParams(params);
  if (target instanceof Response) return target;

  await env.DB.prepare("DELETE FROM week_plan_days WHERE week_start = ? AND day = ?").bind(target.weekStart, target.day).run();
  return new Response(null, { status: 204 });
};
