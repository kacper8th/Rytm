import { toCsv, type CsvCell } from "../../../shared/csv";
import { getProducts } from "../products/products";
import { GAIN_MACROS, getMeals, type GainMacro, type Meal } from "./meals";

/**
 * Export of all meals to CSV — "long" format, columns as in the documentation: Modules/Diet/Meals → Export.
 * Rows of a meal: tags, recipe, ingredients, then each gain (its products, then its max).
 */
const HEADER = ["ID", "Nazwa", "Parametr", "Wartość", "produkt", "waga [g]"];

/** Gain names used in `Parametr` — the same as in the import script. */
const GAIN_LABELS: Record<GainMacro, string> = { protein: "białko", carbs: "węgle", fat: "tłuszcze" };

function mealRows(meal: Meal, productName: (id: string) => string): CsvCell[][] {
  const row = (param: string, value: CsvCell, product: string | null, grams: number | null): CsvCell[] => [
    meal.id,
    meal.name,
    param,
    value,
    product,
    grams,
  ];
  const rows = meal.tags.map((tag) => row(tag, "tak", null, null));
  if (meal.recipe !== null) rows.push(row("Przepis", meal.recipe, null, null));
  for (const item of meal.ingredients) rows.push(row("składnik", null, productName(item.productId), item.grams));
  for (const { key } of GAIN_MACROS) {
    const gain = meal.gains[key];
    if (!gain) continue;
    const param = `przyrost ${GAIN_LABELS[key]}`;
    for (const item of gain.items) rows.push(row(param, null, productName(item.productId), item.grams));
    rows.push(row(`${param} max`, gain.max, null, null));
  }
  return rows;
}

/** The CSV file of all meals; products are written by name. */
export function exportMeals(): string {
  const names = new Map(getProducts().map((p) => [p.id, p.name]));
  // The import checks every product id, so an unknown one only means data generated out of order.
  const productName = (id: string) => names.get(id) ?? id;
  return toCsv(HEADER, getMeals().flatMap((meal) => mealRows(meal, productName)));
}
