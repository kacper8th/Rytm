import { badRequest, json, type Env } from "../../../../_lib/week-plan";
import { notFound } from "../../../../_lib/shopping-list";

type Params = "id" | "productId";

/** PATCH /api/shopping-lists/:id/items/:productId — body { checked }: checks off a product or un-checks it. Last save wins. */
export const onRequestPatch: PagesFunction<Env, Params> = async ({ env, params, request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON.");
  }
  const checked = (body as { checked?: unknown } | null)?.checked;
  if (typeof checked !== "boolean") return badRequest("`checked` must be true or false.");

  const result = await env.DB.prepare("UPDATE shopping_list_items SET checked = ? WHERE list_id = ? AND product_id = ?")
    .bind(checked ? 1 : 0, params.id, params.productId)
    .run();
  if (!result.meta.changes) return notFound("Item not found.");

  return json({ productId: params.productId, checked });
};
