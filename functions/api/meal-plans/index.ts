import { badRequest, json, notFound, type Env } from "../../_lib/http";
import { isRecord } from "../../_lib/validation";
import { checkPlanReferences, idsOf, isUuid, parsePlanItems, parsePlanName, rowToMeal, type MealRow } from "../../_lib/diet-base";

/**
 * POST /api/meal-plans — body { variantId, name, items }: adds a new meal plan to the variant (new plan in the app).
 * The name follows the rename rules, the items the rules of the edit; the plan gets a new id and goes to the end of the order.
 * Returns { id, variantId, name, items }.
 */
export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON.");
  }
  if (!isRecord(body)) return badRequest("Body must be { variantId, name, items }.");
  const variantId = body.variantId;
  if (!isUuid(variantId)) return badRequest("variantId must be a UUID.");
  const name = parsePlanName(body);
  if (typeof name !== "string") return badRequest(name.error);
  const items = parsePlanItems(body.items);
  if (typeof items === "string") return badRequest(items);

  const [variants, mealRows, products] = await Promise.all([
    idsOf(env.DB, "diet_variants"),
    env.DB.prepare("SELECT id, name, tags, recipe, ingredients, gains FROM diet_meals").all<MealRow>(),
    idsOf(env.DB, "diet_products"),
  ]);
  if (!variants.has(variantId)) return notFound("Variant not found.");

  const id = crypto.randomUUID();
  const meals = new Map(mealRows.results.map((row) => [row.id, rowToMeal(row)]));
  const error = checkPlanReferences([{ id, variantId, name, items }], variants, meals, products);
  if (error) return badRequest(error);

  await env.DB.prepare("INSERT INTO diet_meal_plans (id, variant_id, name, items, updated_at) VALUES (?, ?, ?, ?, ?)")
    .bind(id, variantId, name, JSON.stringify(items), new Date().toISOString())
    .run();

  return json({ id, variantId, name, items }, 201);
};
