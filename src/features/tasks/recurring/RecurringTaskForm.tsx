import { useState, type FormEvent } from "react";
import { toIsoDate } from "../../../shared/dates";
import {
  parseRepeatRuleDraft,
  RepeatRuleFields,
  repeatRuleDraft,
  type RepeatRuleDraft,
} from "../../../shared/ui/RepeatRuleFields";
import type { NewTask } from "../tasks";
import "../Tasks.css";

const TITLE_ERROR = "Wpisz nazwę zadania.";

/** The form as a new task, or the first error to show (Polish). */
function validate(form: { title: string; startDate: string; rule: RepeatRuleDraft }): NewTask | string {
  const title = form.title.trim();
  if (!title) return TITLE_ERROR;
  if (!form.startDate) return "Wybierz datę startu.";
  const rule = parseRepeatRuleDraft(form.rule);
  if (typeof rule === "string") return rule;
  return { title, startDate: form.startDate, ...rule };
}

/**
 * Form of a recurring task — used to add and to edit. `initial` fills the fields (edit); `onSave` saves and leaves
 * the screen, or throws an error that the form shows.
 */
export function RecurringTaskForm({
  initial,
  onSave,
}: {
  initial?: NewTask;
  onSave: (task: NewTask) => Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [startDate, setStartDate] = useState(() => initial?.startDate ?? toIsoDate(new Date()));
  const [rule, setRule] = useState<RepeatRuleDraft>(() => repeatRuleDraft(initial));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const result = validate({ title, startDate, rule });
  const error = typeof result === "string" ? result : null;
  // The empty title is not shown as an error before the user types anything; the save button stays disabled.
  const shownError = error === TITLE_ERROR && title === "" ? null : error;

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

  return (
    <form className="tasks-form" onSubmit={submit}>
      <label className="tasks-field">
        <span>Nazwa</span>
        <input type="text" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </label>

      <label className="tasks-field">
        <span>Data startu</span>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </label>

      <RepeatRuleFields draft={rule} onChange={setRule} />

      {shownError && (
        <p className="tasks-status is-error" role="alert">
          {shownError}
        </p>
      )}
      {saveError && (
        <p className="tasks-status is-error" role="alert">
          Nie udało się zapisać. {saveError}
        </p>
      )}

      <button type="submit" className="tasks-button is-primary" disabled={error !== null || saving}>
        {saving ? "Zapisywanie…" : "Zapisz"}
      </button>
    </form>
  );
}
