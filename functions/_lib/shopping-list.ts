/**
 * Shopping list API helpers — validation and row mapping. See documentation: Modules/Diet/Week plan/Shopping list → Data.
 * Items are calculated by the app (product and meal data live in the front-end code); the server checks only their shape.
 */

/** Must match MAX_RANGE_DAYS in src/features/diet/week-plan/shopping-list/shopping-list.ts. */
export const MAX_RANGE_DAYS = 31;
const MAX_ITEMS = 500;

export type ShoppingListItem = {
  productId: string;
  name: string;
  category: string;
  /** Grams per day, keyed by YYYY-MM-DD; empty for items added only by hand. */
  days: Record<string, number>;
  checked: boolean;
  /** Grams added by hand to a product (Manual items), or null. */
  addedGrams: number | null;
  /** Own item (id "custom-…"): amount as typed, or null. */
  amount: string | null;
  /** Grams of the product in the Pantry (null = not there); kept in sync on current lists. */
  pantryGrams: number | null;
};

/** Own items (Manual items) have ids with this prefix; product ids are slugs and never start with it. */
export const CUSTOM_PREFIX = "custom-";

/** Category of own items — the group "Inne", together with Products of that category. */
export const CUSTOM_CATEGORY = "inne";

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
  added_grams: number | null;
  amount: string | null;
  pantry_grams: number | null;
};

/** Columns of shopping_list_items read by rowToItem(). */
export const ITEM_COLUMNS = "product_id, name, category, days, checked, added_grams, amount, pantry_grams";

/** A list id is a random UUID. */
export const isListId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f-]{36}$/.test(value);

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
    addedGrams: row.added_grams,
    amount: row.amount,
    pantryGrams: row.pantry_grams,
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 200;

type NewList = {
  from: string;
  to: string;
  plannedDays: number;
  items: Omit<ShoppingListItem, "checked" | "addedGrams" | "amount">[];
};

const isGrams = (v: unknown): v is number => typeof v === "number" && v > 0 && v <= 100_000;

/** Amount of an own item: text up to 100 characters; empty → null. */
function parseAmount(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length > 100) return undefined;
  return value.trim() || null;
}

export type AddItem =
  | { kind: "product"; productId: string; name: string; category: string; grams: number }
  | { kind: "own"; name: string; amount: string | null };

/** Checks the body of POST /api/shopping-lists/:id/items. Returns the clean item or an error message. */
export function parseAddBody(body: unknown): AddItem | string {
  if (!isRecord(body)) return "Body must be an object.";
  if (body.productId === undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!isText(name)) return "`name` must not be empty (max 200 characters).";
    const amount = parseAmount(body.amount);
    if (amount === undefined) return "`amount` must be text (max 100 characters) or empty.";
    return { kind: "own", name, amount };
  }
  const { productId, name, category, grams } = body;
  if (!isText(productId) || productId.startsWith(CUSTOM_PREFIX)) return "Invalid productId.";
  if (!isText(name)) return "Missing name.";
  if (!isText(category)) return "Missing category.";
  if (!isGrams(grams)) return "`grams` must be > 0.";
  return { kind: "product", productId, name, category, grams };
}

export type EditItem =
  | { kind: "checked"; checked: boolean }
  | { kind: "addedGrams"; grams: number }
  | { kind: "own"; name: string; amount: string | null };

/** Checks the body of PATCH …/items/:productId. Returns the clean change or an error message. */
export function parseEditBody(body: unknown): EditItem | string {
  if (!isRecord(body)) return "Body must be an object.";
  if (body.checked !== undefined) {
    return typeof body.checked === "boolean" ? { kind: "checked", checked: body.checked } : "`checked` must be true or false.";
  }
  if (body.addedGrams !== undefined) {
    return isGrams(body.addedGrams) ? { kind: "addedGrams", grams: body.addedGrams } : "`addedGrams` must be > 0.";
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!isText(name)) return "Body must have `checked`, `addedGrams`, or `name` (+ `amount`).";
  const amount = parseAmount(body.amount);
  if (amount === undefined) return "`amount` must be text (max 100 characters) or empty.";
  return { kind: "own", name, amount };
}

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
    const pantryGrams = item.pantryGrams ?? null;
    if (pantryGrams !== null && !isGrams(pantryGrams)) return `Item ${i}: pantryGrams must be > 0 or empty.`;

    const itemDays: Record<string, number> = {};
    for (const [date, grams] of Object.entries(item.days)) {
      if (parseDate(date) === null || date < from || date > to) return `Item ${i}: day "${date}" is outside the range.`;
      if (typeof grams !== "number" || !(grams > 0) || grams > 100_000) return `Item ${i}: grams must be > 0.`;
      itemDays[date] = grams;
    }
    clean.push({ productId, name, category, days: itemDays, pantryGrams });
  }

  return { from, to, plannedDays: plannedDays as number, items: clean };
}
