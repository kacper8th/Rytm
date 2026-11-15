import { request } from "../../shared/api";
import type { RepeatRule } from "../../shared/recurrence";

/**
 * Habits — user data saved on the server (Cloudflare D1 via /api/habits).
 * The only way screens get or change habits, entries and counter runs. See documentation: Modules/Habits.
 */

export type HabitKind = "goal" | "limit" | "counter";
export type Period = "day" | "week" | "month";

/** A repeat rule without its start date — the habit's start date completes it (see goalRule). */
export type HabitRule = Omit<RepeatRule, "startDate">;

export type Habit = {
  id: string;
  kind: HabitKind;
  name: string;
  /** YYYY-MM-DD — goal / limit: no entries before it; counter: start of the first run. */
  startDate: string;
  /** Goal: by repeat rule or by period; null for limits and counters. */
  schedule: "rule" | "period" | null;
  /** Goal with schedule "rule". */
  rule: HabitRule | null;
  /** Goal with schedule "period", limit. */
  period: Period | null;
  /** Goal: at least, per day of the rule or per period; limit: at most per period. */
  target: number | null;
  unit: string | null;
  /** Amounts of the quick buttons, ascending. */
  buttonValues: number[];
  /** Counter: start date of the current run. */
  runStart: string | null;
  /** Counter: number of runs (more than 1 = the last restart can be undone). */
  runCount: number;
  createdAt: string;
};

export type NewHabit = Omit<Habit, "id" | "runStart" | "runCount" | "createdAt">;

/** One click on a quick button or one amount typed by hand. */
export type Entry = { id: string; habitId: string; date: string; amount: number; createdAt: string };

/**
 * Settings of the Habits card on Home, shared by all devices: the range of days it covers (today, today + N-1 days,
 * this week Mon–Sun, this calendar month) and whether it shows all habits regardless of the range.
 */
export type HomeRange = "day" | "days" | "week" | "month";
export type Settings = { homeRange: HomeRange; homeDays: number; homeShowAll: boolean };

/** A counter run; the current run has no end date. */
export type Run = { id: string; habitId: string; startDate: string; endDate: string | null };

/** The repeat rule of a goal with schedule "rule", with the goal's start date. */
export function goalRule(habit: Habit): RepeatRule | null {
  return habit.rule ? { ...habit.rule, startDate: habit.startDate } : null;
}

const habitUrl = (id: string) => `/api/habits/${encodeURIComponent(id)}`;
const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** All goals, limits and counters, by name. */
export async function getHabits(): Promise<Habit[]> {
  const response = await request("/api/habits");
  return (await response.json()) as Habit[];
}

export async function addHabit(habit: NewHabit): Promise<Habit> {
  const response = await request("/api/habits", json("POST", habit));
  return (await response.json()) as Habit;
}

/** Goal / limit: replaces all fields, entries are kept. Counter: name and the start of the current run. */
export async function updateHabit(id: string, habit: NewHabit): Promise<Habit> {
  const response = await request(habitUrl(id), json("PUT", habit));
  return (await response.json()) as Habit;
}

/** Deletes the habit together with all its entries and runs. */
export async function deleteHabit(id: string): Promise<void> {
  await request(habitUrl(id), { method: "DELETE" });
}

/** Entries of all goals and limits from `from` to `to` (both included), by date and then in the order added. */
export async function getEntries(from: string, to: string): Promise<Entry[]> {
  const response = await request(`/api/habits/entries?from=${from}&to=${to}`);
  return (await response.json()) as Entry[];
}

export async function addEntry(habitId: string, date: string, amount: number): Promise<Entry> {
  const response = await request(`${habitUrl(habitId)}/entries`, json("POST", { date, amount }));
  return (await response.json()) as Entry;
}

export async function deleteEntry(entryId: string): Promise<void> {
  await request(`/api/habits/entries/${encodeURIComponent(entryId)}`, { method: "DELETE" });
}

/** Ends the counter's current run on `date` and starts a new run on it. Returns the new run. */
export async function restartCounter(habitId: string, date: string): Promise<Run> {
  const response = await request(`${habitUrl(habitId)}/restart`, json("POST", { date }));
  return (await response.json()) as Run;
}

/** Undoes the last restart: the current run is deleted and the previous one continues. */
export async function undoRestart(habitId: string): Promise<void> {
  await request(`${habitUrl(habitId)}/restart`, { method: "DELETE" });
}

export async function getSettings(): Promise<Settings> {
  const response = await request("/api/habits/settings");
  return (await response.json()) as Settings;
}

export async function saveSettings(settings: Settings): Promise<Settings> {
  const response = await request("/api/habits/settings", json("PUT", settings));
  return (await response.json()) as Settings;
}

/** All runs of a counter, the newest first. */
export async function getRuns(habitId: string): Promise<Run[]> {
  const response = await request(`${habitUrl(habitId)}/runs`);
  return (await response.json()) as Run[];
}
