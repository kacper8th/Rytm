import { badRequest, json, type Env } from "../../_lib/http";
import {
  parseMode,
  parseProducts,
  rowToMeal,
  rowToMealPlan,
  usedInBase,
  type MealPlanRow,
  type MealRow,
} from "../../_lib/diet-base";

/**
 * PUT /api/diet-base/products — body { items: [Product], mode: "add" | "replace" }: import. A known id updates the product,
 * a new id adds it. "add" keeps products not in the body; "replace" deletes them — not when a meal or a meal plan
 * still uses one (error 400). All in one batch. Returns { added, updated, deleted }.
 */
export const onRequestPut: PagesFunction<Env> = async ({ env, request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON.");
  }
  const items = parseProducts(body);
  if (typeof items === "string") return badRequest(items);
  const mode = parseMode(body);
  if (!mode) return badRequest('`mode` must be "add" or "replace".');

  const { results } = await env.DB.prepare("SELECT id FROM diet_products").all<{ id: string }>();
  const existing = new Set(results.map((r) => r.id));
  const inBody = new Set(items.map((p) => p.id));
  const deleted = mode === "replace" ? [...existing].filter((id) => !inBody.has(id)) : [];

  if (deleted.length > 0) {
    const [meals, plans] = await Promise.all([
      env.DB.prepare("SELECT id, name, tags, recipe, ingredients, gains FROM diet_meals").all<MealRow>(),
      env.DB.prepare("SELECT id, variant_id, name, items FROM diet_meal_plans").all<MealPlanRow>(),
    ]);
    const error = usedInBase(new Set(deleted), new Set(), meals.results.map(rowToMeal), plans.results.map(rowToMealPlan));
    if (error) return badRequest(error);
  }

  await env.DB.batch([
    // One statement for all items (D1 limits queries per request); WHERE true lets SQLite read ON CONFLICT after SELECT.
    env.DB.prepare(
      `INSERT INTO diet_products (id, name, category, brand, nutrients, updated_at)
       SELECT json_extract(value, '$.id'), json_extract(value, '$.name'), json_extract(value, '$.category'),
              json_extract(value, '$.brand'), json_extract(value, '$.nutrients'), ?
       FROM json_each(?) WHERE true
       ON CONFLICT (id) DO UPDATE SET name = excluded.name, category = excluded.category, brand = excluded.brand,
         nutrients = excluded.nutrients, updated_at = excluded.updated_at`,
    ).bind(new Date().toISOString(), JSON.stringify(items)),
    env.DB.prepare("DELETE FROM diet_products WHERE id IN (SELECT value FROM json_each(?))").bind(JSON.stringify(deleted)),
  ]);

  const updated = items.filter((p) => existing.has(p.id)).length;
  return json({ added: items.length - updated, updated, deleted: deleted.length });
};
