import { toCsv, type CsvCell } from "../../../shared/csv";
import { findProduct } from "../products/products";
import { GAIN_MACROS, getMeals, type GainMacro, type Meal } from "./meals";

/**
 * Export of all meals to CSV — "long" format, columns as in the documentation: Modules/Diet/Meals → Export.
 * Rows of a meal: tags, recipe, ingredients, then each gain (its products, then its max).
 */
/** Columns of the file, in order — also read by the import (meals-import.ts). */
export const MEAL_COLUMNS = ["ID", "Nazwa", "Parametr", "Wartość", "ID produktu", "produkt", "waga [g]"] as const;

/** Gain names used in `Parametr` ("przyrost białko", "przyrost białko max") — also read by the import. */
export const GAIN_LABELS: Record<GainMacro, string> = { protein: "białko", carbs: "węgle", fat: "tłuszcze" };

function mealRows(meal: Meal, productName: (id: string) => string): CsvCell[][] {
  const row = (param: string, value: CsvCell, productId: string | null, grams: number | null): CsvCell[] => [
    meal.id,
    meal.name,
    param,
    value,
    productId,
    productId && productName(productId),
    grams,
  ];
  const rows = meal.tags.map((tag) => row(tag, "tak", null, null));
  if (meal.recipe !== null) rows.push(row("Przepis", meal.recipe, null, null));
  for (const item of meal.ingredients) rows.push(row("składnik", null, item.productId, item.grams));
  for (const { key } of GAIN_MACROS) {
    const gain = meal.gains[key];
    if (!gain) continue;
    const param = `przyrost ${GAIN_LABELS[key]}`;
    for (const item of gain.items) rows.push(row(param, null, item.productId, item.grams));
    rows.push(row(`${param} max`, gain.max, null, null));
  }
  return rows;
}

/** The CSV file of all meals; products are written by id and name. */
export function exportMeals(): string {
  // The import and the server check every product id, so an unknown one only means a database changed by hand.
  const productName = (id: string) => findProduct(id)?.name ?? id;
  return toCsv(MEAL_COLUMNS, getMeals().flatMap((meal) => mealRows(meal, productName)));
}
