import { request } from "../../../shared/api";
import type { ImportResult } from "../../../shared/ui/ImportButton";
import { dietBase } from "../diet-base";
import { findProduct, NUTRIENTS, nutrientAmount, type NutrientKey, type Product } from "../products/products";

/**
 * Meals — part of the Diet base in the database (see ../diet-base.ts).
 * Ingredients refer to products by id. See documentation: Modules/Diet/Meals.
 */

export const MEAL_TAGS = ["śniadanie", "obiad", "kolacja", "przekąska"] as const;

/** A suggestion when the meal fits, not a restriction. */
export type MealTag = (typeof MEAL_TAGS)[number];

/** Keys must match GAIN_MACROS in functions/_lib/diet-rules.ts. */
export const GAIN_MACROS = [
  { key: "protein", label: "Białko" },
  { key: "carbs", label: "Węglowodany" },
  { key: "fat", label: "Tłuszcze" },
] as const;

export type GainMacro = (typeof GAIN_MACROS)[number]["key"];

export type MealItem = {
  productId: string;
  grams: number;
};

/** One step adds all items at once; steps go from 0 to `max`. */
export type MealGain = {
  max: number;
  items: MealItem[];
};

export type Meal = {
  /** Stable id (UUID), given when the meal is created. */
  id: string;
  name: string;
  tags: MealTag[];
  /** Text or a link; null when there is no recipe. */
  recipe: string | null;
  ingredients: MealItem[];
  gains: Partial<Record<GainMacro, MealGain>>;
};

/** Number of gain steps chosen for each macro (missing = 0). */
export type GainSteps = Partial<Record<GainMacro, number>>;

export type MealIngredient = {
  product: Product;
  grams: number;
};

/** The only way screens get meals (from the loaded Diet base). */
export function getMeals(): readonly Meal[] {
  return dietBase().meals;
}

/** The meal with this id, or undefined when it is not in the base. */
export function findMeal(id: string): Meal | undefined {
  return dietBase().mealsById.get(id);
}

function productById(id: string): Product {
  const product = findProduct(id);
  // The import and the server check every product id, so this only happens when the database was changed by hand.
  if (!product) throw new Error(`Meal refers to unknown product "${id}"`);
  return product;
}

/** Ingredients with grams after the chosen gain steps, in the order of the meal. */
export function mealIngredients(meal: Meal, steps: GainSteps = {}): MealIngredient[] {
  const grams = new Map(meal.ingredients.map((item) => [item.productId, item.grams]));
  for (const { key } of GAIN_MACROS) {
    const gain = meal.gains[key];
    const count = Math.min(Math.max(steps[key] ?? 0, 0), gain?.max ?? 0);
    if (!gain || count === 0) continue;
    for (const item of gain.items) {
      grams.set(item.productId, (grams.get(item.productId) ?? 0) + count * item.grams);
    }
  }
  return meal.ingredients.map((item) => ({
    product: productById(item.productId),
    grams: grams.get(item.productId) ?? item.grams,
  }));
}

/** Amount of a nutrient in a given weight of a product — "no data" counts as 0. */
export function ingredientAmount({ product, grams }: MealIngredient, key: NutrientKey): number {
  return (nutrientAmount(product, key) * grams) / 100;
}

/** Totals of all nutrients for the given ingredients. */
export function mealTotals(ingredients: readonly MealIngredient[]): Record<NutrientKey, number> {
  const totals = {} as Record<NutrientKey, number>;
  for (const { key } of NUTRIENTS) {
    totals[key] = ingredients.reduce((sum, ingredient) => sum + ingredientAmount(ingredient, key), 0);
  }
  return totals;
}

/** A recipe starting with http(s) is shown as a link. */
export function isRecipeLink(recipe: string): boolean {
  return /^https?:\/\//.test(recipe.trim());
}

/**
 * Import: saves the meals (a known id replaces the meal, a new id adds it; "replace" also deletes the meals not in the list)
 * — PUT /api/diet-base/meals.
 */
export async function saveMeals(meals: readonly Meal[], mode: "add" | "replace"): Promise<ImportResult> {
  const response = await request("/api/diet-base/meals", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: meals, mode }),
  });
  return (await response.json()) as ImportResult;
}
