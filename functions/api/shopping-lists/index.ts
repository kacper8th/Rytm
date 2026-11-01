import { badRequest, json, type Env } from "../../_lib/http";
import { parseListBody, rowToSummary, type ShoppingListRow } from "../../_lib/shopping-list";

type SummaryRow = ShoppingListRow & { items: number; checked: number };

/**
 * Items to buy — the same rule as isInPantry() in src/features/diet/week-plan/shopping-list/shopping-list.ts:
 * not in the pantry, or grams added by hand, or the plan needs more than the pantry has.
 */
const TO_BUY = `(i.pantry_grams IS NULL OR i.added_grams IS NOT NULL
  OR (SELECT COALESCE(SUM(value), 0) FROM json_each(i.days)) > i.pantry_grams)`;

/**
 * GET /api/shopping-lists — saved lists, newest first, with the number of products and of bought products
 * (both only items to buy — products covered by the pantry are left out).
 */
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare(
    `SELECT l.id, l.date_from, l.date_to, l.planned_days, l.created_at,
            COUNT(i.product_id) AS items, COALESCE(SUM(i.checked), 0) AS checked
     FROM shopping_lists l LEFT JOIN shopping_list_items i ON i.list_id = l.id AND ${TO_BUY}
     GROUP BY l.id ORDER BY l.created_at DESC`,
  ).all<SummaryRow>();

  return json({ lists: results.map((row) => ({ ...rowToSummary(row), items: row.items, checked: row.checked })) });
};

/**
 * POST /api/shopping-lists — body { from, to, plannedDays, items }: saves a new list (items calculated by the app).
 * Runs as one transaction; returns { id }.
 */
export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON.");
  }
  const parsed = parseListBody(body);
  if (typeof parsed === "string") return badRequest(parsed);

  const id = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO shopping_lists (id, date_from, date_to, planned_days, created_at) VALUES (?, ?, ?, ?, ?)",
    ).bind(id, parsed.from, parsed.to, parsed.plannedDays, new Date().toISOString()),
    // All items in one statement: D1 limits the number of queries per request.
    env.DB.prepare(
      `INSERT INTO shopping_list_items (list_id, product_id, name, category, days, pantry_grams)
       SELECT ?, json_extract(value, '$.productId'), json_extract(value, '$.name'),
              json_extract(value, '$.category'), json_extract(value, '$.days'), json_extract(value, '$.pantryGrams')
       FROM json_each(?)`,
    ).bind(id, JSON.stringify(parsed.items)),
  ]);

  return json({ id }, 201);
};
