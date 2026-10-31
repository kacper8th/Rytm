import { getMeals, mealIngredients, mealTotals, type GainSteps, type Meal, type MealIngredient } from "../meals/meals";
import { getProducts, type NutrientKey, type Product } from "../products/products";
import { MEAL_PLAN_VARIANTS } from "./meal-plans.data";

/**
 * Meal plans — fixed data generated from meal-plans/data/*.csv (see scripts/import-meal-plans.mjs).
 * Items refer to meals and products by id. See documentation: Modules/Diet/Meal plans.
 */

/** Meal types in display order, with the max count per plan. Must match MEAL_TYPES in the import script. */
export const MEAL_TYPES = [
  { key: "śniadanie", label: "Śniadanie", max: 1 },
  { key: "obiad", label: "Obiad", max: 1 },
  { key: "podwieczorek", label: "Podwieczorek", max: 1 },
  { key: "przekąska", label: "Przekąska", max: 2 },
  { key: "kolacja", label: "Kolacja", max: 1 },
] as const;

export type MealType = (typeof MEAL_TYPES)[number]["key"];

/** A day further than this from the variant's target kcal is highlighted (0.03 = ±3%). */
export const TARGET_TOLERANCE = 0.03;

export type MealPlanItem =
  | { mealType: MealType; kind: "meal"; mealId: string; steps: GainSteps }
  | { mealType: MealType; kind: "product"; productId: string; grams: number };

export type MealPlan = {
  /** Number from the spreadsheet — gaps allowed. */
  number: number;
  /** In the order of the file — use planItems() for display order. */
  items: MealPlanItem[];
};

/** One CSV file. The name is chosen by the user, e.g. "2800 kcal". */
export type MealPlanVariant = {
  /** Slug of the name, e.g. "2800-kcal". */
  id: string;
  name: string;
  targetKcal: number;
  /** Sorted by number. */
  plans: MealPlan[];
};

/** The only way screens get meal plans — when data moves to a database, only this changes. */
export function getMealPlanVariants(): readonly MealPlanVariant[] {
  return MEAL_PLAN_VARIANTS;
}

let mealsById: Map<string, Meal> | null = null;
let productsById: Map<string, Product> | null = null;

/** The meal of an item, or undefined when its id is no longer in Meals (possible in saved week plans). */
export function findPlanMeal(item: Extract<MealPlanItem, { kind: "meal" }>): Meal | undefined {
  mealsById ??= new Map(getMeals().map((m) => [m.id, m]));
  return mealsById.get(item.mealId);
}

/** The product of an item, or undefined when its id is no longer in Products. */
export function findPlanProduct(item: Extract<MealPlanItem, { kind: "product" }>): Product | undefined {
  productsById ??= new Map(getProducts().map((p) => [p.id, p]));
  return productsById.get(item.productId);
}

export function isItemKnown(item: MealPlanItem): boolean {
  return item.kind === "meal" ? findPlanMeal(item) !== undefined : findPlanProduct(item) !== undefined;
}

export function planMeal(item: Extract<MealPlanItem, { kind: "meal" }>): Meal {
  const meal = findPlanMeal(item);
  // The import checks every id, so this only happens when meals.data.ts changed without re-importing meal plans.
  if (!meal) throw new Error(`Meal plan refers to unknown meal "${item.mealId}" — run npm run import:meal-plans`);
  return meal;
}

export function planProduct(item: Extract<MealPlanItem, { kind: "product" }>): Product {
  const product = findPlanProduct(item);
  if (!product) throw new Error(`Meal plan refers to unknown product "${item.productId}" — run npm run import:meal-plans`);
  return product;
}

/** Items in meal-type order; items of the same type keep their order. */
export function sortItems(items: readonly MealPlanItem[]): MealPlanItem[] {
  const order = (item: MealPlanItem) => MEAL_TYPES.findIndex((t) => t.key === item.mealType);
  return [...items].sort((a, b) => order(a) - order(b));
}

/** Items of a plan in meal-type order; items of the same type keep the order of the file. */
export function planItems(plan: MealPlan): MealPlanItem[] {
  return sortItems(plan.items);
}

export function mealTypeLabel(type: MealType): string {
  return MEAL_TYPES.find((t) => t.key === type)!.label;
}

/** Ingredients of one item: a meal after the plan's gain steps, or the product itself. */
export function itemIngredients(item: MealPlanItem): MealIngredient[] {
  if (item.kind === "meal") return mealIngredients(planMeal(item), item.steps);
  return [{ product: planProduct(item), grams: item.grams }];
}

export function itemTotals(item: MealPlanItem): Record<NutrientKey, number> {
  return mealTotals(itemIngredients(item));
}

/** Totals of the whole day. */
export function planTotals(plan: MealPlan): Record<NutrientKey, number> {
  return mealTotals(plan.items.flatMap(itemIngredients));
}

/** Totals of a list of items; items whose meal / product no longer exists are left out. */
export function itemsTotals(items: readonly MealPlanItem[]): Record<NutrientKey, number> {
  return mealTotals(items.filter(isItemKnown).flatMap(itemIngredients));
}

/** true when the day's kcal is further than ±TARGET_TOLERANCE from the target. */
export function isOffTarget(kcal: number, targetKcal: number): boolean {
  return Math.abs(kcal - targetKcal) > targetKcal * TARGET_TOLERANCE;
}
