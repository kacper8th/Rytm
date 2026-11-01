import { badRequest, json, type Env } from "../../_lib/week-plan";
import { syncCurrentLists, PANTRY_COLUMNS, parseAddBody, rowToPantryItem, type PantryItemRow } from "../../_lib/pantry";

/** GET /api/pantry — all pantry items. */
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare(`SELECT ${PANTRY_COLUMNS} FROM pantry_items`).all<PantryItemRow>();
  return json({ items: results.map(rowToPantryItem) });
};

/**
 * POST /api/pantry — body { productId, grams }: adds a product; adds to its grams when it is already there.
 * In the same save its grams are copied to current shopping lists. Returns the item.
 */
export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON.");
  }
  const item = parseAddBody(body);
  if (typeof item === "string") return badRequest(item);

  const [, , saved] = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO pantry_items (product_id, grams, updated_at) VALUES (?, ?, ?)
       ON CONFLICT (product_id) DO UPDATE SET grams = grams + excluded.grams, updated_at = excluded.updated_at`,
    ).bind(item.productId, item.grams, new Date().toISOString()),
    syncCurrentLists(env.DB, item.productId),
    env.DB.prepare(`SELECT ${PANTRY_COLUMNS} FROM pantry_items WHERE product_id = ?`).bind(item.productId),
  ]);

  return json(rowToPantryItem((saved.results as PantryItemRow[])[0]), 201);
};
