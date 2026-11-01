import { badRequest, json, type Env } from "../../_lib/week-plan";
import { notFound } from "../../_lib/shopping-list";
import { PANTRY_COLUMNS, parseEditBody, rowToPantryItem, type PantryItemRow } from "../../_lib/pantry";

/** PATCH /api/pantry/:productId — body { grams }: changes the grams of a pantry product; returns the item. */
export const onRequestPatch: PagesFunction<Env, "productId"> = async ({ env, params, request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON.");
  }
  const grams = parseEditBody(body);
  if (typeof grams === "string") return badRequest(grams);

  const [result, saved] = await env.DB.batch([
    env.DB.prepare("UPDATE pantry_items SET grams = ?, updated_at = ? WHERE product_id = ?").bind(
      grams,
      new Date().toISOString(),
      params.productId,
    ),
    env.DB.prepare(`SELECT ${PANTRY_COLUMNS} FROM pantry_items WHERE product_id = ?`).bind(params.productId),
  ]);
  if (!result.meta.changes) return notFound("Product not in the pantry.");

  return json(rowToPantryItem((saved.results as PantryItemRow[])[0]));
};

/** DELETE /api/pantry/:productId — removes a product from the pantry. */
export const onRequestDelete: PagesFunction<Env, "productId"> = async ({ env, params }) => {
  const result = await env.DB.prepare("DELETE FROM pantry_items WHERE product_id = ?").bind(params.productId).run();
  if (!result.meta.changes) return notFound("Product not in the pantry.");

  return new Response(null, { status: 204 });
};
