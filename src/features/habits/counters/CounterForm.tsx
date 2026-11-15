import { useState, type FormEvent } from "react";
import { toIsoDate } from "../../../shared/dates";
import type { Habit, NewHabit } from "../habits";
import "../Habits.css";

const NAME_ERROR = "Wpisz nazwę.";

/**
 * Form of a counter — used to add and to edit. Add: the start date of the first run; edit: the start date of the
 * current run. `onSave` saves and leaves the screen, or throws an error that the form shows.
 */
export function CounterForm({ initial, onSave }: { initial?: Habit; onSave: (counter: NewHabit) => Promise<void> }) {
  const today = toIsoDate(new Date());
  const [name, setName] = useState(initial?.name ?? "");
  const [startDate, setStartDate] = useState(initial?.runStart ?? initial?.startDate ?? today);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const trimmed = name.trim();
  const error = !trimmed ? NAME_ERROR : !startDate ? "Wybierz datę startu." : null;
  const shownError = error === NAME_ERROR && name === "" ? null : error;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (error) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave({
        kind: "counter",
        name: trimmed,
        startDate,
        schedule: null,
        rule: null,
        period: null,
        target: null,
        unit: null,
        buttonValues: [],
      });
    } catch (e) {
      setSaveError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <form className="habits-form" onSubmit={submit}>
      <label className="habits-field">
        <span>Nazwa</span>
        <input type="text" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>

      <label className="habits-field">
        <span>{initial ? "Start bieżącej serii" : "Data startu"}</span>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
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
