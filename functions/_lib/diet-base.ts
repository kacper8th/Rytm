/**
 * Diet base API helpers — row mapping and checks of import bodies.
 * See documentation: Modules/Diet/Decision 005 - Diet data in the database → Import.
 * The app does the full check of a CSV file; the server checks the shape and that every reference exists.
 */
import { checkMealType, GAIN_MACROS } from "./diet-rules";
import { isInt, isRecord } from "./validation";

// ---- shared with the app — must match the app code named next to each constant ----

/** Must match NUTRIENTS in src/features/diet/products/products.ts (required = true for the first five). */
const REQUIRED_NUTRIENTS = ["kcal", "protein", "fat", "carbs", "fiber"];
const OPTIONAL_NUTRIENTS = [
  "vitaminA", "vitaminD", "vitaminE", "vitaminK", "vitaminC", "vitaminB1", "vitaminB2", "vitaminB3",
  "vitaminB6", "vitaminB9", "vitaminB12", "iron", "calcium", "magnesium", "zinc", "potassium", "iodine",
];

/** Must match MEAL_TAGS in src/features/diet/meals/meals.ts. */
const MEAL_TAGS = ["śniadanie", "obiad", "kolacja", "przekąska"];


/** Must match PLAN_NAME_MAX in src/features/diet/meal-plans/meal-plans.ts. */
export const PLAN_NAME_MAX = 100;

const NAME_MAX = 200;
const MAX_ITEMS = 5000;

// ---- types (the same shapes as the app types) ----

type Nutrients = Record<string, number | null>;
type MealItem = { productId: string; grams: number };
type MealGain = { max: number; items: MealItem[] };

export type Product = { id: string; name: string; category: string; brand: string | null; nutrients: Nutrients };
export type Meal = {
  id: string;
  name: string;
  tags: string[];
  recipe: string | null;
  ingredients: MealItem[];
  gains: Record<string, MealGain>;
};
export type Variant = { id: string; name: string; targetKcal: number };
export type PlanItem =
  | { mealType: string; kind: "meal"; mealId: string; steps: Record<string, number> }
  | { mealType: string; kind: "product"; productId: string; grams: number };
export type MealPlan = { id: string; variantId: string; name: string; items: PlanItem[] };

// ---- rows ----

export type ProductRow = { id: string; name: string; category: string; brand: string | null; nutrients: string };
export type MealRow = { id: string; name: string; tags: string; recipe: string | null; ingredients: string; gains: string };
export type VariantRow = { id: string; name: string; target_kcal: number };
export type MealPlanRow = { id: string; variant_id: string; name: string; items: string };

export const rowToProduct = (r: ProductRow): Product => ({
  id: r.id,
  name: r.name,
  category: r.category,
  brand: r.brand,
  nutrients: JSON.parse(r.nutrients) as Nutrients,
});

export const rowToMeal = (r: MealRow): Meal => ({
  id: r.id,
  name: r.name,
  tags: JSON.parse(r.tags) as string[],
  recipe: r.recipe,
  ingredients: JSON.parse(r.ingredients) as MealItem[],
  gains: JSON.parse(r.gains) as Record<string, MealGain>,
});

export const rowToVariant = (r: VariantRow): Variant => ({ id: r.id, name: r.name, targetKcal: r.target_kcal });

export const rowToMealPlan = (r: MealPlanRow): MealPlan => ({
  id: r.id,
  variantId: r.variant_id,
  name: r.name,
  items: JSON.parse(r.items) as PlanItem[],
});

// ---- checks ----

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids of the Diet base are UUIDs (36 characters, groups 8-4-4-4-12). */
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

const isText = (v: unknown, max: number): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= max;
const isAmount = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const isGrams = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0 && v <= 5000;

/** Reads `{ items: [...] }` and checks every item; returns the clean items or "Item i: …". */
function parseList<T>(body: unknown, parseItem: (item: unknown) => T | string): T[] | string {
  if (!isRecord(body) || !Array.isArray(body.items)) return "Body must be { items: [...] }.";
  if (body.items.length === 0 || body.items.length > MAX_ITEMS) return `\`items\` must have 1–${MAX_ITEMS} entries.`;
  const clean: T[] = [];
  const ids = new Set<string>();
  for (const [i, raw] of body.items.entries()) {
    const item = parseItem(raw);
    if (typeof item === "string") return `Item ${i}: ${item}`;
    const id = (item as { id: string }).id;
    if (ids.has(id)) return `Item ${i}: id ${id} appears twice.`;
    ids.add(id);
    clean.push(item);
  }
  return clean;
}

function parseProduct(v: unknown): Product | string {
  if (!isRecord(v)) return "must be an object.";
  const { id, name, category, brand, nutrients } = v;
  if (!isUuid(id)) return "id must be a UUID.";
  if (!isText(name, NAME_MAX)) return "name must be 1–200 characters.";
  if (!isText(category, NAME_MAX)) return "category must be 1–200 characters.";
  if (brand !== null && !isText(brand, NAME_MAX)) return "brand must be text or null.";
  if (!isRecord(nutrients)) return "nutrients must be an object.";
  const clean: Nutrients = {};
  for (const key of REQUIRED_NUTRIENTS) {
    if (!isAmount(nutrients[key])) return `nutrient ${key} must be a number ≥ 0.`;
    clean[key] = nutrients[key] as number;
  }
  for (const key of OPTIONAL_NUTRIENTS) {
    const value = nutrients[key];
    if (value !== null && !isAmount(value)) return `nutrient ${key} must be a number ≥ 0 or null.`;
    clean[key] = value as number | null;
  }
  return { id, name, category, brand: brand as string | null, nutrients: clean };
}

function parseMealItems(v: unknown, label: string): MealItem[] | string {
  if (!Array.isArray(v) || v.length === 0) return `${label} must be a non-empty array.`;
  const items: MealItem[] = [];
  for (const item of v) {
    if (!isRecord(item) || !isUuid(item.productId) || !isGrams(item.grams)) return `${label}: {productId: UUID, grams > 0} expected.`;
    if (items.some((x) => x.productId === item.productId)) return `${label}: product ${item.productId} appears twice.`;
    items.push({ productId: item.productId, grams: item.grams });
  }
  return items;
}

function parseMeal(v: unknown): Meal | string {
  if (!isRecord(v)) return "must be an object.";
  const { id, name, tags, recipe, ingredients, gains } = v;
  if (!isUuid(id)) return "id must be a UUID.";
  if (!isText(name, NAME_MAX)) return "name must be 1–200 characters.";
  if (!Array.isArray(tags) || tags.some((t) => !MEAL_TAGS.includes(t as string)) || new Set(tags).size !== tags.length) {
    return "tags must be distinct meal-time tags.";
  }
  if (recipe !== null && !isText(recipe, 20000)) return "recipe must be text or null.";
  const cleanIngredients = parseMealItems(ingredients, "ingredients");
  if (typeof cleanIngredients === "string") return cleanIngredients;
  if (!isRecord(gains)) return "gains must be an object.";
  const cleanGains: Record<string, MealGain> = {};
  for (const [macro, gain] of Object.entries(gains)) {
    if (!GAIN_MACROS.includes(macro)) return `unknown gain ${macro}.`;
    if (!isRecord(gain) || !isInt(gain.max, 1, 100)) return `gain ${macro}: max must be a whole number 1–100.`;
    const items = parseMealItems(gain.items, `gain ${macro}`);
    if (typeof items === "string") return items;
    if (items.some((g) => !cleanIngredients.some((i) => i.productId === g.productId))) {
      return `gain ${macro}: every product must also be an ingredient.`;
    }
    cleanGains[macro] = { max: gain.max, items };
  }
  return { id, name, tags: tags as string[], recipe: recipe as string | null, ingredients: cleanIngredients, gains: cleanGains };
}

function parsePlanItem(v: unknown, counts: Record<string, number>): PlanItem | string {
  if (!isRecord(v)) return "plan item must be an object.";
  const { mealType, kind } = v;
  if (typeof mealType !== "string") return "unknown mealType.";
  const typeError = checkMealType(mealType, kind, counts);
  if (typeError) return typeError;
  if (kind === "meal") {
    if (!isUuid(v.mealId) || !isRecord(v.steps)) return "meal item needs mealId (UUID) and steps.";
    const steps: Record<string, number> = {};
    for (const [macro, n] of Object.entries(v.steps)) {
      if (!GAIN_MACROS.includes(macro) || !isInt(n, 0, 100)) return "steps must be whole numbers ≥ 0 per gain.";
      if (n > 0) steps[macro] = n;
    }
    return { mealType, kind, mealId: v.mealId, steps };
  }
  if (kind === "product") {
    if (!isUuid(v.productId) || !isGrams(v.grams)) return "product item needs productId (UUID) and grams > 0.";
    return { mealType, kind, productId: v.productId, grams: v.grams };
  }
  return 'kind must be "meal" or "product".';
}

/** Items of one plan (import, edit and new plan): 1–20 entries, meal types within their limits. */
export function parsePlanItems(v: unknown): PlanItem[] | string {
  if (!Array.isArray(v) || v.length === 0 || v.length > 20) return "plan items must be 1–20 entries.";
  const counts: Record<string, number> = {};
  const items: PlanItem[] = [];
  for (const raw of v) {
    const item = parsePlanItem(raw, counts);
    if (typeof item === "string") return item;
    items.push(item);
  }
  return items;
}

export const parseProducts = (body: unknown) => parseList(body, parseProduct);
export const parseMeals = (body: unknown) => parseList(body, parseMeal);

/** Body of PUT /api/diet-base/meal-plans: { variants: [...], plans: [...] }. */
export function parseMealPlans(body: unknown): { variants: Variant[]; plans: MealPlan[] } | string {
  if (!isRecord(body) || !Array.isArray(body.variants)) return "Body must be { variants: [...], plans: [...] }.";
  const variants = parseList({ items: body.variants }, (v): Variant | string => {
    if (!isRecord(v) || !isUuid(v.id)) return "variant id must be a UUID.";
    if (!isText(v.name, NAME_MAX)) return "variant name must be 1–200 characters.";
    if (typeof v.targetKcal !== "number" || !(v.targetKcal > 0) || v.targetKcal > 20000) return "targetKcal must be > 0.";
    return { id: v.id, name: v.name, targetKcal: v.targetKcal };
  });
  if (typeof variants === "string") return `Variants — ${variants}`;
  const plans = parseList({ items: body.plans }, (v): MealPlan | string => {
    if (!isRecord(v) || !isUuid(v.id) || !isUuid(v.variantId)) return "plan id and variantId must be UUIDs.";
    if (typeof v.name !== "string" || v.name.trim().length === 0 || v.name.length > PLAN_NAME_MAX) {
      return `plan name must be 1–${PLAN_NAME_MAX} characters.`;
    }
    const items = parsePlanItems(v.items);
    if (typeof items === "string") return items;
    return { id: v.id, variantId: v.variantId, name: v.name.trim(), items };
  });
  if (typeof plans === "string") return `Plans — ${plans}`;
  return { variants, plans };
}

/** The trimmed name from a body with { name } (rename and new plan), or an error message. */
export function parsePlanName(body: unknown): string | { error: string } {
  if (!isRecord(body) || typeof body.name !== "string") return { error: "Body must be { name }." };
  const name = body.name.trim();
  if (name.length === 0 || name.length > PLAN_NAME_MAX) return { error: `\`name\` must be 1–${PLAN_NAME_MAX} characters.` };
  return name;
}

/** Import mode: "add" adds and updates; "replace" also deletes the items of the type (or the variant) not in the body. */
export type ImportMode = "add" | "replace";

export function parseMode(body: unknown): ImportMode | null {
  const mode = isRecord(body) ? (body.mode ?? "add") : null;
  return mode === "add" || mode === "replace" ? mode : null;
}

// ---- references (checked against the database) ----

/** Ids of one table, for reference checks. */
export async function idsOf(db: D1Database, table: "diet_products" | "diet_meals" | "diet_variants"): Promise<Set<string>> {
  const { results } = await db.prepare(`SELECT id FROM ${table}`).all<{ id: string }>();
  return new Set(results.map((r) => r.id));
}

/** Every product used by the meals exists; returns an error message or null. */
export function checkMealReferences(meals: Meal[], products: Set<string>): string | null {
  for (const meal of meals) {
    const used = [...meal.ingredients, ...Object.values(meal.gains).flatMap((g) => g.items)];
    const missing = used.find((i) => !products.has(i.productId));
    if (missing) return `Meal ${meal.id}: product ${missing.productId} is not in the database.`;
  }
  return null;
}

/** Meals / products of the plans exist, gain steps fit the meal, every plan has a known variant. */
export function checkPlanReferences(
  plans: MealPlan[],
  variants: Set<string>,
  meals: Map<string, Meal>,
  products: Set<string>,
): string | null {
  for (const plan of plans) {
    if (!variants.has(plan.variantId)) return `Plan ${plan.id}: variant ${plan.variantId} is not in the database.`;
    for (const item of plan.items) {
      if (item.kind === "product") {
        if (!products.has(item.productId)) return `Plan ${plan.id}: product ${item.productId} is not in the database.`;
        continue;
      }
      const meal = meals.get(item.mealId);
      if (!meal) return `Plan ${plan.id}: meal ${item.mealId} is not in the database.`;
      for (const [macro, n] of Object.entries(item.steps)) {
        const max = meal.gains[macro]?.max ?? 0;
        if (n > max) return `Plan ${plan.id}: ${macro} steps ${n} above max ${max} of meal ${meal.id}.`;
      }
    }
  }
  return null;
}

/** Ids of the deleted products / meals still used in the base (meals, meal plans) — replace stops on any of them. */
export function usedInBase(
  deletedProducts: ReadonlySet<string>,
  deletedMeals: ReadonlySet<string>,
  meals: Iterable<Meal>,
  plans: Iterable<MealPlan>,
): string | null {
  for (const meal of meals) {
    if (deletedMeals.has(meal.id)) continue;
    const used = [...meal.ingredients, ...Object.values(meal.gains).flatMap((g) => g.items)];
    const hit = used.find((i) => deletedProducts.has(i.productId));
    if (hit) return `Product ${hit.productId} is still used by meal ${meal.id}.`;
  }
  for (const plan of plans) {
    for (const item of plan.items) {
      if (item.kind === "product" && deletedProducts.has(item.productId)) {
        return `Product ${item.productId} is still used by meal plan ${plan.id}.`;
      }
      if (item.kind === "meal" && deletedMeals.has(item.mealId)) return `Meal ${item.mealId} is still used by meal plan ${plan.id}.`;
    }
  }
  return null;
}
