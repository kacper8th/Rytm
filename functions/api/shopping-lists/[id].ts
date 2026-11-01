import { badRequest, json, notFound, type Env } from "../../_lib/http";
import {
  isListId,
  ITEM_COLUMNS,
  rowToItem,
  rowToSummary,
  type ShoppingListItemRow,
  type ShoppingListRow,
} from "../../_lib/shopping-list";

/** GET /api/shopping-lists/:id — the list with all its items. */
export const onRequestGet: PagesFunction<Env, "id"> = async ({ env, params }) => {
  if (!isListId(params.id)) return badRequest("Unknown list id.");

  const [list, items] = await env.DB.batch([
    env.DB.prepare("SELECT id, date_from, date_to, planned_days, created_at FROM shopping_lists WHERE id = ?").bind(
      params.id,
    ),
    env.DB.prepare(
      `SELECT ${ITEM_COLUMNS} FROM shopping_list_items WHERE list_id = ? ORDER BY name`,
    ).bind(params.id),
  ]);
  const row = (list.results as ShoppingListRow[])[0];
  if (!row) return notFound("List not found.");

  return json({ ...rowToSummary(row), items: (items.results as ShoppingListItemRow[]).map(rowToItem) });
};

/** DELETE /api/shopping-lists/:id — removes the list and its items. */
export const onRequestDelete: PagesFunction<Env, "id"> = async ({ env, params }) => {
  if (!isListId(params.id)) return badRequest("Unknown list id.");

  await env.DB.batch([
    env.DB.prepare("DELETE FROM shopping_list_items WHERE list_id = ?").bind(params.id),
    env.DB.prepare("DELETE FROM shopping_lists WHERE id = ?").bind(params.id),
  ]);
  return new Response(null, { status: 204 });
};
