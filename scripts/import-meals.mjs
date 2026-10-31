// Converts the meal CSV (exported from the owner's spreadsheet) into fixed data in code.
//
//   npm run import:meals
//
// Input:  src/features/diet/meals/meals.csv
//         src/features/diet/products/products.data.ts  (product ids — run import:products first)
// Output: src/features/diet/meals/meals.data.ts  (generated — do not edit by hand)
//
// The CSV is in "long" format: one row = one property of a meal.
// Errors stop the import (nothing is written). Warnings are only printed.
// See documentation: Modules/Diet/Meals.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { capitalize, parseCsv, parseNumber, slugify } from "./csv-utils.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const INPUT = join(ROOT, "src/features/diet/meals/meals.csv");
const PRODUCTS = join(ROOT, "src/features/diet/products/products.data.ts");
const OUTPUT = join(ROOT, "src/features/diet/meals/meals.data.ts");

const HEADER = ["Nazwa", "Parametr", "Wartość", "produkt", "waga [g]"];

/** `Parametr` values that are tags (value "tak"). Must match MEAL_TAGS in meals.ts. */
const TAGS = ["śniadanie", "obiad", "kolacja", "przekąska"];

/** `Parametr` "przyrost <label>" → key of `Meal.gains`. Must match GAIN_MACROS in meals.ts. */
const GAINS = { białko: "protein", węgle: "carbs", tłuszcze: "fat" };

const errors = [];
const warnings = [];

/** Product ids from the generated product data — ingredients must refer to one of them. */
const productIds = new Set(
  [...readFileSync(PRODUCTS, "utf8").matchAll(/"id":"([^"]+)"/g)].map((match) => match[1]),
);

const text = readFileSync(INPUT, "utf8").replace(/^﻿/, "");
const [header, ...rows] = parseCsv(text);

const headerOk = header.length === HEADER.length && HEADER.every((h, i) => header[i].trim() === h);
if (!headerOk) {
  errors.push(
    "Header does not match the expected columns.\n" +
      `  expected: ${HEADER.join(" | ")}\n` +
      `  found:    ${header.map((h) => h.trim()).join(" | ")}`,
  );
}

/** Meals by id, in the order of first appearance. */
const meals = new Map();

/** "Papryka czerwona" + "200" → { productId, grams }, or null after reporting an error. */
function parseItem(label, productName, weight) {
  const productId = slugify(productName);
  if (!productName) {
    errors.push(`${label}: empty product`);
    return null;
  }
  if (!productIds.has(productId)) {
    errors.push(`${label}: product "${productName}" not found in Products`);
    return null;
  }
  const grams = parseNumber(weight);
  if (grams === null || grams === 0) {
    errors.push(`${label}: weight must be a number greater than 0, found "${weight}"`);
    return null;
  }
  return { productId, grams };
}

rows.forEach((cells, index) => {
  if (!headerOk) return;
  const where = `row ${index + 2}`; // header is row 1; a multi-line recipe counts as one row

  if (cells.length !== HEADER.length) {
    errors.push(`${where}: expected ${HEADER.length} columns, found ${cells.length}`);
    return;
  }

  const name = capitalize(cells[0].trim());
  const rawParam = cells[1].trim();
  const param = rawParam.toLowerCase() === "przepis" ? "Przepis" : rawParam;
  const value = cells[2].trim();
  const productName = cells[3].trim();
  const weight = cells[4].trim();
  const label = `${where} ("${name}", ${param || "?"})`;

  if (!name) {
    errors.push(`${label}: empty meal name`);
    return;
  }
  const id = slugify(name);
  if (!meals.has(id)) {
    meals.set(id, { id, name, tags: [], recipe: null, ingredients: [], gains: {}, gainMax: {} });
  }
  const meal = meals.get(id);
  if (meal.name !== name) {
    errors.push(`${label}: id "${id}" is already used by meal "${meal.name}"`);
    return;
  }

  if (param === "składnik") {
    // Weight 0 = optional ingredient in the spreadsheet — left out of the meal for now.
    if (parseNumber(weight) === 0) {
      warnings.push(`${label}: "${productName}" has weight 0 — optional, left out`);
      return;
    }
    const item = parseItem(label, productName, weight);
    if (!item) return;
    if (meal.ingredients.some((i) => i.productId === item.productId)) {
      errors.push(`${label}: ingredient "${productName}" appears twice`);
      return;
    }
    meal.ingredients.push(item);
  } else if (param === "Przepis") {
    if (meal.recipe !== null) errors.push(`${label}: more than one recipe`);
    else if (!value) warnings.push(`${label}: empty recipe — treated as no recipe`);
    else meal.recipe = value;
  } else if (TAGS.includes(param)) {
    if (value.toLowerCase() !== "tak") errors.push(`${label}: expected "tak", found "${value}"`);
    else if (!meal.tags.includes(param)) meal.tags.push(param);
  } else if (/^przyrost \S+ max$/.test(param) && GAINS[param.split(" ")[1]]) {
    const key = GAINS[param.split(" ")[1]];
    const max = parseNumber(value);
    if (max === null || max === 0 || !Number.isInteger(max)) {
      errors.push(`${label}: max must be a whole number greater than 0, found "${value}"`);
    } else if (meal.gainMax[key] !== undefined) {
      errors.push(`${label}: max given twice`);
    } else {
      meal.gainMax[key] = max;
    }
  } else if (/^przyrost \S+$/.test(param) && GAINS[param.split(" ")[1]]) {
    const key = GAINS[param.split(" ")[1]];
    const item = parseItem(label, productName, weight);
    if (!item) return;
    meal.gains[key] ??= [];
    if (meal.gains[key].some((i) => i.productId === item.productId)) {
      errors.push(`${label}: gain product "${productName}" appears twice`);
      return;
    }
    meal.gains[key].push({ ...item, label });
  } else {
    errors.push(`${label}: unknown Parametr "${rawParam}"`);
  }
});

const output = [];
for (const meal of meals.values()) {
  const label = `"${meal.name}"`;
  if (meal.ingredients.length === 0) errors.push(`${label}: no ingredients`);

  const gains = {};
  for (const key of Object.values(GAINS)) {
    const items = meal.gains[key];
    const max = meal.gainMax[key];
    if (items && max === undefined) errors.push(`${label}: gain "${key}" has steps but no max`);
    if (!items && max !== undefined) errors.push(`${label}: gain "${key}" has max but no steps`);
    if (!items || max === undefined) continue;
    for (const item of items) {
      if (!meal.ingredients.some((i) => i.productId === item.productId)) {
        errors.push(`${item.label}: gain product "${item.productId}" is not an ingredient of the meal`);
      }
    }
    gains[key] = { max, items: items.map(({ productId, grams }) => ({ productId, grams })) };
  }

  output.push({
    id: meal.id,
    name: meal.name,
    tags: meal.tags,
    recipe: meal.recipe,
    ingredients: meal.ingredients,
    gains,
  });
}

for (const warning of warnings) console.warn(`⚠️  ${warning}`);

if (errors.length > 0) {
  for (const error of errors) console.error(`❌ ${error}`);
  console.error(`\nImport stopped: ${errors.length} error(s). Nothing was written.`);
  process.exit(1);
}

const file = [
  "// GENERATED by scripts/import-meals.mjs from meals.csv — do not edit by hand.",
  "// To change meals: edit the CSV, then run `npm run import:meals`.",
  "// Ingredient grams are for the base meal; gain items are grams added per step.",
  "",
  'import type { Meal } from "./meals";',
  "",
  "export const MEALS: Meal[] = [",
  ...output.map((m) => `  ${JSON.stringify(m)},`),
  "];",
  "",
].join("\n");

writeFileSync(OUTPUT, file, "utf8");
console.log(`✅ ${output.length} meals written to ${OUTPUT.slice(ROOT.length + 1)}`);
if (warnings.length > 0) console.log(`   ${warnings.length} warning(s) — check the lines above.`);
