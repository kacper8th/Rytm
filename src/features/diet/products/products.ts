import { PRODUCT_WARNINGS, PRODUCTS } from "./products.data";

/**
 * Products — fixed data generated from products.csv (see scripts/import-products.mjs).
 * See documentation: Modules/Diet/Products, Decisions/Decision 002 - Data.
 */

export type NutrientGroup = "macro" | "vitamin" | "mineral";

export type Nutrient = {
  key: string;
  /** Name shown in the interface (Polish). */
  label: string;
  /** Short name for narrow places, e.g. table headers. */
  short: string;
  unit: "g" | "mg" | "µg" | "kcal";
  group: NutrientGroup;
  /** true = every product must have a value; false = may be empty ("no data", null). */
  required: boolean;
};

/** All nutrients in display order. Keys match the import script. */
export const NUTRIENTS = [
  { key: "kcal", label: "Kalorie", short: "kcal", unit: "kcal", group: "macro", required: true },
  { key: "protein", label: "Białko", short: "B", unit: "g", group: "macro", required: true },
  { key: "fat", label: "Tłuszcz", short: "T", unit: "g", group: "macro", required: true },
  { key: "carbs", label: "Węglowodany", short: "W", unit: "g", group: "macro", required: true },
  { key: "fiber", label: "Błonnik", short: "Bł", unit: "g", group: "macro", required: true },
  { key: "vitaminA", label: "Witamina A", short: "A", unit: "µg", group: "vitamin", required: false },
  { key: "vitaminD", label: "Witamina D", short: "D", unit: "µg", group: "vitamin", required: false },
  { key: "vitaminE", label: "Witamina E", short: "E", unit: "mg", group: "vitamin", required: false },
  { key: "vitaminK", label: "Witamina K", short: "K", unit: "µg", group: "vitamin", required: false },
  { key: "vitaminC", label: "Witamina C", short: "C", unit: "mg", group: "vitamin", required: false },
  { key: "vitaminB1", label: "Witamina B1", short: "B1", unit: "mg", group: "vitamin", required: false },
  { key: "vitaminB2", label: "Witamina B2", short: "B2", unit: "mg", group: "vitamin", required: false },
  { key: "vitaminB3", label: "Witamina B3", short: "B3", unit: "mg", group: "vitamin", required: false },
  { key: "vitaminB6", label: "Witamina B6", short: "B6", unit: "mg", group: "vitamin", required: false },
  { key: "vitaminB9", label: "Witamina B9 (foliany)", short: "B9", unit: "µg", group: "vitamin", required: false },
  { key: "vitaminB12", label: "Witamina B12", short: "B12", unit: "µg", group: "vitamin", required: false },
  { key: "iron", label: "Żelazo", short: "Fe", unit: "mg", group: "mineral", required: false },
  { key: "calcium", label: "Wapń", short: "Ca", unit: "mg", group: "mineral", required: false },
  { key: "magnesium", label: "Magnez", short: "Mg", unit: "mg", group: "mineral", required: false },
  { key: "zinc", label: "Cynk", short: "Zn", unit: "mg", group: "mineral", required: false },
  { key: "potassium", label: "Potas", short: "K", unit: "mg", group: "mineral", required: false },
  { key: "iodine", label: "Jod", short: "I", unit: "µg", group: "mineral", required: false },
] as const satisfies readonly Nutrient[];

export type NutrientKey = (typeof NUTRIENTS)[number]["key"];
export type RequiredNutrientKey = Extract<(typeof NUTRIENTS)[number], { required: true }>["key"];
export type OptionalNutrientKey = Exclude<NutrientKey, RequiredNutrientKey>;

export const NUTRIENT_GROUPS: { group: NutrientGroup; label: string }[] = [
  { group: "macro", label: "Makroskładniki" },
  { group: "vitamin", label: "Witaminy" },
  { group: "mineral", label: "Minerały" },
];

export type Product = {
  /** Stable id (slug of the name), e.g. "kasza-gryczana". */
  id: string;
  name: string;
  /** Category from the spreadsheet, e.g. "warzywa". */
  category: string;
  brand: string | null;
  /** Values per 100 g. Optional nutrients are null when there is no data. */
  nutrients: Record<RequiredNutrientKey, number> & Record<OptionalNutrientKey, number | null>;
};

/** Data to check, found by the import script. */
export type ProductWarning = {
  productId: string;
  /** kcal differs from 4·carbs + 4·protein + 9·fat. */
  type: "kcal";
  kcal: number;
  estimatedKcal: number;
};

/** The only way screens get products — when data moves to a database, only this changes. */
export function getProducts(): readonly Product[] {
  return PRODUCTS;
}

/** Amount per 100 g for calculations (e.g. meals) — "no data" counts as 0. */
export function nutrientAmount(product: Product, key: NutrientKey): number {
  return product.nutrients[key] ?? 0;
}

/** Lower case without Polish letters, so "zolty" finds "żółty". */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Search: every word of the query must appear in the name, brand or category. Used by Products and Shopping list. */
export function productMatches(product: Product, query: string): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const text = normalize(`${product.name} ${product.brand ?? ""} ${product.category}`);
  return words.every((word) => text.includes(word));
}

export function getProductWarnings(): readonly ProductWarning[] {
  return PRODUCT_WARNINGS;
}
