import { WEEKDAY_NAMES, WEEKDAY_SHORT_NAMES, type RepeatRule, type RepeatType } from "../recurrence";
import "./RepeatRuleFields.css";

/**
 * Form fields of a repeat rule (repeat type and the fields of that type) — used by every form that edits a
 * repeat rule. The start date is not part of it: each form places its own start date field.
 */

/** The rule as typed in the form; number fields are kept as text until saved. */
export type RepeatRuleDraft = {
  repeatType: RepeatType;
  interval: string;
  weekdays: number[];
  monthDay: string;
  weekOfMonth: number;
  weekday: number;
};

/** The rule without its start date — what the fields produce. */
export type RepeatRuleFieldsValue = Omit<RepeatRule, "startDate">;

const REPEAT_OPTIONS: { value: RepeatType; label: string }[] = [
  { value: "days", label: "Co N dni" },
  { value: "weekly", label: "Wybrane dni tygodnia" },
  { value: "month_day", label: "Dzień miesiąca (numer)" },
  { value: "month_weekday", label: "Dzień tygodnia w miesiącu" },
];

const WEEK_OF_MONTH_OPTIONS = [
  { value: 1, label: "Pierwszy" },
  { value: 2, label: "Drugi" },
  { value: 3, label: "Trzeci" },
  { value: 4, label: "Czwarty" },
  { value: -1, label: "Ostatni" },
];

/** Integer from a number field; NaN when empty or not whole. */
const toInt = (value: string) => (/^\d+$/.test(value.trim()) ? Number(value) : NaN);

/** The draft for a form: filled from `rule` (edit), or the defaults (add: every day). */
export function repeatRuleDraft(rule?: RepeatRuleFieldsValue): RepeatRuleDraft {
  return {
    repeatType: rule?.repeatType ?? "days",
    interval: String(rule?.interval ?? 1),
    weekdays: rule?.weekdays ?? [],
    monthDay: String(rule?.monthDay ?? 1),
    weekOfMonth: rule?.weekOfMonth ?? 1,
    weekday: rule?.weekday ?? 0,
  };
}

/** The draft as a rule (fields not used by the repeat type are cleared), or the first error to show (Polish). */
export function parseRepeatRuleDraft(draft: RepeatRuleDraft): RepeatRuleFieldsValue | string {
  const base = { interval: 1, weekdays: [], monthDay: null, weekOfMonth: null, weekday: null };
  const interval = toInt(draft.interval);
  switch (draft.repeatType) {
    case "days":
      if (!(interval >= 1 && interval <= 365)) return "Liczba dni: 1–365.";
      return { ...base, repeatType: "days", interval };
    case "weekly":
      if (draft.weekdays.length === 0) return "Wybierz co najmniej jeden dzień tygodnia.";
      if (!(interval >= 1 && interval <= 52)) return "Co ile tygodni: 1–52.";
      return { ...base, repeatType: "weekly", interval, weekdays: [...draft.weekdays].sort((a, b) => a - b) };
    case "month_day": {
      const day = toInt(draft.monthDay);
      if (day >= 29 && day <= 31) {
        return "Nie każdy miesiąc ma dzień 29–31. Wybierz 1–28 albo „Dzień tygodnia w miesiącu” → Ostatni.";
      }
      if (!(day >= 1 && day <= 28)) return "Dzień miesiąca: 1–28.";
      return { ...base, repeatType: "month_day", monthDay: day };
    }
    case "month_weekday":
      return { ...base, repeatType: "month_weekday", weekOfMonth: draft.weekOfMonth, weekday: draft.weekday };
  }
}

export function RepeatRuleFields({
  draft,
  onChange,
}: {
  draft: RepeatRuleDraft;
  onChange: (draft: RepeatRuleDraft) => void;
}) {
  const set = (changes: Partial<RepeatRuleDraft>) => onChange({ ...draft, ...changes });

  function toggleWeekday(day: number) {
    set({ weekdays: draft.weekdays.includes(day) ? draft.weekdays.filter((d) => d !== day) : [...draft.weekdays, day] });
  }

  return (
    <>
      <fieldset className="repeat-field">
        <legend>Powtarzanie</legend>
        {REPEAT_OPTIONS.map((option) => (
          <label key={option.value} className="repeat-choice">
            <input
              type="radio"
              name="repeatType"
              checked={draft.repeatType === option.value}
              onChange={() => set({ repeatType: option.value })}
            />
            {option.label}
          </label>
        ))}
      </fieldset>

      {draft.repeatType === "days" && (
        <label className="repeat-field">
          <span>Co ile dni</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            value={draft.interval}
            onChange={(e) => set({ interval: e.target.value })}
          />
        </label>
      )}

      {draft.repeatType === "weekly" && (
        <>
          <fieldset className="repeat-field">
            <legend>Dni tygodnia</legend>
            <div className="repeat-weekdays">
              {WEEKDAY_SHORT_NAMES.map((name, day) => (
                <label key={day} className={`repeat-weekday${draft.weekdays.includes(day) ? " is-on" : ""}`}>
                  <input type="checkbox" checked={draft.weekdays.includes(day)} onChange={() => toggleWeekday(day)} />
                  {name}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="repeat-field">
            <span>Co ile tygodni</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={52}
              value={draft.interval}
              onChange={(e) => set({ interval: e.target.value })}
            />
          </label>
        </>
      )}

      {draft.repeatType === "month_day" && (
        <label className="repeat-field">
          <span>Dzień miesiąca</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            value={draft.monthDay}
            onChange={(e) => set({ monthDay: e.target.value })}
          />
        </label>
      )}

      {draft.repeatType === "month_weekday" && (
        <div className="repeat-field-row">
          <label className="repeat-field">
            <span>Który</span>
            <select value={draft.weekOfMonth} onChange={(e) => set({ weekOfMonth: Number(e.target.value) })}>
              {WEEK_OF_MONTH_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="repeat-field">
            <span>Dzień tygodnia</span>
            <select value={draft.weekday} onChange={(e) => set({ weekday: Number(e.target.value) })}>
              {WEEKDAY_NAMES.map((name, day) => (
                <option key={day} value={day}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </>
  );
}
