import { getMealPlanVariants, isItemKnown, itemIngredients, itemsTotals } from "../../meal-plans/meal-plans";
import { NUTRIENTS, type NutrientKey } from "../../products/products";
import type { WeekPlanDay } from "../week-plan";
import { NORMS } from "./norms";

/**
 * Week statistics — daily averages of the planned days, calculated on display from the current
 * Meals and Products data. See documentation: Modules/Diet/Week plan/Week statistics.
 */

/** kcal per gram, for the share of energy from each macro. */
const KCAL_PER_GRAM = { protein: 4, fat: 9, carbs: 4 } as const;

export type EnergyMacro = keyof typeof KCAL_PER_GRAM;

export type WeekStatistics = {
  /** Number of planned days the averages are taken from (1–7). */
  days: number;
  /** Daily average of every nutrient; "no data" counts as 0. */
  averages: Record<NutrientKey, number>;
  /** Average target kcal of the days' variants; undefined when no day's variant exists any more. */
  targetKcal?: number;
  /** % of daily energy from protein / fat / carbs. */
  energyShare: Record<EnergyMacro, number>;
  /** % of the norm for nutrients that have one. */
  normPercent: Partial<Record<NutrientKey, number>>;
  /** Number of different products of the week with no data for the nutrient (only nutrients with at least one). */
  missingData: Partial<Record<NutrientKey, number>>;
};

/** Statistics of the planned days; null when the week has no planned days. */
export function weekStatistics(days: readonly WeekPlanDay[]): WeekStatistics | null {
  if (days.length === 0) return null;

  const averages = {} as Record<NutrientKey, number>;
  for (const { key } of NUTRIENTS) averages[key] = 0;
  for (const day of days) {
    const totals = itemsTotals(day.items);
    for (const { key } of NUTRIENTS) averages[key] += totals[key] / days.length;
  }

  const variants = getMealPlanVariants();
  const targets = days.flatMap((day) => {
    const variant = day.source ? variants.find((v) => v.id === day.source!.variantId) : undefined;
    return variant ? [variant.targetKcal] : [];
  });
  const targetKcal = targets.length > 0 ? targets.reduce((sum, t) => sum + t, 0) / targets.length : undefined;

  const energyShare = {} as Record<EnergyMacro, number>;
  for (const key of Object.keys(KCAL_PER_GRAM) as EnergyMacro[]) {
    energyShare[key] = averages.kcal > 0 ? ((averages[key] * KCAL_PER_GRAM[key]) / averages.kcal) * 100 : 0;
  }

  const normPercent: Partial<Record<NutrientKey, number>> = {};
  for (const [key, norm] of Object.entries(NORMS) as [NutrientKey, { value: number }][]) {
    normPercent[key] = (averages[key] / norm.value) * 100;
  }

  const products = new Map(
    days
      .flatMap((day) => day.items.filter(isItemKnown).flatMap(itemIngredients))
      .map(({ product }) => [product.id, product]),
  );
  const missingData: Partial<Record<NutrientKey, number>> = {};
  for (const { key } of NUTRIENTS) {
    const count = [...products.values()].filter((product) => product.nutrients[key] === null).length;
    if (count > 0) missingData[key] = count;
  }

  return { days: days.length, averages, targetKcal, energyShare, normPercent, missingData };
}
