import { isInt, isRecord } from "./validation";

/**
 * Repeat rules — shared by endpoints whose items repeat on a schedule (tasks, habit goals).
 * Stored in the columns repeat_type, interval, weekdays, month_day, week_of_month, weekday; the start date is
 * stored and checked by each endpoint itself.
 */

export type RepeatType = "days" | "weekly" | "month_day" | "month_weekday";

/** A repeat rule without its start date. */
export type RepeatRuleFields = {
  repeatType: RepeatType;
  interval: number;
  weekdays: number[];
  monthDay: number | null;
  weekOfMonth: number | null;
  weekday: number | null;
};

export type RepeatRuleRow = {
  repeat_type: RepeatType;
  interval: number;
  weekdays: string | null;
  month_day: number | null;
  week_of_month: number | null;
  weekday: number | null;
};

export function rowToRepeatRule(row: RepeatRuleRow): RepeatRuleFields {
  return {
    repeatType: row.repeat_type,
    interval: row.interval,
    weekdays: row.weekdays ? row.weekdays.split(",").map(Number) : [],
    monthDay: row.month_day,
    weekOfMonth: row.week_of_month,
    weekday: row.weekday,
  };
}

/** Checks the rule fields of a request body. Fields not used by the repeat type are cleared. Returns the rule or an error. */
export function parseRepeatRule(body: unknown): RepeatRuleFields | string {
  if (!isRecord(body)) return "Body must be an object.";
  const base = { interval: 1, weekdays: [], monthDay: null, weekOfMonth: null, weekday: null };
  switch (body.repeatType) {
    case "days":
      if (!isInt(body.interval, 1, 365)) return "`interval` must be 1–365 days.";
      return { ...base, repeatType: "days", interval: body.interval };
    case "weekly": {
      if (!isInt(body.interval, 1, 52)) return "`interval` must be 1–52 weeks.";
      const days = body.weekdays;
      if (!Array.isArray(days) || days.length === 0 || !days.every((d) => isInt(d, 0, 6))) {
        return "`weekdays` must be a non-empty list of days 0–6.";
      }
      const weekdays = [...new Set(days as number[])].sort((a, b) => a - b);
      return { ...base, repeatType: "weekly", interval: body.interval, weekdays };
    }
    case "month_day":
      if (!isInt(body.monthDay, 1, 28)) return "`monthDay` must be 1–28 (not every month has days 29–31).";
      return { ...base, repeatType: "month_day", monthDay: body.monthDay };
    case "month_weekday":
      if (!(isInt(body.weekOfMonth, 1, 4) || body.weekOfMonth === -1)) return "`weekOfMonth` must be 1–4 or -1 (last).";
      if (!isInt(body.weekday, 0, 6)) return "`weekday` must be 0–6.";
      return { ...base, repeatType: "month_weekday", weekOfMonth: body.weekOfMonth, weekday: body.weekday };
    default:
      return "`repeatType` must be days, weekly, month_day or month_weekday.";
  }
}
