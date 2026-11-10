import { json, type Env } from "../../_lib/http";
import { NAME_COLUMNS, rowToName, type MealPlanNameRow } from "../../_lib/meal-plan-names";

/** GET /api/meal-plan-names — every saved meal plan name. Returns { names: [{ variantId, planNumber, name }] }. */
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare(
    `SELECT ${NAME_COLUMNS} FROM meal_plan_names ORDER BY variant_id, plan_number`,
  ).all<MealPlanNameRow>();

  return json({ names: results.map(rowToName) });
};
