import { request } from "../../../shared/api";
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

// ---- names (user data on the server, /api/meal-plan-names) ----

/** Saved names by "variantId/planNumber"; a plan without an entry has the default name. */
export type PlanNames = ReadonlyMap<string, string>;

/** Must match NAME_MAX in functions/_lib/meal-plan-names.ts. */
export const PLAN_NAME_MAX = 100;

const nameKey = (variantId: string, planNumber: number) => `${variantId}/${planNumber}`;

/** The name of a plan that was never renamed. */
export function defaultPlanName(planNumber: number): string {
  return `Jadłospis ${planNumber}`;
}

/** The plan's name: the saved one, or the default while names are not loaded (null) or the plan was never renamed. */
export function planName(names: PlanNames | null, variantId: string, planNumber: number): string {
  return names?.get(nameKey(variantId, planNumber)) ?? defaultPlanName(planNumber);
}

/** Names loaded in this app session — shared by every screen, updated on rename. */
let cachedNames: PlanNames | null = null;

export function cachedPlanNames(): PlanNames | null {
  return cachedNames;
}

export async function getPlanNames(): Promise<PlanNames> {
  const response = await request("/api/meal-plan-names");
  const { names } = (await response.json()) as { names: { variantId: string; planNumber: number; name: string }[] };
  cachedNames = new Map(names.map((n) => [nameKey(n.variantId, n.planNumber), n.name]));
  return cachedNames;
}

/** Saves the plan's name (1–PLAN_NAME_MAX characters after trimming) and returns all names with it. */
export async function renamePlan(names: PlanNames, variantId: string, planNumber: number, name: string): Promise<PlanNames> {
  const response = await request(`/api/meal-plan-names/${encodeURIComponent(variantId)}/${planNumber}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const saved = (await response.json()) as { name: string };
  cachedNames = new Map(names).set(nameKey(variantId, planNumber), saved.name);
  return cachedNames;
}

// ---- items ----

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
