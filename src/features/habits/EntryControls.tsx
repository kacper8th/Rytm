import { useState, type FormEvent } from "react";
import { dateLabel, toIsoDate } from "../../shared/dates";
import type { Entry, Habit } from "./habits";
import { formatAmount, parseAmount } from "./periods";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * When an entry counts and when it was added, e.g. "Sob 14.11, 18:36"; an entry added on another day (a past day
 * filled in later) also shows when it was added: "Sob 14.11 (dodano 15.11, 09:05)".
 */
function entryWhen(entry: Entry): string {
  const added = new Date(entry.createdAt);
  const time = `${pad(added.getHours())}:${pad(added.getMinutes())}`;
  if (toIsoDate(added) === entry.date) return `${dateLabel(entry.date)}, ${time}`;
  return `${dateLabel(entry.date)} (dodano ${added.getDate()}.${added.getMonth() + 1}, ${time})`;
}

/**
 * Adding and correcting the entries of one goal or limit — shared by Goals and Limits.
 * Quick buttons and a field add an entry; "undo last" deletes the newest of `entries`; the list deletes any of them.
 */
export function EntryControls({
  habit,
  entries,
  disabled,
  onAdd,
  onDelete,
}: {
  habit: Habit;
  /** Entries the controls correct (the shown day or period), in the order added. */
  entries: readonly Entry[];
  disabled: boolean;
  onAdd: (amount: number) => void;
  onDelete: (entry: Entry) => void;
}) {
  const [amountText, setAmountText] = useState("");
  const [open, setOpen] = useState(false);
  const unit = habit.unit ?? "";
  const amount = parseAmount(amountText);
  const amountValid = amount > 0 && amount <= 1_000_000;
  const last = entries.length ? entries[entries.length - 1] : null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!amountValid) return;
    onAdd(amount);
    setAmountText("");
  }

  return (
    <div className="habits-entry">
      <div className="habits-entry-buttons">
        {habit.buttonValues.map((value) => (
          <button
            key={value}
            type="button"
            className="habits-button"
            disabled={disabled}
            onClick={() => onAdd(value)}
            aria-label={`Dodaj ${formatAmount(value)} ${unit} - ${habit.name}`}
          >
            +{formatAmount(value)}
          </button>
        ))}
      </div>

      <form className="habits-entry-form" onSubmit={submit}>
        <input
          type="text"
          inputMode="decimal"
          placeholder={`Ilość (${unit})`}
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          aria-label={`Ilość do dodania - ${habit.name}`}
        />
        <button type="submit" className="habits-button" disabled={disabled || !amountValid}>
          Dodaj
        </button>
        <button
          type="button"
          className="habits-button"
          disabled={disabled || !last}
          onClick={() => last && onDelete(last)}
          aria-label={`Cofnij ostatni wpis - ${habit.name}`}
        >
          Cofnij
        </button>
      </form>

      {entries.length > 0 && (
        <div className="habits-entries">
          <button type="button" className="habits-link-button" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            Wpisy ({entries.length}) {open ? "▴" : "▾"}
          </button>
          {open && (
            <ul className="habits-entries-list">
              {[...entries].reverse().map((entry) => (
                <li key={entry.id} className="habits-entries-row">
                  <span>
                    {formatAmount(entry.amount)} {unit}
                    <span className="habits-row-note"> · {entryWhen(entry)}</span>
                  </span>
                  <button
                    type="button"
                    className="habits-icon-button"
                    disabled={disabled}
                    onClick={() => onDelete(entry)}
                    aria-label={`Usuń wpis ${formatAmount(entry.amount)} ${unit}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
