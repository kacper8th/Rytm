/**
 * Diet rules shared by the API checks of week plan days (week-plan.ts) and of the Diet base import (diet-base.ts).
 */

/**
 * Meal type → max items per day / plan (null = no limit) and whether a product may be an item of it.
 * Must match MEAL_TYPES in src/features/diet/meal-plans/meal-plans.ts.
 */
const MEAL_TYPE_RULES: Record<string, { max: number | null; products: boolean }> = {
  "śniadanie": { max: 1, products: false },
  "drugie śniadanie": { max: 1, products: false },
  obiad: { max: 1, products: false },
  podwieczorek: { max: 1, products: false },
  "przekąska": { max: 1, products: false },
  kolacja: { max: 1, products: false },
  "dodatkowy posiłek": { max: null, products: true },
};

/**
 * Checks the meal type of one item against the rules above; `counts` collects the items per type of one day / plan.
 * Returns an error message or null.
 */
export function checkMealType(mealType: string, kind: unknown, counts: Record<string, number>): string | null {
  if (!Object.hasOwn(MEAL_TYPE_RULES, mealType)) return "unknown mealType.";
  const rule = MEAL_TYPE_RULES[mealType];
  if (kind === "product" && !rule.products) return `a product cannot be "${mealType}".`;
  counts[mealType] = (counts[mealType] ?? 0) + 1;
  if (rule.max !== null && counts[mealType] > rule.max) return `too many "${mealType}".`;
  return null;
}

/** Macros with gain steps. Must match GAIN_MACROS in src/features/diet/meals/meals.ts. */
export const GAIN_MACROS = ["protein", "carbs", "fat"];
