import { useState, type FormEvent } from "react";
import { toIsoDate } from "../../shared/dates";
import { WEEKDAY_NAMES, WEEKDAY_SHORT_NAMES } from "./recurrence";
import type { NewTask, RepeatType } from "./tasks";
import "./Tasks.css";

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

const TITLE_ERROR = "Wpisz nazwę zadania.";

/** Integer from a number field; NaN when empty or not whole. */
const toInt = (value: string) => (/^\d+$/.test(value.trim()) ? Number(value) : NaN);

/** The form as a new task, or the first error to show (Polish). */
function validate(form: {
  title: string;
  startDate: string;
  repeatType: RepeatType;
  interval: string;
  weekdays: number[];
  monthDay: string;
  weekOfMonth: number;
  weekday: number;
}): NewTask | string {
  const title = form.title.trim();
  if (!title) return TITLE_ERROR;
  if (!form.startDate) return "Wybierz datę startu.";
  const base = {
    title,
    startDate: form.startDate,
    interval: 1,
    weekdays: [],
    monthDay: null,
    weekOfMonth: null,
    weekday: null,
  };
  const interval = toInt(form.interval);
  switch (form.repeatType) {
    case "days":
      if (!(interval >= 1 && interval <= 365)) return "Liczba dni: 1–365.";
      return { ...base, repeatType: "days", interval };
    case "weekly":
      if (form.weekdays.length === 0) return "Wybierz co najmniej jeden dzień tygodnia.";
      if (!(interval >= 1 && interval <= 52)) return "Co ile tygodni: 1–52.";
      return {
        ...base,
        repeatType: "weekly",
        interval,
        weekdays: [...form.weekdays].sort((a, b) => a - b),
      };
    case "month_day": {
      const day = toInt(form.monthDay);
      if (day >= 29 && day <= 31) {
        return "Nie każdy miesiąc ma dzień 29–31. Wybierz 1–28 albo „Dzień tygodnia w miesiącu” → Ostatni.";
      }
      if (!(day >= 1 && day <= 28)) return "Dzień miesiąca: 1–28.";
      return { ...base, repeatType: "month_day", monthDay: day };
    }
    case "month_weekday":
      return {
        ...base,
        repeatType: "month_weekday",
        weekOfMonth: form.weekOfMonth,
        weekday: form.weekday,
      };
  }
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
  const [repeatType, setRepeatType] = useState<RepeatType>(initial?.repeatType ?? "days");
  const [intervalText, setIntervalText] = useState(String(initial?.interval ?? 1));
  const [weekdays, setWeekdays] = useState<number[]>(initial?.weekdays ?? []);
  const [monthDay, setMonthDay] = useState(String(initial?.monthDay ?? 1));
  const [weekOfMonth, setWeekOfMonth] = useState(initial?.weekOfMonth ?? 1);
  const [weekday, setWeekday] = useState(initial?.weekday ?? 0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const result = validate({
    title,
    startDate,
    repeatType,
    interval: intervalText,
    weekdays,
    monthDay,
    weekOfMonth,
    weekday,
  });
  const error = typeof result === "string" ? result : null;
  // The empty title is not shown as an error before the user types anything; the save button stays disabled.
  const shownError = error === TITLE_ERROR && title === "" ? null : error;

  function toggleWeekday(day: number) {
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

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

      <fieldset className="tasks-field">
        <legend>Powtarzanie</legend>
        {REPEAT_OPTIONS.map((option) => (
          <label key={option.value} className="tasks-choice">
            <input
              type="radio"
              name="repeatType"
              checked={repeatType === option.value}
              onChange={() => setRepeatType(option.value)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>

      {repeatType === "days" && (
        <label className="tasks-field">
          <span>Co ile dni</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            value={intervalText}
            onChange={(e) => setIntervalText(e.target.value)}
          />
        </label>
      )}

      {repeatType === "weekly" && (
        <>
          <fieldset className="tasks-field">
            <legend>Dni tygodnia</legend>
            <div className="tasks-weekdays">
              {WEEKDAY_SHORT_NAMES.map((name, day) => (
                <label key={day} className={`tasks-weekday${weekdays.includes(day) ? " is-on" : ""}`}>
                  <input type="checkbox" checked={weekdays.includes(day)} onChange={() => toggleWeekday(day)} />
                  {name}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="tasks-field">
            <span>Co ile tygodni</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={52}
              value={intervalText}
              onChange={(e) => setIntervalText(e.target.value)}
            />
          </label>
        </>
      )}

      {repeatType === "month_day" && (
        <label className="tasks-field">
          <span>Dzień miesiąca</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            value={monthDay}
            onChange={(e) => setMonthDay(e.target.value)}
          />
        </label>
      )}

      {repeatType === "month_weekday" && (
        <div className="tasks-field-row">
          <label className="tasks-field">
            <span>Który</span>
            <select value={weekOfMonth} onChange={(e) => setWeekOfMonth(Number(e.target.value))}>
              {WEEK_OF_MONTH_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="tasks-field">
            <span>Dzień tygodnia</span>
            <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
              {WEEKDAY_NAMES.map((name, day) => (
                <option key={day} value={day}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

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
