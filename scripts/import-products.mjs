// Converts the product CSV (exported from the owner's spreadsheet) into fixed data in code.
//
//   npm run import:products
//
// Input:  src/features/diet/products/products.csv
// Output: src/features/diet/products/products.data.ts  (generated — do not edit by hand)
//
// Errors stop the import (nothing is written). Warnings are only printed.
// See documentation: Modules/Diet/Products.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const INPUT = join(ROOT, "src/features/diet/products/products.csv");
const OUTPUT = join(ROOT, "src/features/diet/products/products.data.ts");

/**
 * CSV columns in the expected order. Nutrient columns map to keys of `Product.nutrients`.
 * Required nutrients must have a value; an empty optional one means "no data" (null).
 */
const COLUMNS = [
  { header: "ID", key: "csvId" },
  { header: "kategoria", key: "category" },
  { header: "firma", key: "brand" },
  { header: "nazwa produktu", key: "name" },
  { header: "węglowodany, g", nutrient: "carbs", required: true },
  { header: "białko, g", nutrient: "protein", required: true },
  { header: "tłuszcz, g", nutrient: "fat", required: true },
  { header: "błonnik, g", nutrient: "fiber", required: true },
  { header: "kcal", nutrient: "kcal", required: true },
  { header: "witamina A, µg", nutrient: "vitaminA" },
  { header: "witamina D, µg", nutrient: "vitaminD" },
  { header: "witamina E, mg", nutrient: "vitaminE" },
  { header: "witamina K, µg", nutrient: "vitaminK" },
  { header: "witamina C, mg", nutrient: "vitaminC" },
  { header: "witamina B1, mg", nutrient: "vitaminB1" },
  { header: "witamina B2, mg", nutrient: "vitaminB2" },
  { header: "witamina B3, mg", nutrient: "vitaminB3" },
  { header: "witamina B6, mg", nutrient: "vitaminB6" },
  { header: "witamina B9, µg", nutrient: "vitaminB9" },
  { header: "witamina B12, µg", nutrient: "vitaminB12" },
  { header: "żelazo, mg", nutrient: "iron" },
  { header: "wapń, mg", nutrient: "calcium" },
  { header: "magnez, mg", nutrient: "magnesium" },
  { header: "cynk, mg", nutrient: "zinc" },
  { header: "potas, mg", nutrient: "potassium" },
  { header: "jod, µg", nutrient: "iodine" },
];

/** kcal differing from 4·carbs + 4·protein + 9·fat by more than this is reported as a warning. */
const KCAL_TOLERANCE = { absolute: 25, relative: 0.15 };

const errors = [];
const warnings = [];
/** Warnings written to the data file, shown in the app under the product list. */
const productWarnings = [];

/** Minimal CSV parser: comma separator, quoted fields, "" as an escaped quote. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

const POLISH_LETTERS = { ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z" };

/** "Mąka orkiszowa jasna typ 700" → "maka-orkiszowa-jasna-typ-700" */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (ch) => POLISH_LETTERS[ch])
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "1,5" → 1.5; returns null when the value is not a valid non-negative number. */
function parseNumber(text) {
  const normalized = text.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

const text = readFileSync(INPUT, "utf8").replace(/^﻿/, "");
const [header, ...rows] = parseCsv(text);

const headerOk =
  header.length === COLUMNS.length && COLUMNS.every((col, i) => header[i].trim() === col.header);
if (!headerOk) {
  errors.push(
    "Header does not match the expected columns.\n" +
      `  expected: ${COLUMNS.map((c) => c.header).join(" | ")}\n` +
      `  found:    ${header.map((h) => h.trim()).join(" | ")}`,
  );
}

const products = [];
const seenCsvIds = new Map();
const seenSlugs = new Map();

rows.forEach((cells, index) => {
  if (!headerOk) return;
  const line = index + 2; // header is line 1
  const where = `line ${line}`;

  if (cells.length !== COLUMNS.length) {
    errors.push(`${where}: expected ${COLUMNS.length} columns, found ${cells.length}`);
    return;
  }

  const csvId = cells[0].trim();
  const category = cells[1].trim();
  const brand = cells[2].trim();
  const name = capitalize(cells[3].trim());
  const label = `${where} (ID ${csvId || "?"}, "${name}")`;

  if (!csvId) errors.push(`${label}: empty ID`);
  if (!category) errors.push(`${label}: empty category`);
  if (!name) errors.push(`${label}: empty name`);

  if (csvId) {
    if (seenCsvIds.has(csvId)) errors.push(`${label}: duplicate ID (also on line ${seenCsvIds.get(csvId)})`);
    else seenCsvIds.set(csvId, line);
  }

  const id = slugify(name);
  if (name && !id) errors.push(`${label}: name gives an empty id`);
  if (id) {
    if (seenSlugs.has(id)) errors.push(`${label}: id "${id}" is already used on line ${seenSlugs.get(id)}`);
    else seenSlugs.set(id, line);
  }

  const nutrients = {};
  COLUMNS.forEach((col, i) => {
    if (!col.nutrient) return;
    if (cells[i].trim() === "") {
      if (col.required) errors.push(`${label}: "${col.header}" is required`);
      nutrients[col.nutrient] = col.required ? 0 : null;
      return;
    }
    const value = parseNumber(cells[i]);
    if (value === null) errors.push(`${label}: "${col.header}" is not a valid number: "${cells[i]}"`);
    nutrients[col.nutrient] = value ?? 0;
  });

  const estimatedKcal = 4 * nutrients.carbs + 4 * nutrients.protein + 9 * nutrients.fat;
  const allowed = Math.max(KCAL_TOLERANCE.absolute, KCAL_TOLERANCE.relative * nutrients.kcal);
  if (Math.abs(estimatedKcal - nutrients.kcal) > allowed) {
    warnings.push(`${label}: kcal ${nutrients.kcal}, from macros ~${Math.round(estimatedKcal)}`);
    productWarnings.push({
      productId: id,
      type: "kcal",
      kcal: nutrients.kcal,
      estimatedKcal: Math.round(estimatedKcal),
    });
  }

  products.push({ id, name, category, brand: brand || null, nutrients });
});

for (const warning of warnings) console.warn(`⚠️  ${warning}`);

if (errors.length > 0) {
  for (const error of errors) console.error(`❌ ${error}`);
  console.error(`\nImport stopped: ${errors.length} error(s). Nothing was written.`);
  process.exit(1);
}

const output = [
  "// GENERATED by scripts/import-products.mjs from products.csv — do not edit by hand.",
  "// To change products: edit the CSV, then run `npm run import:products`.",
  "// Nutrient values are per 100 g.",
  "",
  'import type { Product, ProductWarning } from "./products";',
  "",
  "export const PRODUCTS: Product[] = [",
  ...products.map((p) => `  ${JSON.stringify(p)},`),
  "];",
  "",
  "/** Data to check — kcal not matching the macros. */",
  "export const PRODUCT_WARNINGS: ProductWarning[] = [",
  ...productWarnings.map((w) => `  ${JSON.stringify(w)},`),
  "];",
  "",
].join("\n");

writeFileSync(OUTPUT, output, "utf8");
console.log(`✅ ${products.length} products written to ${OUTPUT.slice(ROOT.length + 1)}`);
if (warnings.length > 0) console.log(`   ${warnings.length} warning(s) — check the lines above.`);
