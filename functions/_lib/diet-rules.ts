/**
 * Diet rules shared by the API checks of week plan days (week-plan.ts) and of the Diet base import (diet-base.ts).
 */

/** Meal type → max count per day / plan. Must match MEAL_TYPES in src/features/diet/meal-plans/meal-plans.ts. */
export const MEAL_TYPE_MAX: Record<string, number> = {
  "śniadanie": 1,
  obiad: 1,
  podwieczorek: 1,
  "przekąska": 2,
  kolacja: 1,
};

/** Macros with gain steps. Must match GAIN_MACROS in src/features/diet/meals/meals.ts. */
export const GAIN_MACROS = ["protein", "carbs", "fat"];
