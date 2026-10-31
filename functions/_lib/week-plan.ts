/**
 * Week plan API helpers — validation and row mapping. See documentation: Modules/Diet/Week plan → Data.
 * The server checks only the shape of a day; whether meal / product ids exist is checked on display.
 */

export interface Env {
  DB: D1Database;
}

/** Must match MEAL_TYPES in src/features/diet/meal-plans/meal-plans.ts. */
const MEAL_TYPE_MAX: Record<string, number> = {
  "śniadanie": 1,
  obiad: 1,
  podwieczorek: 1,
  "przekąska": 2,
  kolacja: 1,
};

/** Must match GAIN_MACROS in src/features/diet/meals/meals.ts. */
const GAIN_MACROS = ["protein", "carbs", "fat"];

export type WeekPlanItem =
  | { mealType: string; kind: "meal"; mealId: string; steps: Record<string, number> }
  | { mealType: string; kind: "product"; productId: string; grams: number };

export type WeekPlanSource = { variantId: string; planNumber: number };

export type WeekPlanDay = {
  day: number;
  items: WeekPlanItem[];
  source: WeekPlanSource | null;
  updatedAt: string;
};

export type WeekPlanDayRow = {
  day: number;
  items: string;
  source: string | null;
  updated_at: string;
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export function badRequest(error: string): Response {
  return json({ error }, 400);
}

/** A Monday as YYYY-MM-DD, or null. */
export function parseWeekStart(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date.getUTCDay() === 1 ? value : null;
}

/** 0 = Monday … 6 = Sunday, or null. */
export function parseDay(value: unknown): number | null {
  if (typeof value !== "string" || !/^[0-6]$/.test(value)) return null;
  return Number(value);
}

export function rowToDay(row: WeekPlanDayRow): WeekPlanDay {
  return {
    day: row.day,
    items: JSON.parse(row.items) as WeekPlanItem[],
    source: row.source === null ? null : (JSON.parse(row.source) as WeekPlanSource),
    updatedAt: row.updated_at,
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 200;

/** Checks the body of PUT …/days/:day. Returns the clean day or an error message. */
export function parseDayBody(body: unknown): { items: WeekPlanItem[]; source: WeekPlanSource | null } | string {
  if (!isRecord(body)) return "Body must be an object.";
  const { items, source } = body;
  if (!Array.isArray(items) || items.length === 0) return "`items` must be a non-empty array.";
  if (items.length > 20) return "Too many items (max 20).";

  const counts: Record<string, number> = {};
  const clean: WeekPlanItem[] = [];
  for (const [i, item] of items.entries()) {
    if (!isRecord(item)) return `Item ${i}: must be an object.`;
    const { mealType, kind } = item;
    if (typeof mealType !== "string" || !(mealType in MEAL_TYPE_MAX)) return `Item ${i}: unknown mealType.`;
    counts[mealType] = (counts[mealType] ?? 0) + 1;
    if (counts[mealType] > MEAL_TYPE_MAX[mealType]) return `Item ${i}: too many "${mealType}".`;

    if (kind === "meal") {
      if (!isId(item.mealId)) return `Item ${i}: missing mealId.`;
      if (!isRecord(item.steps)) return `Item ${i}: steps must be an object.`;
      const steps: Record<string, number> = {};
      for (const [macro, n] of Object.entries(item.steps)) {
        if (!GAIN_MACROS.includes(macro)) return `Item ${i}: unknown gain macro "${macro}".`;
        if (!Number.isInteger(n) || (n as number) < 0) return `Item ${i}: steps must be whole numbers ≥ 0.`;
        if ((n as number) > 0) steps[macro] = n as number;
      }
      clean.push({ mealType, kind, mealId: item.mealId, steps });
    } else if (kind === "product") {
      if (!isId(item.productId)) return `Item ${i}: missing productId.`;
      if (typeof item.grams !== "number" || !(item.grams > 0) || item.grams > 5000) return `Item ${i}: grams must be > 0.`;
      clean.push({ mealType, kind, productId: item.productId, grams: item.grams });
    } else {
      return `Item ${i}: kind must be "meal" or "product".`;
    }
  }

  if (source === undefined || source === null) return { items: clean, source: null };
  if (!isRecord(source) || !isId(source.variantId) || !Number.isInteger(source.planNumber) || (source.planNumber as number) <= 0) {
    return "`source` must be {variantId, planNumber} or null.";
  }
  return { items: clean, source: { variantId: source.variantId, planNumber: source.planNumber as number } };
}
