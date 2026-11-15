import { badRequest, json, type Env } from "../../../_lib/http";
import { ENTRY_COLUMNS, rowToEntry, type EntryRow } from "../../../_lib/habits";
import { isIsoDate } from "../../../_lib/validation";

/** The longest range one request may read — a year with a margin (a calendar month or week always fits). */
const MAX_DAYS = 400;

/**
 * GET /api/habits/entries?from=YYYY-MM-DD&to=YYYY-MM-DD — entries of all goals and limits from `from` to `to`
 * (both included), by date and then in the order they were added.
 */
export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!isIsoDate(from) || !isIsoDate(to) || from > to) return badRequest("`from` and `to` must be dates YYYY-MM-DD, from <= to.");
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  if (days > MAX_DAYS) return badRequest(`The range may have at most ${MAX_DAYS} days.`);

  const { results } = await env.DB.prepare(
    `SELECT ${ENTRY_COLUMNS} FROM habit_entries WHERE date BETWEEN ? AND ? ORDER BY date, created_at`,
  )
    .bind(from, to)
    .all<EntryRow>();
  return json(results.map(rowToEntry));
};
