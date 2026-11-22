import { parseCsv, parseDecimal } from "../../../shared/csv";
import { getDietUsage, loadDietBase } from "../diet-base";
import {
  affectedLines,
  capitalize,
  checkHeader,
  countSummary,
  failedCheck,
  IdResolver,
  ImportLog,
  shortList,
  type ImportCheck,
} from "../diet-import";
import { getMealPlanVariants } from "../meal-plans/meal-plans";
import { getMeals } from "../meals/meals";
import { getProducts, NUTRIENTS, saveProducts, type Product } from "./products";
import { PRODUCT_COLUMNS } from "./products-export";

/**
 * Import of a products CSV file (the export's format). See documentation: Modules/Diet/Products → Import.
 * One row = one product; rules of the ID column: Modules/Diet/Decision 005 → Import.
 */
export async function checkProductsFile(text: string): Promise<ImportCheck> {
  const [header, ...rows] = parseCsv(text);
  const headerError = checkHeader(header, PRODUCT_COLUMNS.map((c) => c.header));
  if (headerError) return failedCheck([headerError]);
  if (rows.length === 0) return failedCheck(["Plik nie ma wierszy z produktami."]);

  const log = new ImportLog();
  const ids = new IdResolver(new Set(getProducts().map((p) => p.id)));
  const products: Product[] = [];
  const seen = new Map<string, number>();

  rows.forEach((cells, index) => {
    const row = index + 2;
    if (cells.length !== PRODUCT_COLUMNS.length) {
      log.error(row, `oczekiwano ${PRODUCT_COLUMNS.length} kolumn, jest ${cells.length}.`);
      return;
    }
    const cell = (i: number) => cells[i].trim();
    const name = capitalize(cell(3));
    if (!name) log.error(row, "pusta nazwa produktu.");
    if (!cell(1)) log.error(row, "pusta kategoria.");

    const nutrients: Record<string, number | null> = {};
    PRODUCT_COLUMNS.forEach((column, i) => {
      if (!column.nutrient) return;
      const required = NUTRIENTS.find((n) => n.key === column.nutrient)!.required;
      if (cell(i) === "") {
        if (required) log.error(row, `„${column.header}” jest wymagane.`);
        nutrients[column.nutrient] = null;
        return;
      }
      const value = parseDecimal(cell(i));
      if (value === null) log.error(row, `„${column.header}” nie jest liczbą: „${cell(i)}”.`);
      nutrients[column.nutrient] = value;
    });

    // one row = one product, so an empty ID always means a new product (the row number keeps them apart)
    const id = ids.resolve(cell(0), `row-${row}`, log, row);
    if (!id) return;
    if (seen.has(id)) {
      log.error(row, `ID ${id} jest już w wierszu ${seen.get(id)}.`);
      return;
    }
    seen.set(id, row);
    products.push({
      id,
      name,
      category: cell(1),
      brand: cell(2) || null,
      nutrients: nutrients as Product["nutrients"],
    });
  });

  if (log.errors.length > 0) return failedCheck(log.errors);

  // replace: products not in the file are deleted — not when the base still uses them
  const deleted = getProducts().filter((p) => !seen.has(p.id));
  const deletedIds = new Set(deleted.map((p) => p.id));
  const name = (id: string) => deleted.find((p) => p.id === id)?.name ?? id;
  const blockers: string[] = [];
  for (const meal of getMeals()) {
    const used = [...meal.ingredients, ...Object.values(meal.gains).flatMap((g) => g.items)];
    for (const id of new Set(used.map((i) => i.productId).filter((id) => deletedIds.has(id)))) {
      blockers.push(`Produkt „${name(id)}” jest w daniu „${meal.name}”.`);
    }
  }
  for (const variant of getMealPlanVariants()) {
    for (const plan of variant.plans) {
      for (const item of plan.items) {
        if (item.kind === "product" && deletedIds.has(item.productId)) {
          blockers.push(`Produkt „${name(item.productId)}” jest w jadłospisie „${plan.name}” (${variant.name}).`);
        }
      }
    }
  }
  const usage = deleted.length > 0 ? await getDietUsage() : null;
  const sum = (counts: Record<string, number>) => deleted.reduce((total, p) => total + (counts[p.id] ? 1 : 0), 0);

  const summary = countSummary(
    products.map((p) => p.id),
    (id) => ids.isKnown(id),
  );
  return {
    errors: [],
    warnings: log.warnings,
    summary,
    replace: {
      summary: `${summary}, usunięte: ${deleted.length}`,
      deleted: deleted.length,
      blockers: shortList(blockers),
      affected: usage
        ? affectedLines([
            ["Magazyn - produkty", deleted.filter((p) => usage.pantry.includes(p.id)).length],
            ["Listy zakupów - produkty", sum(usage.shoppingLists)],
            ["Plan tygodnia - produkty w zapisanych dniach", sum(usage.weekDays.products)],
          ])
        : [],
    },
    save: (mode) => saveProducts(products, mode),
    afterSave: () => loadDietBase(true),
  };
}
