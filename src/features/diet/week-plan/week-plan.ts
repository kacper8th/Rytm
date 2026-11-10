import { request } from "../../../shared/api";
import { getMealPlanVariants, planName, type MealPlanItem, type PlanNames } from "../meal-plans/meal-plans";

/**
 * Week plan — user data saved on the server (Cloudflare D1 via /api/week-plans).
 * The only way screens get or change week plans. See documentation: Modules/Diet/Week plan.
 */

/** Where a day was copied from — display only. */
export type WeekPlanSource = { variantId: string; planNumber: number };

export type WeekPlanDay = {
  /** 0 = Monday … 6 = Sunday. */
  day: number;
  /** Snapshot of the chosen meal plan's items. */
  items: MealPlanItem[];
  source: WeekPlanSource | null;
  updatedAt: string;
};

export type WeekPlan = {
  /** Monday as YYYY-MM-DD. */
  weekStart: string;
  /** Only days with a plan, sorted by day. */
  days: WeekPlanDay[];
};

/** A week with saved days — for picking a week to copy from. */
export type WeekSummary = { weekStart: string; days: number };

// ---- source of a day ----

/** The variant a day was copied from; undefined when there is no source or the variant no longer exists. */
export function variantOf(source: WeekPlanSource | null) {
  return source ? getMealPlanVariants().find((v) => v.id === source.variantId) : undefined;
}

/** The current name of the source plan (not saved with the day, so a rename shows everywhere); null without a source. */
export function sourceLabel(source: WeekPlanSource | null, names: PlanNames | null): string | null {
  if (!source) return null;
  return `Jadłospis: ${planName(names, source.variantId, source.planNumber)}`;
}

// ---- API ----

export async function getWeekPlan(weekStart: string): Promise<WeekPlan> {
  const response = await request(`/api/week-plans/${weekStart}`);
  return (await response.json()) as WeekPlan;
}

/** Saves the day (replaces the previous one) and returns it as saved. */
export async function saveDay(
  weekStart: string,
  day: number,
  items: readonly MealPlanItem[],
  source: WeekPlanSource | null,
): Promise<WeekPlanDay> {
  const response = await request(`/api/week-plans/${weekStart}/days/${day}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items, source }),
  });
  return (await response.json()) as WeekPlanDay;
}

export async function clearDay(weekStart: string, day: number): Promise<void> {
  await request(`/api/week-plans/${weekStart}/days/${day}`, { method: "DELETE" });
}

/** Weeks that have saved days, newest first. */
export async function listWeeks(): Promise<WeekSummary[]> {
  const response = await request("/api/week-plans");
  return ((await response.json()) as { weeks: WeekSummary[] }).weeks;
}

export async function clearWeek(weekStart: string): Promise<void> {
  await request(`/api/week-plans/${weekStart}`, { method: "DELETE" });
}

/** Replaces the whole week with a copy of the `from` week and returns it as saved. */
export async function copyWeek(weekStart: string, from: string): Promise<WeekPlan> {
  const response = await request(`/api/week-plans/${weekStart}/copy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from }),
  });
  return (await response.json()) as WeekPlan;
}
