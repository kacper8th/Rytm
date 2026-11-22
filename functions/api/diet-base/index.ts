import { json, type Env } from "../../_lib/http";
import {
  rowToMeal,
  rowToMealPlan,
  rowToProduct,
  rowToVariant,
  type MealPlanRow,
  type MealRow,
  type ProductRow,
  type VariantRow,
} from "../../_lib/diet-base";

/**
 * GET /api/diet-base — the whole Diet base in one response: { products, meals, variants: [{ …, plans }] }.
 * Lists in insert order (rowid), so the first import keeps the order of the files.
 */
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const [products, meals, variants, plans] = await env.DB.batch([
    env.DB.prepare("SELECT id, name, category, brand, nutrients FROM diet_products ORDER BY rowid"),
    env.DB.prepare("SELECT id, name, tags, recipe, ingredients, gains FROM diet_meals ORDER BY rowid"),
    env.DB.prepare("SELECT id, name, target_kcal FROM diet_variants ORDER BY rowid"),
    env.DB.prepare("SELECT id, variant_id, name, items FROM diet_meal_plans ORDER BY rowid"),
  ]);
  const allPlans = (plans.results as MealPlanRow[]).map(rowToMealPlan);

  return json({
    products: (products.results as ProductRow[]).map(rowToProduct),
    meals: (meals.results as MealRow[]).map(rowToMeal),
    variants: (variants.results as VariantRow[]).map((row) => ({
      ...rowToVariant(row),
      plans: allPlans.filter((plan) => plan.variantId === row.id).map(({ id, name, items }) => ({ id, name, items })),
    })),
  });
};
