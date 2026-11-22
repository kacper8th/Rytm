import { roundTo, toCsv, type CsvCell } from "../../../shared/csv";
import { itemTotals, planMeal, planName, planProduct, type MealPlanItem, type MealPlanVariant, type PlanNames } from "./meal-plans";

/**
 * Export of one meal plan variant to CSV — one row per item, columns as in the documentation:
 * Modules/Diet/Meal plans → Export. Plans by number, items of a plan in the order of the file.
 */
const HEADER = [
  "ID wariantu",
  "Wariant",
  "Kalorie docelowe",
  "ID jadłospisu",
  "Nazwa szablonu",
  "Typ posiłku",
  "Typ pozycji",
  "Nazwa",
  "Doważanie białko",
  "Doważanie węgle",
  "Doważanie tłuszcze",
  "Waga [g]",
  "Kalorie",
  "Węglowodany",
  "Białko",
  "Tłuszcz",
  "Błonnik",
];

/** Calculated values are written with one decimal, as in the spreadsheet. */
const DECIMALS = 1;

/** Today's plan id: variant id + plan number; replaced by a stable id when meal plans move to the database. */
function exportPlanId(variantId: string, planNumber: number): string {
  return `${variantId}-${planNumber}`;
}

function itemColumns(item: MealPlanItem): CsvCell[] {
  if (item.kind === "meal") {
    const { protein = 0, carbs = 0, fat = 0 } = item.steps;
    return ["danie", planMeal(item).name, protein, carbs, fat, 0];
  }
  return ["produkt", planProduct(item).name, 0, 0, 0, item.grams];
}

/** The CSV file of a variant; plan names need the names loaded from the server. */
export function exportMealPlanVariant(variant: MealPlanVariant, names: PlanNames): string {
  const rows = variant.plans.flatMap((plan) =>
    plan.items.map((item): CsvCell[] => {
      const totals = itemTotals(item);
      return [
        variant.id,
        variant.name,
        variant.targetKcal,
        exportPlanId(variant.id, plan.number),
        planName(names, variant.id, plan.number),
        item.mealType,
        ...itemColumns(item),
        ...(["kcal", "carbs", "protein", "fat", "fiber"] as const).map((key) => roundTo(totals[key], DECIMALS)),
      ];
    }),
  );
  return toCsv(HEADER, rows);
}
