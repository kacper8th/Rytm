import { roundTo, toCsv, type CsvCell } from "../../../shared/csv";
import { itemTotals, planMeal, planProduct, type MealPlanItem, type MealPlanVariant } from "./meal-plans";

/**
 * Export of one meal plan variant to CSV — one row per item, columns as in the documentation:
 * Modules/Diet/Meal plans → Export. Plans in the order they were added, items of a plan in the order of the file.
 */
/** Columns of the file, in order — also read by the import (meal-plans-import.ts). */
export const MEAL_PLAN_COLUMNS = [
  "ID wariantu",
  "Wariant",
  "Kalorie docelowe",
  "ID jadłospisu",
  "Nazwa szablonu",
  "Typ posiłku",
  "Typ pozycji",
  "ID pozycji",
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
] as const;

/** Calculated values are written with one decimal, as in the spreadsheet. */
const DECIMALS = 1;

function itemColumns(item: MealPlanItem): CsvCell[] {
  if (item.kind === "meal") {
    const { protein = 0, carbs = 0, fat = 0 } = item.steps;
    return ["danie", item.mealId, planMeal(item).name, protein, carbs, fat, 0];
  }
  return ["produkt", item.productId, planProduct(item).name, 0, 0, 0, item.grams];
}

/** The CSV file of a variant. */
export function exportMealPlanVariant(variant: MealPlanVariant): string {
  const rows = variant.plans.flatMap((plan) =>
    plan.items.map((item): CsvCell[] => {
      const totals = itemTotals(item);
      return [
        variant.id,
        variant.name,
        variant.targetKcal,
        plan.id,
        plan.name,
        item.mealType,
        ...itemColumns(item),
        ...(["kcal", "carbs", "protein", "fat", "fiber"] as const).map((key) => roundTo(totals[key], DECIMALS)),
      ];
    }),
  );
  return toCsv(MEAL_PLAN_COLUMNS, rows);
}
