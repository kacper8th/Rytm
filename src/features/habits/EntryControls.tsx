import { useState, type FormEvent } from "react";
import { dateLabel } from "../../shared/dates";
import type { Entry, Habit } from "./habits";
import { formatAmount, parseAmount } from "./periods";

/**
 * Adding and correcting the entries of one goal or limit — shared by Goals and Limits.
 * Quick buttons and a field add an entry; "undo last" deletes the newest of `entries`; the list deletes any of them.
 */
export function EntryControls({
  habit,
  entries,
  showDates,
  disabled,
  onAdd,
  onDelete,
}: {
  habit: Habit;
  /** Entries the controls correct (the shown day or period), in the order added. */
  entries: readonly Entry[];
  /** Show the date of each entry in the list (entries of a period span several days). */
  showDates: boolean;
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
            aria-label={`Dodaj ${formatAmount(value)} ${unit} — ${habit.name}`}
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
          aria-label={`Ilość do dodania — ${habit.name}`}
        />
        <button type="submit" className="habits-button" disabled={disabled || !amountValid}>
          Dodaj
        </button>
        <button
          type="button"
          className="habits-button"
          disabled={disabled || !last}
          onClick={() => last && onDelete(last)}
          aria-label={`Cofnij ostatni wpis — ${habit.name}`}
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
                    {showDates && <span className="habits-row-note"> · {dateLabel(entry.date)}</span>}
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
