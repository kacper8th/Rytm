/**
 * Shopping list API helpers — validation and row mapping. See documentation: Modules/Diet/Week plan/Shopping list → Data.
 * Items are calculated by the app (product and meal data live in the front-end code); the server checks only their shape.
 */

import { json } from "./week-plan";

/** Must match MAX_RANGE_DAYS in src/features/diet/week-plan/shopping-list/shopping-list.ts. */
export const MAX_RANGE_DAYS = 31;
const MAX_ITEMS = 500;

export type ShoppingListItem = {
  productId: string;
  name: string;
  category: string;
  /** Grams per day, keyed by YYYY-MM-DD. */
  days: Record<string, number>;
  checked: boolean;
};

export type ShoppingListRow = {
  id: string;
  date_from: string;
  date_to: string;
  planned_days: number;
  created_at: string;
};

export type ShoppingListItemRow = {
  product_id: string;
  name: string;
  category: string;
  days: string;
  checked: number;
};

export function notFound(error: string): Response {
  return json({ error }, 404);
}

/** A date as YYYY-MM-DD, or null. */
export function parseDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return value;
}

/** Number of days from `from` to `to`, both included. */
export function rangeDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

export function rowToSummary(row: ShoppingListRow) {
  return { id: row.id, from: row.date_from, to: row.date_to, plannedDays: row.planned_days, createdAt: row.created_at };
}

export function rowToItem(row: ShoppingListItemRow): ShoppingListItem {
  return {
    productId: row.product_id,
    name: row.name,
    category: row.category,
    days: JSON.parse(row.days) as Record<string, number>,
    checked: row.checked === 1,
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 200;

type NewList = { from: string; to: string; plannedDays: number; items: Omit<ShoppingListItem, "checked">[] };

/** Checks the body of POST /api/shopping-lists. Returns the clean list or an error message. */
export function parseListBody(body: unknown): NewList | string {
  if (!isRecord(body)) return "Body must be an object.";
  const from = parseDate(body.from);
  const to = parseDate(body.to);
  if (!from || !to) return "`from` and `to` must be dates as YYYY-MM-DD.";
  if (from > to) return "`from` must not be after `to`.";
  const days = rangeDays(from, to);
  if (days > MAX_RANGE_DAYS) return `Range too long (max ${MAX_RANGE_DAYS} days).`;

  const { plannedDays, items } = body;
  if (!Number.isInteger(plannedDays) || (plannedDays as number) < 1 || (plannedDays as number) > days) {
    return "`plannedDays` must be a whole number from 1 to the number of days in the range.";
  }
  if (!Array.isArray(items) || items.length === 0) return "`items` must be a non-empty array.";
  if (items.length > MAX_ITEMS) return `Too many items (max ${MAX_ITEMS}).`;

  const seen = new Set<string>();
  const clean: NewList["items"] = [];
  for (const [i, item] of items.entries()) {
    if (!isRecord(item)) return `Item ${i}: must be an object.`;
    const { productId, name, category } = item;
    if (!isText(productId)) return `Item ${i}: missing productId.`;
    if (seen.has(productId)) return `Item ${i}: product "${productId}" appears twice.`;
    seen.add(productId);
    if (!isText(name)) return `Item ${i}: missing name.`;
    if (!isText(category)) return `Item ${i}: missing category.`;
    if (!isRecord(item.days) || Object.keys(item.days).length === 0) return `Item ${i}: days must be a non-empty object.`;

    const itemDays: Record<string, number> = {};
    for (const [date, grams] of Object.entries(item.days)) {
      if (parseDate(date) === null || date < from || date > to) return `Item ${i}: day "${date}" is outside the range.`;
      if (typeof grams !== "number" || !(grams > 0) || grams > 100_000) return `Item ${i}: grams must be > 0.`;
      itemDays[date] = grams;
    }
    clean.push({ productId, name, category, days: itemDays });
  }

  return { from, to, plannedDays: plannedDays as number, items: clean };
}
