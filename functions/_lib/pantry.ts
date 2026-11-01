/**
 * Pantry API helpers — validation and row mapping. See documentation: Modules/Diet/Pantry → Data.
 * Product data lives in the front-end code; the server checks only the shape.
 */

export type PantryItem = {
  productId: string;
  grams: number;
  updatedAt: string;
};

export type PantryItemRow = {
  product_id: string;
  grams: number;
  updated_at: string;
};

/** Columns of pantry_items read by rowToPantryItem(). */
export const PANTRY_COLUMNS = "product_id, grams, updated_at";

export function rowToPantryItem(row: PantryItemRow): PantryItem {
  return { productId: row.product_id, grams: row.grams, updatedAt: row.updated_at };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 200;
const isGrams = (v: unknown): v is number => typeof v === "number" && v > 0 && v <= 100_000;

/** Checks the body of POST /api/pantry. Returns the clean item or an error message. */
export function parseAddBody(body: unknown): { productId: string; grams: number } | string {
  if (!isRecord(body)) return "Body must be an object.";
  if (!isId(body.productId)) return "Invalid productId.";
  if (!isGrams(body.grams)) return "`grams` must be > 0.";
  return { productId: body.productId, grams: body.grams };
}

/** Checks the body of PATCH /api/pantry/:productId. Returns the grams or an error message. */
export function parseEditBody(body: unknown): number | string {
  if (!isRecord(body)) return "Body must be an object.";
  return isGrams(body.grams) ? body.grams : "`grams` must be > 0.";
}
