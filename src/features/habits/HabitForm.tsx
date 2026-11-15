import { useState, type FormEvent } from "react";
import { toIsoDate } from "../../shared/dates";
import {
  parseRepeatRuleDraft,
  RepeatRuleFields,
  repeatRuleDraft,
  type RepeatRuleDraft,
} from "../../shared/ui/RepeatRuleFields";
import type { Habit, NewHabit, Period } from "./habits";
import { formatAmount, parseAmount } from "./periods";
import "./Habits.css";

/** Form of a goal or a limit — used to add and to edit, by Goals and Limits. */

type Kind = "goal" | "limit";

const NAME_ERROR = "Wpisz nazwę.";
const MAX_BUTTONS = 8;

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "day", label: "Dzień" },
  { value: "week", label: "Tydzień (pn–nd)" },
  { value: "month", label: "Miesiąc" },
];

type Form = {
  name: string;
  startDate: string;
  schedule: "rule" | "period";
  rule: RepeatRuleDraft;
  period: Period;
  target: string;
  unit: string;
  buttons: string;
};

/** The form as a habit, or the first error to show (Polish). */
function validate(kind: Kind, form: Form, today: string): NewHabit | string {
  const name = form.name.trim();
  if (!name) return NAME_ERROR;
  if (!form.startDate) return "Wybierz datę startu.";
  if (form.startDate > today) return "Data startu nie może być w przyszłości.";

  const target = parseAmount(form.target);
  if (kind === "goal" ? !(target > 0) : !(target >= 0)) {
    return kind === "goal" ? "Cel: liczba większa od 0." : "Limit: liczba 0 lub większa.";
  }
  if (target > 1_000_000) return "Liczba za duża (najwyżej 1 000 000).";
  const unit = form.unit.trim();
  if (!unit || unit.length > 20) return "Jednostka: 1–20 znaków.";

  const parts = form.buttons.split(/[\s;]+/).filter(Boolean);
  const values = parts.map(parseAmount);
  if (values.length === 0) return "Podaj co najmniej jedną wartość przycisku.";
  if (values.some((v) => !(v > 0 && v <= 1_000_000))) return "Wartości przycisków: liczby większe od 0, oddzielone spacją.";
  const buttonValues = [...new Set(values)].sort((a, b) => a - b);
  if (buttonValues.length > MAX_BUTTONS) return `Najwyżej ${MAX_BUTTONS} przycisków.`;

  const base: NewHabit = {
    kind,
    name,
    startDate: form.startDate,
    schedule: null,
    rule: null,
    period: null,
    target,
    unit,
    buttonValues,
  };
  if (kind === "limit") return { ...base, period: form.period };
  if (form.schedule === "period") return { ...base, schedule: "period", period: form.period };
  const rule = parseRepeatRuleDraft(form.rule);
  if (typeof rule === "string") return rule;
  return { ...base, schedule: "rule", rule };
}

/**
 * `initial` fills the fields (edit); `onSave` saves and leaves the screen, or throws an error that the form shows.
 */
export function HabitForm({
  kind,
  initial,
  onSave,
}: {
  kind: Kind;
  initial?: Habit;
  onSave: (habit: NewHabit) => Promise<void>;
}) {
  const today = toIsoDate(new Date());
  const [form, setForm] = useState<Form>(() => ({
    name: initial?.name ?? "",
    startDate: initial?.startDate ?? today,
    schedule: initial?.schedule ?? "rule",
    rule: repeatRuleDraft(initial?.rule ?? undefined),
    period: initial?.period ?? "day",
    target: initial?.target != null ? formatAmount(initial.target) : "",
    unit: initial?.unit ?? "",
    buttons: initial ? initial.buttonValues.map(formatAmount).join(" ") : "1",
  }));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const set = (changes: Partial<Form>) => setForm((prev) => ({ ...prev, ...changes }));

  const result = validate(kind, form, today);
  const error = typeof result === "string" ? result : null;
  // Errors are not shown before the user types a name; the save button stays disabled.
  const shownError = form.name === "" && !initial ? null : error;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (typeof result === "string") return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(result);
    } catch (e) {
      setSaveError((e as Error).message);
      setSaving(false);
    }
  }

  const periodSelect = (
    <label className="habits-field">
      <span>Okres</span>
      <select value={form.period} onChange={(e) => set({ period: e.target.value as Period })}>
        {PERIOD_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <form className="habits-form" onSubmit={submit}>
      <label className="habits-field">
        <span>Nazwa</span>
        <input type="text" value={form.name} maxLength={200} onChange={(e) => set({ name: e.target.value })} autoFocus />
      </label>

      <label className="habits-field">
        <span>Data startu</span>
        <input type="date" value={form.startDate} max={today} onChange={(e) => set({ startDate: e.target.value })} />
      </label>

      {kind === "goal" && (
        <fieldset className="habits-field">
          <legend>Kiedy</legend>
          <label className="habits-choice">
            <input type="radio" name="schedule" checked={form.schedule === "rule"} onChange={() => set({ schedule: "rule" })} />
            W wybrane dni — cel na każdy dzień
          </label>
          <label className="habits-choice">
            <input type="radio" name="schedule" checked={form.schedule === "period"} onChange={() => set({ schedule: "period" })} />
            W okresie — suma w dniu, tygodniu lub miesiącu
          </label>
        </fieldset>
      )}

      {kind === "goal" && form.schedule === "rule" && <RepeatRuleFields draft={form.rule} onChange={(rule) => set({ rule })} />}
      {(kind === "limit" || form.schedule === "period") && periodSelect}

      <div className="habits-field-row">
        <label className="habits-field">
          <span>{kind === "goal" ? "Cel (co najmniej)" : "Limit (co najwyżej)"}</span>
          <input type="text" inputMode="decimal" value={form.target} onChange={(e) => set({ target: e.target.value })} />
        </label>
        <label className="habits-field">
          <span>Jednostka</span>
          <input type="text" value={form.unit} maxLength={20} placeholder="np. ml, razy" onChange={(e) => set({ unit: e.target.value })} />
        </label>
      </div>

      <label className="habits-field">
        <span>Przyciski (wartości oddzielone spacją)</span>
        <input type="text" inputMode="decimal" value={form.buttons} placeholder="np. 100 250 500" onChange={(e) => set({ buttons: e.target.value })} />
      </label>

      {shownError && (
        <p className="habits-status is-error" role="alert">
          {shownError}
        </p>
      )}
      {saveError && (
        <p className="habits-status is-error" role="alert">
          Nie udało się zapisać. {saveError}
        </p>
      )}

      <button type="submit" className="habits-button is-primary" disabled={error !== null || saving}>
        {saving ? "Zapisywanie…" : "Zapisz"}
      </button>
    </form>
  );
}
