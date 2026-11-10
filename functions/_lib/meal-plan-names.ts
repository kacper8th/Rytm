/**
 * Meal plan names API helpers — validation and row mapping. See documentation: Modules/Diet/Meal plans → Names.
 * The server checks only the shape; whether the variant and plan exist is known only to the app (data from CSV).
 */

export type MealPlanName = { variantId: string; planNumber: number; name: string };

export type MealPlanNameRow = { variant_id: string; plan_number: number; name: string };

/** Columns read by rowToName. */
export const NAME_COLUMNS = "variant_id, plan_number, name";

/** Must match the length limit in src/features/diet/meal-plans/meal-plans.ts. */
const NAME_MAX = 100;

export function rowToName(row: MealPlanNameRow): MealPlanName {
  return { variantId: row.variant_id, planNumber: row.plan_number, name: row.name };
}

/** A variant id — slug of the variant name, as made by the import script (e.g. "2800-kcal") — or null. */
export function parseVariantId(value: unknown): string | null {
  return typeof value === "string" && value.length <= 100 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) ? value : null;
}

/** A meal plan number — whole number > 0 — or null. */
export function parsePlanNumber(value: unknown): number | null {
  return typeof value === "string" && /^[1-9]\d{0,5}$/.test(value) ? Number(value) : null;
}

/** Checks the body of PUT /api/meal-plan-names/:variant/:number. Returns the trimmed name or an error message. */
export function parseNameBody(body: unknown): string | { error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { error: "Body must be an object." };
  const name = (body as Record<string, unknown>).name;
  if (typeof name !== "string") return { error: "`name` must be a string." };
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > NAME_MAX) return { error: `\`name\` must be 1–${NAME_MAX} characters.` };
  return trimmed;
}
