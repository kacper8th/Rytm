import { toCsv, type CsvCell } from "../../../shared/csv";
import { getProducts, type NutrientKey } from "./products";

/**
 * Export of all products to CSV — columns as in the documentation: Modules/Diet/Products → Export.
 * Nutrient columns in the order and with the names of the spreadsheet (same as the import script).
 */
const NUTRIENT_COLUMNS: { header: string; key: NutrientKey }[] = [
  { header: "węglowodany, g", key: "carbs" },
  { header: "białko, g", key: "protein" },
  { header: "tłuszcz, g", key: "fat" },
  { header: "błonnik, g", key: "fiber" },
  { header: "kcal", key: "kcal" },
  { header: "witamina A, µg", key: "vitaminA" },
  { header: "witamina D, µg", key: "vitaminD" },
  { header: "witamina E, mg", key: "vitaminE" },
  { header: "witamina K, µg", key: "vitaminK" },
  { header: "witamina C, mg", key: "vitaminC" },
  { header: "witamina B1, mg", key: "vitaminB1" },
  { header: "witamina B2, mg", key: "vitaminB2" },
  { header: "witamina B3, mg", key: "vitaminB3" },
  { header: "witamina B6, mg", key: "vitaminB6" },
  { header: "witamina B9, µg", key: "vitaminB9" },
  { header: "witamina B12, µg", key: "vitaminB12" },
  { header: "żelazo, mg", key: "iron" },
  { header: "wapń, mg", key: "calcium" },
  { header: "magnez, mg", key: "magnesium" },
  { header: "cynk, mg", key: "zinc" },
  { header: "potas, mg", key: "potassium" },
  { header: "jod, µg", key: "iodine" },
];

const HEADER = ["ID", "kategoria", "firma", "nazwa produktu", ...NUTRIENT_COLUMNS.map((c) => c.header)];

/** The CSV file of all products; "no data" is an empty cell. */
export function exportProducts(): string {
  const rows = getProducts().map((product): CsvCell[] => [
    product.id,
    product.category,
    product.brand,
    product.name,
    ...NUTRIENT_COLUMNS.map((c) => product.nutrients[c.key]),
  ]);
  return toCsv(HEADER, rows);
}
