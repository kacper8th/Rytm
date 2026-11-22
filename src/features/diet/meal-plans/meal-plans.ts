import { request } from "../../../shared/api";
import type { ImportResult } from "../../../shared/ui/ImportButton";
import { dietBase, setPlanNameInBase } from "../diet-base";
import { findMeal, mealIngredients, mealTotals, type GainSteps, type Meal, type MealIngredient } from "../meals/meals";
import { findProduct, type NutrientKey, type Product } from "../products/products";

/**
 * Meal plans — part of the Diet base in the database (see ../diet-base.ts).
 * Items refer to meals and products by id. See documentation: Modules/Diet/Meal plans.
 */

/** Meal types in display order, with the max count per plan. Must match MEAL_TYPE_MAX in functions/_lib/diet-rules.ts. */
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
  /** Stable id (UUID), given when the plan is created. */
  id: string;
  /** Chosen by the user, 1–PLAN_NAME_MAX characters. */
  name: string;
  /** In the order of the file — use planItems() for display order. */
  items: MealPlanItem[];
};

/** A group of meal plans with a target, e.g. "2800 kcal". */
export type MealPlanVariant = {
  /** Stable id (UUID), given when the variant is created. */
  id: string;
  name: string;
  targetKcal: number;
  /** In the order they were added. */
  plans: MealPlan[];
};

/** The only way screens get meal plans (from the loaded Diet base). */
export function getMealPlanVariants(): readonly MealPlanVariant[] {
  return dietBase().variants;
}

/** The plan with this id and its variant, or undefined when it is not in the base. */
export function findPlan(planId: string): { variant: MealPlanVariant; plan: MealPlan } | undefined {
  for (const variant of getMealPlanVariants()) {
    const plan = variant.plans.find((p) => p.id === planId);
    if (plan) return { variant, plan };
  }
  return undefined;
}

// ---- names ----

/** Must match PLAN_NAME_MAX in functions/_lib/diet-base.ts. */
export const PLAN_NAME_MAX = 100;

/** Saves the plan's name (1–PLAN_NAME_MAX characters after trimming) and puts it into the loaded base. */
export async function renamePlan(planId: string, name: string): Promise<void> {
  const response = await request(`/api/meal-plans/${encodeURIComponent(planId)}/name`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const saved = (await response.json()) as { name: string };
  setPlanNameInBase(planId, saved.name);
}

// ---- items ----

/** The meal of an item, or undefined when its id is no longer in Meals (possible in saved week plans). */
export function findPlanMeal(item: Extract<MealPlanItem, { kind: "meal" }>): Meal | undefined {
  return findMeal(item.mealId);
}

/** The product of an item, or undefined when its id is no longer in Products. */
export function findPlanProduct(item: Extract<MealPlanItem, { kind: "product" }>): Product | undefined {
  return findProduct(item.productId);
}

export function isItemKnown(item: MealPlanItem): boolean {
  return item.kind === "meal" ? findPlanMeal(item) !== undefined : findPlanProduct(item) !== undefined;
}

export function planMeal(item: Extract<MealPlanItem, { kind: "meal" }>): Meal {
  const meal = findPlanMeal(item);
  // The import and the server check every id, so this only happens when the database was changed by hand.
  if (!meal) throw new Error(`Meal plan refers to unknown meal "${item.mealId}"`);
  return meal;
}

export function planProduct(item: Extract<MealPlanItem, { kind: "product" }>): Product {
  const product = findPlanProduct(item);
  if (!product) throw new Error(`Meal plan refers to unknown product "${item.productId}"`);
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

/**
 * Import: saves a variant and its plans (a known id updates, a new id adds; "replace" also deletes the variant's plans
 * not in the list) — PUT /api/diet-base/meal-plans.
 */
export async function saveMealPlans(
  variant: Omit<MealPlanVariant, "plans">,
  plans: readonly MealPlan[],
  mode: "add" | "replace",
): Promise<ImportResult> {
  const response = await request("/api/diet-base/meal-plans", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      variants: [{ id: variant.id, name: variant.name, targetKcal: variant.targetKcal }],
      plans: plans.map((plan) => ({ ...plan, variantId: variant.id })),
      mode,
    }),
  });
  return (await response.json()) as ImportResult;
}

// ---- selected variant ----

/** The variant chosen on the Meal plans screen, kept for the app session (also set by an import). */
let selectedVariantId: string | null = null;

export const rememberedVariantId = () => selectedVariantId;

export function rememberVariant(variantId: string) {
  selectedVariantId = variantId;
}
