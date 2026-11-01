/**
 * Profile API helpers — validation and row mapping. See documentation: Modules/Training/Profile → Data model.
 */

import { json } from "./http";

export type Sex = "male" | "female";

export type BasicData = { birthDate: string; sex: Sex; heightCm: number; updatedAt: string };
export type WeightMeasurement = { date: string; weightKg: number };
export type TrainingType = { id: string; name: string };
export type BodyArea = { id: string; name: string };
export type HealthCondition = {
  id: string;
  areaId: string;
  description: string;
  source: string | null;
  /** YYYY-MM, or null. */
  date: string | null;
};

export type BasicDataRow = { birth_date: string; sex: Sex; height_cm: number; updated_at: string };
export type WeightMeasurementRow = { date: string; weight_kg: number };
export type NamedRow = { id: string; name: string };
export type HealthConditionRow = {
  id: string;
  area_id: string;
  description: string;
  source: string | null;
  date: string | null;
};

/** Columns read by the row mappers below. */
export const BASIC_COLUMNS = "birth_date, sex, height_cm, updated_at";
export const WEIGHT_COLUMNS = "date, weight_kg";
export const NAMED_COLUMNS = "id, name";
export const CONDITION_COLUMNS = "id, area_id, description, source, date";

export function rowToBasic(row: BasicDataRow): BasicData {
  return { birthDate: row.birth_date, sex: row.sex, heightCm: row.height_cm, updatedAt: row.updated_at };
}

export function rowToWeight(row: WeightMeasurementRow): WeightMeasurement {
  return { date: row.date, weightKg: row.weight_kg };
}

export function rowToCondition(row: HealthConditionRow): HealthCondition {
  return { id: row.id, areaId: row.area_id, description: row.description, source: row.source, date: row.date };
}

/** A body area that still has health conditions cannot be deleted. */
export function conflict(error: string): Response {
  return json({ error }, 409);
}

/** Training types, body areas and health conditions have random UUIDs. */
export const isId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f-]{36}$/.test(value);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const inRange = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;

/** Trimmed text of 1…max characters, or null. */
function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
}

/** A real calendar day as YYYY-MM-DD, or null. */
export function parseDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

const isMonth = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

/** Checks the body of PUT /api/profile/basic. */
export function parseBasicBody(body: unknown): Omit<BasicData, "updatedAt"> | string {
  if (!isRecord(body)) return "Body must be an object.";
  const birthDate = parseDate(body.birthDate);
  if (!birthDate || birthDate > new Date().toISOString().slice(0, 10)) return "Invalid birthDate.";
  if (body.sex !== "male" && body.sex !== "female") return "`sex` must be male or female.";
  if (!inRange(body.heightCm, 50, 250)) return "`heightCm` must be 50–250.";
  return { birthDate, sex: body.sex, heightCm: body.heightCm };
}

/** Checks the body of PUT /api/profile/weights/:date. Returns the weight or an error message. */
export function parseWeightBody(body: unknown): number | string {
  if (!isRecord(body)) return "Body must be an object.";
  return inRange(body.weightKg, 20, 300) ? body.weightKg : "`weightKg` must be 20–300.";
}

/** Checks the body of POST /api/profile/training-types and POST / PATCH /api/profile/body-areas. */
export function parseNameBody(body: unknown): string | { error: string } {
  if (!isRecord(body)) return { error: "Body must be an object." };
  return text(body.name, 100) ?? { error: "`name` must be 1–100 characters." };
}

/** Checks the body of POST / PATCH /api/profile/health-conditions. */
export function parseConditionBody(body: unknown): Omit<HealthCondition, "id"> | string {
  if (!isRecord(body)) return "Body must be an object.";
  if (!isId(body.areaId)) return "Invalid areaId.";
  const description = text(body.description, 1000);
  if (!description) return "`description` must be 1–1000 characters.";
  const source = body.source === null || body.source === undefined || body.source === "" ? null : text(body.source, 100);
  if (source === null && body.source) return "`source` must be at most 100 characters.";
  const date = body.date === null || body.date === undefined || body.date === "" ? null : body.date;
  if (date !== null && !isMonth(date)) return "`date` must be YYYY-MM.";
  return { areaId: body.areaId, description, source, date };
}
