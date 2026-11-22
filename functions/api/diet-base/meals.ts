import { badRequest, json, type Env } from "../../_lib/http";
import {
  checkMealReferences,
  checkPlanReferences,
  idsOf,
  parseMeals,
  parseMode,
  rowToMeal,
  rowToMealPlan,
  usedInBase,
  type MealPlanRow,
  type MealRow,
} from "../../_lib/diet-base";

/**
 * PUT /api/diet-base/meals — body { items: [Meal], mode: "add" | "replace" }: import. A known id replaces the meal's whole
 * content, a new id adds it. "add" keeps meals not in the body; "replace" deletes them — not when a meal plan still uses
 * one. Every product must exist, and saved meal plans must still fit the meals (gain steps ≤ max); error 400 otherwise.
 * Returns { added, updated, deleted }.
 */
export const onRequestPut: PagesFunction<Env> = async ({ env, request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON.");
  }
  const items = parseMeals(body);
  if (typeof items === "string") return badRequest(items);
  const mode = parseMode(body);
  if (!mode) return badRequest('`mode` must be "add" or "replace".');

  const products = await idsOf(env.DB, "diet_products");
  const productError = checkMealReferences(items, products);
  if (productError) return badRequest(productError);

  const [mealRows, planRows, variantIds] = await Promise.all([
    env.DB.prepare("SELECT id, name, tags, recipe, ingredients, gains FROM diet_meals").all<MealRow>(),
    env.DB.prepare("SELECT id, variant_id, name, items FROM diet_meal_plans").all<MealPlanRow>(),
    idsOf(env.DB, "diet_variants"),
  ]);
  const meals = new Map(mealRows.results.map((row) => [row.id, rowToMeal(row)]));
  const existing = new Set(meals.keys());
  const inBody = new Set(items.map((m) => m.id));
  const deleted = mode === "replace" ? [...existing].filter((id) => !inBody.has(id)) : [];
  const plans = planRows.results.map(rowToMealPlan);

  const usedError = usedInBase(new Set(), new Set(deleted), [], plans);
  if (usedError) return badRequest(usedError);
  for (const meal of items) meals.set(meal.id, meal);
  const planError = checkPlanReferences(plans, variantIds, meals, products);
  if (planError) return badRequest(`A saved meal plan would no longer fit: ${planError}`);

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO diet_meals (id, name, tags, recipe, ingredients, gains, updated_at)
       SELECT json_extract(value, '$.id'), json_extract(value, '$.name'), json_extract(value, '$.tags'),
              json_extract(value, '$.recipe'), json_extract(value, '$.ingredients'), json_extract(value, '$.gains'), ?
       FROM json_each(?) WHERE true
       ON CONFLICT (id) DO UPDATE SET name = excluded.name, tags = excluded.tags, recipe = excluded.recipe,
         ingredients = excluded.ingredients, gains = excluded.gains, updated_at = excluded.updated_at`,
    ).bind(new Date().toISOString(), JSON.stringify(items)),
    env.DB.prepare("DELETE FROM diet_meals WHERE id IN (SELECT value FROM json_each(?))").bind(JSON.stringify(deleted)),
  ]);

  const updated = items.filter((m) => existing.has(m.id)).length;
  return json({ added: items.length - updated, updated, deleted: deleted.length });
};
