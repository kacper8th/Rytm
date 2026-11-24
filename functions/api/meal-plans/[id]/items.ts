import { badRequest, json, notFound, type Env } from "../../../_lib/http";
import { isRecord } from "../../../_lib/validation";
import { checkPlanReferences, idsOf, isUuid, parsePlanItems, rowToMeal, type MealRow } from "../../../_lib/diet-base";

/**
 * PUT /api/meal-plans/:id/items — body { items }: replaces the items of the meal plan (edit in the app; last save wins).
 * The items follow the rules of the import; every meal and product must exist and gain steps must fit the meal.
 * Returns { id, items }.
 */
export const onRequestPut: PagesFunction<Env, "id"> = async ({ env, params, request }) => {
  const id = params.id;
  if (!isUuid(id)) return badRequest("Plan id must be a UUID.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON.");
  }
  if (!isRecord(body)) return badRequest("Body must be { items }.");
  const items = parsePlanItems(body.items);
  if (typeof items === "string") return badRequest(items);

  const plan = await env.DB.prepare("SELECT variant_id FROM diet_meal_plans WHERE id = ?")
    .bind(id)
    .first<{ variant_id: string }>();
  if (!plan) return notFound("Meal plan not found.");

  const [mealRows, products] = await Promise.all([
    env.DB.prepare("SELECT id, name, tags, recipe, ingredients, gains FROM diet_meals").all<MealRow>(),
    idsOf(env.DB, "diet_products"),
  ]);
  const meals = new Map(mealRows.results.map((row) => [row.id, rowToMeal(row)]));
  const error = checkPlanReferences(
    [{ id, variantId: plan.variant_id, name: "", items }],
    new Set([plan.variant_id]),
    meals,
    products,
  );
  if (error) return badRequest(error);

  const result = await env.DB.prepare("UPDATE diet_meal_plans SET items = ?, updated_at = ? WHERE id = ?")
    .bind(JSON.stringify(items), new Date().toISOString(), id)
    .run();
  if (!result.meta.changes) return notFound("Meal plan not found.");

  return json({ id, items });
};
