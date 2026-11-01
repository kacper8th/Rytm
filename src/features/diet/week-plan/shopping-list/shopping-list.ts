import { isItemKnown, itemIngredients, type MealPlanItem } from "../../meal-plans/meal-plans";
import { getPantry } from "../../pantry/pantry";
import { fromIsoDate, getWeekPlan, request, toIsoDate, weekStartOf, dayDate } from "../week-plan";

/**
 * Shopping lists — user data saved on the server (Cloudflare D1 via /api/shopping-lists).
 * A list is a snapshot of the products of the planned days in a date range, made when the list is created.
 * The only way screens get or change shopping lists. See documentation: Modules/Diet/Week plan/Shopping list.
 */

/** Must match MAX_RANGE_DAYS in functions/_lib/shopping-list.ts. */
export const MAX_RANGE_DAYS = 31;

export type ShoppingListItem = {
  productId: string;
  /** Copied from Products when the list was created. */
  name: string;
  category: string;
  /** Grams per day, keyed by YYYY-MM-DD; empty for items added only by hand. */
  days: Record<string, number>;
  checked: boolean;
  /** Grams added by hand to a product (Manual items), or null. */
  addedGrams: number | null;
  /** Own item (Manual items): amount as typed, or null. */
  amount: string | null;
  /** The product was in the Pantry when the list was created (snapshot); see isInPantry(). */
  inPantry: boolean;
};

/**
 * Treated as in the Pantry — hidden by default, not counted as a thing to buy: marked inPantry and no grams added by hand.
 * Adding grams by hand means it is to be bought; removing the addition brings the mark back.
 */
export function isInPantry(item: Pick<ShoppingListItem, "inPantry"> & { addedGrams?: number | null }): boolean {
  return item.inPantry && (item.addedGrams ?? null) === null;
}

/** Items to buy — without pantry products; used for "produkty" and "kupione x/y". */
export function itemsToBuy<T extends Pick<ShoppingListItem, "inPantry"> & { addedGrams?: number | null }>(
  items: readonly T[],
): T[] {
  return items.filter((item) => !isInPantry(item));
}

/** An own item (Manual items) — a name typed by hand, not a product from Products. */
export function isOwnItem(item: Pick<ShoppingListItem, "productId">): boolean {
  return item.productId.startsWith("custom-");
}

export type ShoppingListSummary = {
  id: string;
  /** YYYY-MM-DD, both included. */
  from: string;
  to: string;
  /** Days of the range that had a plan. */
  plannedDays: number;
  createdAt: string;
  /** Number of products and of bought products, both without pantry products. */
  items: number;
  checked: number;
};

export type ShoppingList = Omit<ShoppingListSummary, "items" | "checked"> & { items: ShoppingListItem[] };

/** Items of a new list, before it is saved. */
export type NewShoppingListItem = Omit<ShoppingListItem, "checked" | "addedGrams" | "amount">;

/** Products of a date range, calculated from the week plans — the preview on the new-list screen. */
export type RangeItems = {
  rangeDays: number;
  plannedDays: number;
  items: NewShoppingListItem[];
  /** Plan items whose meal / product no longer exists — left out. */
  missing: number;
};

// ---- dates ----

/** All dates from `from` to `to`, both included (YYYY-MM-DD). */
export function rangeDates(from: string, to: string): string[] {
  const dates: string[] = [];
  for (const date = fromIsoDate(from); toIsoDate(date) <= to; date.setDate(date.getDate() + 1)) {
    dates.push(toIsoDate(date));
  }
  return dates;
}

/** A valid range: both dates set, `from` ≤ `to`, at most MAX_RANGE_DAYS days. Returns an error message or null. */
export function rangeError(from: string, to: string): string | null {
  if (!from || !to) return "Podaj obie daty.";
  if (from > to) return "Data „od” jest po dacie „do”.";
  if (rangeDates(from, to).length > MAX_RANGE_DAYS) return `Zakres może mieć najwyżej ${MAX_RANGE_DAYS} dni.`;
  return null;
}

/** Default range for a new list: today – Sunday of the current week. */
export function defaultRange(): { from: string; to: string } {
  const today = new Date();
  return { from: toIsoDate(today), to: toIsoDate(dayDate(weekStartOf(today), 6)) };
}

/** Grams of all days of an item, plus grams added by hand. */
export function itemGrams(item: Pick<ShoppingListItem, "days"> & { addedGrams?: number | null }): number {
  return Object.values(item.days).reduce((sum, grams) => sum + grams, item.addedGrams ?? 0);
}

// ---- building a list from the week plans ----

/**
 * Loads the planned days of the range (one request per week) and sums their products;
 * products in the Pantry are marked `inPantry`, whatever the pantry grams.
 */
export async function loadRangeItems(from: string, to: string): Promise<RangeItems> {
  const dates = rangeDates(from, to);
  const weeks = [...new Set(dates.map((date) => weekStartOf(fromIsoDate(date))))];
  const [plans, pantry] = await Promise.all([Promise.all(weeks.map(getWeekPlan)), getPantry()]);
  const inPantry = new Set(pantry.map((item) => item.productId));

  const inRange = new Set(dates);
  const days: { date: string; items: MealPlanItem[] }[] = [];
  for (const plan of plans) {
    for (const day of plan.days) {
      const date = toIsoDate(dayDate(plan.weekStart, day.day));
      if (inRange.has(date)) days.push({ date, items: day.items });
    }
  }

  const { items, missing } = buildItems(days, inPantry);
  return { rangeDays: dates.length, plannedDays: days.length, items, missing };
}

/** Grams per product and day — the same ingredients as on the week screen (meals after the plan's gain steps). */
function buildItems(days: readonly { date: string; items: readonly MealPlanItem[] }[], inPantry: ReadonlySet<string>) {
  const byProduct = new Map<string, NewShoppingListItem>();
  let missing = 0;
  for (const { date, items } of days) {
    for (const item of items) {
      if (!isItemKnown(item)) {
        missing += 1;
        continue;
      }
      for (const { product, grams } of itemIngredients(item)) {
        if (!(grams > 0)) continue;
        let entry = byProduct.get(product.id);
        if (!entry) {
          entry = {
            productId: product.id,
            name: product.name,
            category: product.category,
            days: {},
            inPantry: inPantry.has(product.id),
          };
          byProduct.set(product.id, entry);
        }
        entry.days[date] = (entry.days[date] ?? 0) + grams;
      }
    }
  }
  return { items: [...byProduct.values()], missing };
}

// ---- API ----

/** Saved lists, newest first. */
export async function listShoppingLists(): Promise<ShoppingListSummary[]> {
  const response = await request("/api/shopping-lists");
  return ((await response.json()) as { lists: ShoppingListSummary[] }).lists;
}

export async function getShoppingList(id: string): Promise<ShoppingList> {
  const response = await request(`/api/shopping-lists/${encodeURIComponent(id)}`);
  return (await response.json()) as ShoppingList;
}

/** Saves a new list and returns its id. */
export async function createShoppingList(
  from: string,
  to: string,
  plannedDays: number,
  items: readonly NewShoppingListItem[],
): Promise<string> {
  const response = await request("/api/shopping-lists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, plannedDays, items }),
  });
  return ((await response.json()) as { id: string }).id;
}

export async function setItemChecked(id: string, productId: string, checked: boolean): Promise<void> {
  await request(`/api/shopping-lists/${encodeURIComponent(id)}/items/${encodeURIComponent(productId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ checked }),
  });
}

export async function deleteShoppingList(id: string): Promise<void> {
  await request(`/api/shopping-lists/${encodeURIComponent(id)}`, { method: "DELETE" });
}
