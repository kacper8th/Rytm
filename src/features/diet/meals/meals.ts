import { getProducts, NUTRIENTS, nutrientAmount, type NutrientKey, type Product } from "../products/products";
import { MEALS } from "./meals.data";

/**
 * Meals — fixed data generated from meals.csv (see scripts/import-meals.mjs).
 * Ingredients refer to products by id. See documentation: Modules/Diet/Meals.
 */

export const MEAL_TAGS = ["śniadanie", "obiad", "kolacja", "przekąska"] as const;

/** A suggestion when the meal fits, not a restriction. */
export type MealTag = (typeof MEAL_TAGS)[number];

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
  /** Slug of the name, e.g. "jaglane-nalesniki". */
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

/** The only way screens get meals — when data moves to a database, only this changes. */
export function getMeals(): readonly Meal[] {
  return MEALS;
}

let productsById: Map<string, Product> | null = null;

function productById(id: string): Product {
  productsById ??= new Map(getProducts().map((p) => [p.id, p]));
  const product = productsById.get(id);
  // The import checks every product id, so this only happens when products.data.ts changed without re-importing meals.
  if (!product) throw new Error(`Meal refers to unknown product "${id}" — run npm run import:meals`);
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
