import type { MealPlanItem } from "../meal-plans/meal-plans";

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

export const DAYS_IN_WEEK = 7;

const DAY_NAMES = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Ndz"];
const MONTH_NAMES = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];

// ---- dates (local time; a week is identified by its Monday) ----

function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromIsoDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Date of a day of the week (0 = Monday). */
export function dayDate(weekStart: string, day: number): Date {
  const date = fromIsoDate(weekStart);
  date.setDate(date.getDate() + day);
  return date;
}

/** Monday of the week that contains `date`, as YYYY-MM-DD. */
export function weekStartOf(date: Date): string {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return toIsoDate(monday);
}

export function currentWeekStart(): string {
  return weekStartOf(new Date());
}

export function shiftWeek(weekStart: string, weeks: number): string {
  return toIsoDate(dayDate(weekStart, weeks * DAYS_IN_WEEK));
}

/** Today's day of the week (0–6) when the week is the current one, otherwise null. */
export function todayIn(weekStart: string): number | null {
  const today = new Date();
  return weekStartOf(today) === weekStart ? (today.getDay() + 6) % 7 : null;
}

/** E.g. "2–8 lis 2026", "30 lis – 6 gru 2026", "29 gru 2025 – 4 sty 2026". */
export function weekLabel(weekStart: string): string {
  const first = dayDate(weekStart, 0);
  const last = dayDate(weekStart, DAYS_IN_WEEK - 1);
  const month = (d: Date) => MONTH_NAMES[d.getMonth()];
  if (first.getFullYear() !== last.getFullYear()) {
    return `${first.getDate()} ${month(first)} ${first.getFullYear()} – ${last.getDate()} ${month(last)} ${last.getFullYear()}`;
  }
  if (first.getMonth() !== last.getMonth()) {
    return `${first.getDate()} ${month(first)} – ${last.getDate()} ${month(last)} ${last.getFullYear()}`;
  }
  return `${first.getDate()}–${last.getDate()} ${month(last)} ${last.getFullYear()}`;
}

/** E.g. "Pon 2.11". */
export function dayLabel(weekStart: string, day: number): string {
  const date = dayDate(weekStart, day);
  return `${DAY_NAMES[day]} ${date.getDate()}.${date.getMonth() + 1}`;
}

// ---- API ----

async function request(url: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    // Also an expired Cloudflare Access login: the redirect to the login page cannot be followed by fetch.
    throw new Error("Brak połączenia z serwerem. Sprawdź internet albo odśwież stronę.");
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(`Błąd serwera (${response.status})${body?.error ? `: ${body.error}` : ""}`);
  }
  return response;
}

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
