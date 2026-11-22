import { json, type Env } from "../../_lib/http";

/**
 * GET /api/diet-base/usage — where the user's saved data uses items of the Diet base, so an import that replaces data
 * can say what will lose its link: { pantry: [productId], shoppingLists: {productId: lists},
 * weekDays: { products: {id: days}, meals: {id: days}, plans: {id: days} } }.
 */
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const [pantry, lists, items, sources] = await env.DB.batch([
    env.DB.prepare("SELECT product_id AS id FROM pantry_items"),
    env.DB.prepare("SELECT product_id AS id, COUNT(DISTINCT list_id) AS n FROM shopping_list_items GROUP BY product_id"),
    env.DB.prepare(
      `SELECT json_extract(i.value, '$.productId') AS productId, json_extract(i.value, '$.mealId') AS mealId,
              d.week_start || '/' || d.day AS dayKey
       FROM week_plan_days d, json_each(d.items) i`,
    ),
    env.DB.prepare("SELECT json_extract(source, '$.planId') AS id, COUNT(*) AS n FROM week_plan_days WHERE source IS NOT NULL GROUP BY 1"),
  ]);

  /** Days per id — an item used twice on one day counts once. */
  const days = (key: "productId" | "mealId") => {
    const seen = new Map<string, Set<string>>();
    for (const row of items.results as { productId: string | null; mealId: string | null; dayKey: string }[]) {
      const id = row[key];
      if (id) (seen.get(id) ?? seen.set(id, new Set()).get(id)!).add(row.dayKey);
    }
    return Object.fromEntries([...seen].map(([id, set]) => [id, set.size]));
  };
  const counts = (rows: unknown[]) =>
    Object.fromEntries((rows as { id: string | null; n: number }[]).filter((r) => r.id).map((r) => [r.id, r.n]));

  return json({
    pantry: (pantry.results as { id: string }[]).map((r) => r.id),
    shoppingLists: counts(lists.results),
    weekDays: { products: days("productId"), meals: days("mealId"), plans: counts(sources.results) },
  });
};
