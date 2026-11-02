import type { WeightMeasurement } from "../profile";

/**
 * Weight history — measurements grouped by month with their changes; calculated on display from the profile's
 * measurements (no own data). See documentation: Modules/Training/Profile/Weight history.
 */

export type HistoryMeasurement = WeightMeasurement & {
  /** Weight − the previous (older) measurement; null for the oldest one. */
  change: number | null;
};

export type WeightMonth = {
  /** YYYY-MM. */
  month: string;
  /** Newest first. */
  measurements: HistoryMeasurement[];
  averageKg: number;
  /** The month's last measurement − the last one before the month; null when there is none before it. */
  change: number | null;
};

const MONTHS = [
  "styczeń",
  "luty",
  "marzec",
  "kwiecień",
  "maj",
  "czerwiec",
  "lipiec",
  "sierpień",
  "wrzesień",
  "październik",
  "listopad",
  "grudzień",
];

const WEEKDAYS = ["nd", "pon", "wt", "śr", "czw", "pt", "sob"];

/** Measurements (newest first, as from the API) → months, newest first. */
export function weightMonths(weights: readonly WeightMeasurement[]): WeightMonth[] {
  const months: WeightMonth[] = [];
  weights.forEach((w, i) => {
    const older = weights[i + 1];
    const measurement = { ...w, change: older ? w.weightKg - older.weightKg : null };
    const month = w.date.slice(0, 7);
    const current = months[months.length - 1];
    if (current?.month === month) current.measurements.push(measurement);
    else months.push({ month, measurements: [measurement], averageKg: 0, change: null });
  });

  return months.map((m, i) => {
    const total = m.measurements.reduce((sum, w) => sum + w.weightKg, 0);
    const before = months[i + 1]?.measurements[0];
    return {
      ...m,
      averageKg: total / m.measurements.length,
      change: before ? m.measurements[0].weightKg - before.weightKg : null,
    };
  });
}

/** "2026-11" → "listopad 2026". */
export function monthName(month: string): string {
  const [year, number] = month.split("-").map(Number);
  return `${MONTHS[number - 1]} ${year}`;
}

/** "2026-11-02" → "pon 02.11". */
export function dayLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(year, month - 1, day).getDay();
  return `${WEEKDAYS[weekday]} ${date.slice(8, 10)}.${date.slice(5, 7)}`;
}

/** "1 pomiar", "3 pomiary", "12 pomiarów". */
export function measurementsLabel(count: number): string {
  if (count === 1) return "1 pomiar";
  const lastDigit = count % 10;
  const lastTwo = count % 100;
  return `${count} ${lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14) ? "pomiary" : "pomiarów"}`;
}
