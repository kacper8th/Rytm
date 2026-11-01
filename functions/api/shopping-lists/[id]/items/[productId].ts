import { badRequest, json, notFound, type Env } from "../../../../_lib/http";
import {
  ITEM_COLUMNS,
  parseEditBody,
  rowToItem,
  type ShoppingListItemRow,
} from "../../../../_lib/shopping-list";

type Params = "id" | "productId";

/** Own items (Manual items) — must match CUSTOM_PREFIX in _lib/shopping-list.ts. */
const IS_OWN = "product_id LIKE 'custom-%'";

/**
 * PATCH /api/shopping-lists/:id/items/:productId — last save wins.
 * - body { checked }: checks off a product or un-checks it; returns { productId, checked };
 * - body { addedGrams }: changes the grams added by hand to a product (Manual items); returns the item;
 * - body { name, amount }: changes an own item (Manual items); returns the item.
 */
export const onRequestPatch: PagesFunction<Env, Params> = async ({ env, params, request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON.");
  }
  const edit = parseEditBody(body);
  if (typeof edit === "string") return badRequest(edit);

  if (edit.kind === "checked") {
    const result = await env.DB.prepare("UPDATE shopping_list_items SET checked = ? WHERE list_id = ? AND product_id = ?")
      .bind(edit.checked ? 1 : 0, params.id, params.productId)
      .run();
    if (!result.meta.changes) return notFound("Item not found.");
    return json({ productId: params.productId, checked: edit.checked });
  }

  const update =
    edit.kind === "addedGrams"
      ? env.DB.prepare(
          `UPDATE shopping_list_items SET added_grams = ?
           WHERE list_id = ? AND product_id = ? AND NOT ${IS_OWN} AND added_grams IS NOT NULL`,
        ).bind(edit.grams, params.id, params.productId)
      : env.DB.prepare(
          `UPDATE shopping_list_items SET name = ?, amount = ? WHERE list_id = ? AND product_id = ? AND ${IS_OWN}`,
        ).bind(edit.name, edit.amount, params.id, params.productId);

  const [result, saved] = await env.DB.batch([
    update,
    env.DB.prepare(`SELECT ${ITEM_COLUMNS} FROM shopping_list_items WHERE list_id = ? AND product_id = ?`).bind(
      params.id,
      params.productId,
    ),
  ]);
  if (!result.meta.changes) return notFound("No item added by hand with this id.");

  return json(rowToItem((saved.results as ShoppingListItemRow[])[0]));
};

/**
 * DELETE /api/shopping-lists/:id/items/:productId — removes what was added by hand (Manual items):
 * an own item or a product added only by hand is removed; a product from the plan loses only its added grams.
 */
export const onRequestDelete: PagesFunction<Env, Params> = async ({ env, params }) => {
  const [removed, cleared] = await env.DB.batch([
    env.DB.prepare(
      `DELETE FROM shopping_list_items WHERE list_id = ? AND product_id = ? AND (${IS_OWN} OR days = '{}')`,
    ).bind(params.id, params.productId),
    env.DB.prepare(
      "UPDATE shopping_list_items SET added_grams = NULL WHERE list_id = ? AND product_id = ? AND added_grams IS NOT NULL",
    ).bind(params.id, params.productId),
  ]);
  if (!removed.meta.changes && !cleared.meta.changes) return notFound("No item added by hand with this id.");

  return new Response(null, { status: 204 });
};
