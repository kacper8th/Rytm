// Converts the meal plan CSVs (exported from the owner's spreadsheet) into fixed data in code.
//
//   npm run import:meal-plans
//
// Input:  src/features/diet/meal-plans/data/*.csv  (one file = one variant)
//         src/features/diet/products/products.data.ts  (run import:products first)
//         src/features/diet/meals/meals.data.ts        (run import:meals first)
// Output: src/features/diet/meal-plans/meal-plans.data.ts  (generated — do not edit by hand)
//
// One row = one meal or product of a meal plan.
// Errors stop the import (nothing is written). Warnings are only printed.
// See documentation: Modules/Diet/Meal plans.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseCsv, parseNumber, slugify } from "./csv-utils.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const INPUT_DIR = join(ROOT, "src/features/diet/meal-plans/data");
const PRODUCTS = join(ROOT, "src/features/diet/products/products.data.ts");
const MEALS = join(ROOT, "src/features/diet/meals/meals.data.ts");
const OUTPUT = join(ROOT, "src/features/diet/meal-plans/meal-plans.data.ts");

const HEADER = [
  "Wariant",
  "Kalorie docelowe",
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

/** Meal type → max count per plan. Must match MEAL_TYPES in meal-plans.ts. */
const MEAL_TYPES = { śniadanie: 1, obiad: 1, podwieczorek: 1, przekąska: 2, kolacja: 1 };

/** Gain step columns → key of `Meal.gains` (see meals.ts). */
const GAIN_COLUMNS = { "Doważanie białko": "protein", "Doważanie węgle": "carbs", "Doważanie tłuszcze": "fat" };

/** Spreadsheet columns compared with the app's calculation → nutrient key and allowed difference. */
const CHECKED = [
  { header: "Kalorie", key: "kcal", tolerance: 1 },
  { header: "Węglowodany", key: "carbs", tolerance: 0.5 },
  { header: "Białko", key: "protein", tolerance: 0.5 },
  { header: "Tłuszcz", key: "fat", tolerance: 0.5 },
  { header: "Błonnik", key: "fiber", tolerance: 0.5 },
];

const errors = [];
const warnings = [];

/** Objects of a generated data file — one JSON object per line inside the array `name`. */
function readGenerated(path, name) {
  const lines = readFileSync(path, "utf8").split("\n");
  const start = lines.findIndex((line) => line.startsWith(`export const ${name}`));
  const result = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("]")) break;
    result.push(JSON.parse(line.trim().replace(/,$/, "")));
  }
  return result;
}

const products = new Map(readGenerated(PRODUCTS, "PRODUCTS").map((p) => [p.id, p]));
const meals = new Map(readGenerated(MEALS, "MEALS").map((m) => [m.id, m]));

/** Nutrients of an item, the same calculation as the app (meals.ts): "no data" counts as 0. */
function itemNutrients(grams) {
  const totals = Object.fromEntries(CHECKED.map(({ key }) => [key, 0]));
  for (const [productId, g] of grams) {
    const product = products.get(productId);
    for (const { key } of CHECKED) totals[key] += ((product.nutrients[key] ?? 0) * g) / 100;
  }
  return totals;
}

/** Meal ingredient grams after the gain steps — the same as mealIngredients() in meals.ts. */
function mealGrams(meal, steps) {
  const grams = new Map(meal.ingredients.map((i) => [i.productId, i.grams]));
  for (const [key, count] of Object.entries(steps)) {
    for (const item of meal.gains[key].items) grams.set(item.productId, grams.get(item.productId) + count * item.grams);
  }
  return grams;
}

const files = readdirSync(INPUT_DIR)
  .filter((f) => f.toLowerCase().endsWith(".csv"))
  .sort();
if (files.length === 0) errors.push(`no CSV files in ${INPUT_DIR.slice(ROOT.length + 1)}`);

const variants = [];

for (const file of files) {
  const text = readFileSync(join(INPUT_DIR, file), "utf8").replace(/^﻿/, "");
  const [header = [], ...rows] = parseCsv(text);

  const headerOk = header.length === HEADER.length && HEADER.every((h, i) => header[i].trim() === h);
  if (!headerOk) {
    errors.push(
      `${file}: header does not match the expected columns.\n` +
        `  expected: ${HEADER.join(" | ")}\n` +
        `  found:    ${header.map((h) => h.trim()).join(" | ")}`,
    );
    continue;
  }
  if (rows.length === 0) {
    errors.push(`${file}: no rows`);
    continue;
  }

  const variantName = rows[0][0]?.trim() ?? "";
  const rawTarget = rows[0][1]?.trim() ?? "";
  const targetKcal = parseNumber(rawTarget);
  if (!variantName) errors.push(`${file} row 2: empty Wariant`);
  if (targetKcal === null || targetKcal === 0) {
    errors.push(`${file} row 2: Kalorie docelowe must be a number greater than 0, found "${rawTarget}"`);
  }

  /** Plans by number, in the order of first appearance. */
  const plans = new Map();

  rows.forEach((cells, index) => {
    const where = `${file} row ${index + 2}`;
    if (cells.length !== HEADER.length) {
      errors.push(`${where}: expected ${HEADER.length} columns, found ${cells.length}`);
      return;
    }
    const cell = (h) => cells[HEADER.indexOf(h)].trim();
    const name = cell("Nazwa");
    const label = `${where} ("${name}")`;

    if (cell("Wariant") !== variantName) {
      errors.push(`${label}: Wariant "${cell("Wariant")}" differs from "${variantName}" in row 2`);
    }
    if (cell("Kalorie docelowe") !== rawTarget) {
      errors.push(`${label}: Kalorie docelowe "${cell("Kalorie docelowe")}" differs from "${rawTarget}" in row 2`);
    }

    const number = parseNumber(cell("Nazwa szablonu"));
    if (number === null || number === 0 || !Number.isInteger(number)) {
      errors.push(`${label}: Nazwa szablonu must be a whole number greater than 0, found "${cell("Nazwa szablonu")}"`);
      return;
    }

    const mealType = cell("Typ posiłku");
    if (!(mealType in MEAL_TYPES)) {
      errors.push(`${label}: unknown Typ posiłku "${mealType}"`);
      return;
    }

    const steps = {};
    for (const [column, key] of Object.entries(GAIN_COLUMNS)) {
      const count = parseNumber(cell(column));
      if (count === null || !Number.isInteger(count)) {
        errors.push(`${label}: ${column} must be a whole number ≥ 0, found "${cell(column)}"`);
        return;
      }
      if (count > 0) steps[key] = count;
    }

    const grams = parseNumber(cell("Waga [g]"));
    if (grams === null) {
      errors.push(`${label}: Waga [g] must be a number, found "${cell("Waga [g]")}"`);
      return;
    }

    let item;
    let itemGrams;
    const kind = cell("Typ pozycji");
    if (kind === "danie") {
      const meal = meals.get(slugify(name));
      if (!meal) {
        errors.push(`${label}: meal not found in Meals`);
        return;
      }
      if (grams !== 0) {
        errors.push(`${label}: a meal must have Waga [g] 0, found ${grams}`);
        return;
      }
      for (const [key, count] of Object.entries(steps)) {
        const gain = meal.gains[key];
        if (!gain) {
          errors.push(`${label}: ${key} gain steps, but the meal has no ${key} gain`);
          return;
        }
        if (count > gain.max) {
          errors.push(`${label}: ${count} ${key} gain steps, the meal allows at most ${gain.max}`);
          return;
        }
      }
      item = { mealType, kind: "meal", mealId: meal.id, steps };
      itemGrams = mealGrams(meal, steps);
    } else if (kind === "produkt") {
      const product = products.get(slugify(name));
      if (!product) {
        errors.push(`${label}: product not found in Products`);
        return;
      }
      if (grams === 0) {
        errors.push(`${label}: a product must have Waga [g] greater than 0`);
        return;
      }
      if (Object.keys(steps).length > 0) {
        errors.push(`${label}: a product cannot have gain steps`);
        return;
      }
      item = { mealType, kind: "product", productId: product.id, grams };
      itemGrams = new Map([[product.id, grams]]);
    } else {
      errors.push(`${label}: unknown Typ pozycji "${kind}"`);
      return;
    }

    const calculated = itemNutrients(itemGrams);
    for (const { header: column, key, tolerance } of CHECKED) {
      const sheet = parseNumber(cell(column));
      if (sheet === null) {
        warnings.push(`${label}: ${column} is not a number ("${cell(column)}") — not checked`);
      } else if (Math.abs(sheet - calculated[key]) > tolerance) {
        warnings.push(`${label}: ${column} in the spreadsheet ${sheet}, app ${calculated[key].toFixed(1)}`);
      }
    }

    if (!plans.has(number)) plans.set(number, { number, items: [] });
    plans.get(number).items.push(item);
  });

  for (const plan of plans.values()) {
    for (const [mealType, max] of Object.entries(MEAL_TYPES)) {
      const count = plan.items.filter((i) => i.mealType === mealType).length;
      if (count > max) errors.push(`${file}: meal plan ${plan.number} has ${count}× ${mealType}, at most ${max}`);
    }
  }

  const id = slugify(variantName);
  const other = variants.find((v) => v.id === id);
  if (other) errors.push(`${file}: variant "${variantName}" is already used in ${other.file}`);

  variants.push({
    file,
    id,
    name: variantName,
    targetKcal,
    plans: [...plans.values()].sort((a, b) => a.number - b.number),
  });
}

for (const warning of warnings) console.warn(`⚠️  ${warning}`);

if (errors.length > 0) {
  for (const error of errors) console.error(`❌ ${error}`);
  console.error(`\nImport stopped: ${errors.length} error(s). Nothing was written.`);
  process.exit(1);
}

const output = [
  "// GENERATED by scripts/import-meal-plans.mjs from meal-plans/data/*.csv — do not edit by hand.",
  "// To change meal plans: edit the CSV, then run `npm run import:meal-plans`.",
  "// Items are in the order of the file; the app sorts them by meal type.",
  "",
  'import type { MealPlanVariant } from "./meal-plans";',
  "",
  "export const MEAL_PLAN_VARIANTS: MealPlanVariant[] = [",
  ...variants.map(({ file, ...variant }) => `  ${JSON.stringify(variant)},`),
  "];",
  "",
].join("\n");

writeFileSync(OUTPUT, output, "utf8");
const planCount = variants.reduce((sum, v) => sum + v.plans.length, 0);
console.log(`✅ ${variants.length} variant(s), ${planCount} meal plans written to ${OUTPUT.slice(ROOT.length + 1)}`);
if (warnings.length > 0) console.log(`   ${warnings.length} warning(s) — check the lines above.`);
