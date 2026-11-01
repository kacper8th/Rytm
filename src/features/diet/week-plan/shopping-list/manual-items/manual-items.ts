import type { Product } from "../../../products/products";
import { request } from "../../week-plan";
import type { ShoppingListItem } from "../shopping-list";

/**
 * Manual items — products and own items added by hand to an existing shopping list (Cloudflare D1 via /api/shopping-lists).
 * See documentation: Modules/Diet/Week plan/Shopping list/Manual items.
 */

function itemUrl(listId: string, productId?: string): string {
  const base = `/api/shopping-lists/${encodeURIComponent(listId)}/items`;
  return productId === undefined ? base : `${base}/${encodeURIComponent(productId)}`;
}

async function send(url: string, method: string, body: unknown): Promise<ShoppingListItem> {
  const response = await request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await response.json()) as ShoppingListItem;
}

/** Adds grams of a product — to its row when it is already on the list (the row is un-checked). Returns the row. */
export function addProduct(listId: string, product: Product, grams: number): Promise<ShoppingListItem> {
  return send(itemUrl(listId), "POST", {
    productId: product.id,
    name: product.name,
    category: product.category,
    grams,
  });
}

/** Adds an own item (name and amount as typed). */
export function addOwnItem(listId: string, name: string, amount: string): Promise<ShoppingListItem> {
  return send(itemUrl(listId), "POST", { name, amount });
}

/** Changes the grams added by hand to a product. */
export function setAddedGrams(listId: string, productId: string, grams: number): Promise<ShoppingListItem> {
  return send(itemUrl(listId, productId), "PATCH", { addedGrams: grams });
}

/** Changes the name and amount of an own item. */
export function setOwnItem(listId: string, productId: string, name: string, amount: string): Promise<ShoppingListItem> {
  return send(itemUrl(listId, productId), "PATCH", { name, amount });
}

/** Removes what was added by hand: an own item, or the added grams of a product (a product added only by hand disappears). */
export async function removeManual(listId: string, productId: string): Promise<void> {
  await request(itemUrl(listId, productId), { method: "DELETE" });
}
