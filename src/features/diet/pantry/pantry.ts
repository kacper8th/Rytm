import { request } from "../week-plan/week-plan";

/**
 * Pantry — products kept at home, user data saved on the server (Cloudflare D1 via /api/pantry).
 * The only way screens get or change the pantry. See documentation: Modules/Diet/Pantry.
 */

export type PantryItem = {
  /** Product id from Products; the product may no longer exist there. */
  productId: string;
  /** Saved, but does not change shopping lists yet. */
  grams: number;
  updatedAt: string;
};

function itemUrl(productId?: string): string {
  return productId === undefined ? "/api/pantry" : `/api/pantry/${encodeURIComponent(productId)}`;
}

async function send(url: string, method: string, body: unknown): Promise<PantryItem> {
  const response = await request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await response.json()) as PantryItem;
}

export async function getPantry(): Promise<PantryItem[]> {
  const response = await request(itemUrl());
  return ((await response.json()) as { items: PantryItem[] }).items;
}

/** Adds grams of a product — to its grams when it is already in the pantry. Returns the item. */
export function addToPantry(productId: string, grams: number): Promise<PantryItem> {
  return send(itemUrl(), "POST", { productId, grams });
}

export function setPantryGrams(productId: string, grams: number): Promise<PantryItem> {
  return send(itemUrl(productId), "PATCH", { grams });
}

export async function removeFromPantry(productId: string): Promise<void> {
  await request(itemUrl(productId), { method: "DELETE" });
}
