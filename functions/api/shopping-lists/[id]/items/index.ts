import { badRequest, json, notFound, type Env } from "../../../../_lib/http";
import {
  CUSTOM_CATEGORY,
  CUSTOM_PREFIX,
  isListId,
  ITEM_COLUMNS,
  parseAddBody,
  rowToItem,
  type ShoppingListItemRow,
} from "../../../../_lib/shopping-list";

/**
 * POST /api/shopping-lists/:id/items — adds an item by hand (Manual items); returns the item as saved.
 * - body { productId, name, category, grams }: a product — added to its row (added_grams) and un-checked; a new row
 *   (no days) when the product is not on the list yet. pantry_grams stays: the pantry covers only the planned grams,
 *   grams added by hand are always to buy;
 * - body { name, amount }: an own item (id "custom-…", category "inne").
 */
export const onRequestPost: PagesFunction<Env, "id"> = async ({ env, params, request }) => {
  if (!isListId(params.id)) return badRequest("Unknown list id.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON.");
  }
  const item = parseAddBody(body);
  if (typeof item === "string") return badRequest(item);

  const list = await env.DB.prepare("SELECT id FROM shopping_lists WHERE id = ?").bind(params.id).first();
  if (!list) return notFound("List not found.");

  const productId = item.kind === "product" ? item.productId : `${CUSTOM_PREFIX}${crypto.randomUUID()}`;
  const insert =
    item.kind === "product"
      ? env.DB.prepare(
          `INSERT INTO shopping_list_items (list_id, product_id, name, category, days, added_grams) VALUES (?, ?, ?, ?, '{}', ?)
           ON CONFLICT (list_id, product_id) DO UPDATE SET added_grams = COALESCE(added_grams, 0) + excluded.added_grams, checked = 0`,
        ).bind(params.id, productId, item.name, item.category, item.grams)
      : env.DB.prepare(
          "INSERT INTO shopping_list_items (list_id, product_id, name, category, days, amount) VALUES (?, ?, ?, ?, '{}', ?)",
        ).bind(params.id, productId, item.name, CUSTOM_CATEGORY, item.amount);

  const [, saved] = await env.DB.batch([
    insert,
    env.DB.prepare(`SELECT ${ITEM_COLUMNS} FROM shopping_list_items WHERE list_id = ? AND product_id = ?`).bind(
      params.id,
      productId,
    ),
  ]);

  return json(rowToItem((saved.results as ShoppingListItemRow[])[0]), 201);
};
