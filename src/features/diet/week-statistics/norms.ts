import type { NutrientKey } from "../products/products";

/**
 * Daily norms for week statistics — fixed data (see Decision 002 - Data).
 * Source: "Normy żywienia dla populacji Polski", NIZP PZH-PIB, 2024
 * (https://www.pzh.gov.pl/wp-content/uploads/2025/01/normy-02.01.pdf), summary tables 21, 23–29.
 * See documentation: Modules/Diet/Week plan/Week statistics.
 */

/** The one profile the norms are taken for; a profile setting in the app may come later. */
export const NORM_PROFILE = { sex: "mężczyzna", ageGroup: "31–50 lat" } as const;

export type NormType = "RDA" | "AI";

export type Norm = {
  /** Daily amount, in the nutrient's unit from NUTRIENTS. */
  value: number;
  /** RDA = recommended intake; AI = adequate intake (used when there is no RDA). */
  type: NormType;
};

/** Norms per nutrient. kcal, protein, fat and carbs have none — they are compared to the variant's target. */
export const NORMS: Partial<Record<NutrientKey, Norm>> = {
  fiber: { value: 25, type: "AI" }, // table 21, p. 447
  vitaminA: { value: 900, type: "RDA" }, // table 23, p. 449 (retinol equivalent)
  vitaminD: { value: 15, type: "AI" }, // table 23, p. 449
  vitaminE: { value: 10, type: "AI" }, // table 23, p. 449 (α-tocopherol equivalent)
  vitaminK: { value: 65, type: "AI" }, // table 23, p. 449
  vitaminC: { value: 90, type: "RDA" }, // table 24, p. 450
  vitaminB1: { value: 1.3, type: "RDA" }, // table 24, p. 450
  vitaminB2: { value: 1.3, type: "RDA" }, // table 24, p. 450
  vitaminB3: { value: 16, type: "RDA" }, // table 24, p. 450
  vitaminB6: { value: 1.3, type: "RDA" }, // table 25, p. 451
  vitaminB9: { value: 400, type: "RDA" }, // table 26, p. 452 (folate equivalent)
  vitaminB12: { value: 2.4, type: "RDA" }, // table 26, p. 452
  calcium: { value: 1000, type: "RDA" }, // table 27, p. 453
  magnesium: { value: 400, type: "RDA" }, // table 27, p. 453
  iron: { value: 10, type: "RDA" }, // table 27, p. 453
  zinc: { value: 11, type: "RDA" }, // table 28, p. 454
  iodine: { value: 150, type: "RDA" }, // table 28, p. 454
  potassium: { value: 3500, type: "AI" }, // table 29, p. 455
};
