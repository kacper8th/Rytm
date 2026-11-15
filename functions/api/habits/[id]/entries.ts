import { badRequest, json, notFound, type Env } from "../../../_lib/http";
import { parseNewEntry, type Entry, type HabitKind } from "../../../_lib/habits";
import { isId } from "../../../_lib/validation";

/**
 * POST /api/habits/:id/entries — body: date, amount. Adds one entry to a goal or limit (one click or one amount
 * typed by hand). The date must not be before the habit's start date or in the future. Returns the entry.
 */
export const onRequestPost: PagesFunction<Env, "id"> = async ({ env, params, request }) => {
  if (!isId(params.id)) return badRequest("Invalid id.");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON.");
  }
  const entry = parseNewEntry(body);
  if (typeof entry === "string") return badRequest(entry);

  const habit = await env.DB.prepare("SELECT kind, start_date FROM habits WHERE id = ?")
    .bind(params.id)
    .first<{ kind: HabitKind; start_date: string }>();
  if (!habit) return notFound("Habit not found.");
  if (habit.kind === "counter") return badRequest("Counters have no entries.");
  if (entry.date < habit.start_date) return badRequest("Date is before the habit's start date.");

  const saved: Entry = { id: crypto.randomUUID(), habitId: params.id, ...entry, createdAt: new Date().toISOString() };
  await env.DB.prepare("INSERT INTO habit_entries (id, habit_id, date, amount, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(saved.id, saved.habitId, saved.date, saved.amount, saved.createdAt)
    .run();

  return json(saved, 201);
};
