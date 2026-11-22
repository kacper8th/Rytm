import { badRequest, json, type Env } from "../../_lib/http";
import { checkPlanReferences, idsOf, parseMealPlans, parseMode, rowToMeal, type MealRow } from "../../_lib/diet-base";

/**
 * PUT /api/diet-base/meal-plans — body { variants: [Variant], plans: [MealPlan], mode: "add" | "replace" }: import of one
 * or more variants. A known id updates (a plan's whole content is replaced), a new id adds. "add" keeps plans not in the
 * body; "replace" deletes the plans of the variants in the body that are not in it (other variants stay; a plan is not
 * used by the base, so nothing blocks it). Both tables in one batch — all or nothing.
 * Returns { added, updated, deleted } (counted for plans).
 */
export const onRequestPut: PagesFunction<Env> = async ({ env, request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON.");
  }
  const parsed = parseMealPlans(body);
  if (typeof parsed === "string") return badRequest(parsed);
  const mode = parseMode(body);
  if (!mode) return badRequest('`mode` must be "add" or "replace".');

  const [mealRows, products, variantIds, planRows] = await Promise.all([
    env.DB.prepare("SELECT id, name, tags, recipe, ingredients, gains FROM diet_meals").all<MealRow>(),
    idsOf(env.DB, "diet_products"),
    idsOf(env.DB, "diet_variants"),
    env.DB.prepare("SELECT id, variant_id FROM diet_meal_plans").all<{ id: string; variant_id: string }>(),
  ]);
  for (const variant of parsed.variants) variantIds.add(variant.id);
  const meals = new Map(mealRows.results.map((row) => [row.id, rowToMeal(row)]));
  const error = checkPlanReferences(parsed.plans, variantIds, meals, products);
  if (error) return badRequest(error);

  const inBody = new Set(parsed.plans.map((p) => p.id));
  const replaced = new Set(parsed.variants.map((v) => v.id));
  const deleted =
    mode === "replace" ? planRows.results.filter((r) => replaced.has(r.variant_id) && !inBody.has(r.id)).map((r) => r.id) : [];

  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO diet_variants (id, name, target_kcal, updated_at)
       SELECT json_extract(value, '$.id'), json_extract(value, '$.name'), json_extract(value, '$.targetKcal'), ?
       FROM json_each(?) WHERE true
       ON CONFLICT (id) DO UPDATE SET name = excluded.name, target_kcal = excluded.target_kcal, updated_at = excluded.updated_at`,
    ).bind(now, JSON.stringify(parsed.variants)),
    env.DB.prepare(
      `INSERT INTO diet_meal_plans (id, variant_id, name, items, updated_at)
       SELECT json_extract(value, '$.id'), json_extract(value, '$.variantId'), json_extract(value, '$.name'),
              json_extract(value, '$.items'), ?
       FROM json_each(?) WHERE true
       ON CONFLICT (id) DO UPDATE SET variant_id = excluded.variant_id, name = excluded.name, items = excluded.items,
         updated_at = excluded.updated_at`,
    ).bind(now, JSON.stringify(parsed.plans)),
    env.DB.prepare("DELETE FROM diet_meal_plans WHERE id IN (SELECT value FROM json_each(?))").bind(JSON.stringify(deleted)),
  ]);

  const known = new Set(planRows.results.map((r) => r.id));
  const updated = parsed.plans.filter((p) => known.has(p.id)).length;
  return json({ added: parsed.plans.length - updated, updated, deleted: deleted.length });
};
