import { request } from "../../../shared/api";

/**
 * Profile — the owner's basic data, weight, training types and health conditions; user data saved on the server
 * (Cloudflare D1 via /api/profile). The only way screens get or change the profile.
 * See documentation: Modules/Training/Profile.
 */

export type Sex = "male" | "female";

export const SEX_LABELS: Record<Sex, string> = { male: "mężczyzna", female: "kobieta" };

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

export type Profile = {
  /** null until the basic data is saved for the first time. */
  basic: BasicData | null;
  /** Newest first. */
  weights: WeightMeasurement[];
  trainingTypes: TrainingType[];
  /** In the order they were added. */
  bodyAreas: BodyArea[];
  healthConditions: HealthCondition[];
};

export type ConditionInput = Omit<HealthCondition, "id">;

// ---- dates ----

const pad = (n: number) => String(n).padStart(2, "0");

/** Today on this device as YYYY-MM-DD. */
export function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Full years between the date of birth and today. */
export function ageFrom(birthDate: string): number {
  const [year, month, day] = birthDate.split("-").map(Number);
  const now = new Date();
  const hadBirthday = now.getMonth() + 1 > month || (now.getMonth() + 1 === month && now.getDate() >= day);
  return now.getFullYear() - year - (hadBirthday ? 0 : 1);
}

/** "2026-11-01" → "01.11.2026"; an ISO timestamp is cut to its day. */
export function dateLabel(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}.${month}.${year}`;
}

/** "2026-10" → "10.2026". */
export function monthLabel(value: string): string {
  const [year, month] = value.split("-");
  return `${month}.${year}`;
}

export const number = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 });

// ---- API ----

async function send<T>(url: string, method: string, body: unknown): Promise<T> {
  const response = await request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await response.json()) as T;
}

async function remove(url: string): Promise<void> {
  await request(url, { method: "DELETE" });
}

export async function getProfile(): Promise<Profile> {
  const response = await request("/api/profile");
  return (await response.json()) as Profile;
}

export function saveBasicData(basic: Omit<BasicData, "updatedAt">): Promise<BasicData> {
  return send("/api/profile/basic", "PUT", basic);
}

/** Saves the measurement of a day; replaces an earlier one of the same day. */
export function saveWeight(date: string, weightKg: number): Promise<WeightMeasurement> {
  return send(`/api/profile/weights/${date}`, "PUT", { weightKg });
}

export function deleteWeight(date: string): Promise<void> {
  return remove(`/api/profile/weights/${date}`);
}

export function addTrainingType(name: string): Promise<TrainingType> {
  return send("/api/profile/training-types", "POST", { name });
}

export function deleteTrainingType(id: string): Promise<void> {
  return remove(`/api/profile/training-types/${id}`);
}

export function addBodyArea(name: string): Promise<BodyArea> {
  return send("/api/profile/body-areas", "POST", { name });
}

export function renameBodyArea(id: string, name: string): Promise<BodyArea> {
  return send(`/api/profile/body-areas/${id}`, "PATCH", { name });
}

/** Refused by the server while the area has health conditions. */
export function deleteBodyArea(id: string): Promise<void> {
  return remove(`/api/profile/body-areas/${id}`);
}

export function addHealthCondition(condition: ConditionInput): Promise<HealthCondition> {
  return send("/api/profile/health-conditions", "POST", condition);
}

/** Replaces a condition; a different areaId moves it to that area. */
export function saveHealthCondition(id: string, condition: ConditionInput): Promise<HealthCondition> {
  return send(`/api/profile/health-conditions/${id}`, "PATCH", condition);
}

export function deleteHealthCondition(id: string): Promise<void> {
  return remove(`/api/profile/health-conditions/${id}`);
}
