import { useState } from "react";
import { number } from "../../../meals/MealDetails";
import { isOwnItem, type ShoppingListItem } from "../shopping-list";
import "./ManualItems.css";

type ManualItemControlsProps = {
  item: ShoppingListItem;
  busy: boolean;
  onSaveGrams: (grams: number) => void;
  onSaveOwn: (name: string, amount: string) => void;
  onRemove: () => void;
};

/**
 * In an expanded row of the shopping list: what was added by hand, with ✎ (edit in place) and ✕ (remove, no confirmation).
 * Shown for products with added grams and for own items.
 */
export function ManualItemControls({ item, busy, onSaveGrams, onSaveOwn, onRemove }: ManualItemControlsProps) {
  const own = isOwnItem(item);
  const [editing, setEditing] = useState(false);
  const [grams, setGrams] = useState(String(item.addedGrams ?? ""));
  const [name, setName] = useState(item.name);
  const [amount, setAmount] = useState(item.amount ?? "");

  const gramsValue = Number(grams.replace(",", "."));
  const canSave = own ? name.trim() !== "" : gramsValue > 0;

  function startEditing() {
    setGrams(String(item.addedGrams ?? ""));
    setName(item.name);
    setAmount(item.amount ?? "");
    setEditing(true);
  }

  function saveEdit() {
    if (own) onSaveOwn(name.trim(), amount.trim());
    else onSaveGrams(gramsValue);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="manual-edit">
        {own ? (
          <>
            <input
              className="meals-sort-select"
              aria-label="Nazwa"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="meals-sort-select"
              aria-label="Ilość"
              placeholder="ilość (opcjonalnie)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </>
        ) : (
          <label className="manual-field">
            <span className="meals-sort-label">Dodane ręcznie (g)</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              className="meals-sort-select"
              value={grams}
              autoFocus
              onChange={(e) => setGrams(e.target.value)}
            />
          </label>
        )}
        <div className="week-actions">
          <button type="button" className="week-button is-primary" disabled={busy || !canSave} onClick={saveEdit}>
            Zapisz
          </button>
          <button type="button" className="week-button" onClick={() => setEditing(false)}>
            Anuluj
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="manual-line">
      <span>
        {own ? (
          <>Dodane ręcznie{item.amount ? `: ${item.amount}` : ""}</>
        ) : (
          <>Dodane ręcznie: {number.format(item.addedGrams ?? 0)} g</>
        )}
      </span>
      <button type="button" className="manual-icon" disabled={busy} aria-label="Edytuj" onClick={startEditing}>
        ✎
      </button>
      <button type="button" className="manual-icon" disabled={busy} aria-label="Usuń" onClick={onRemove}>
        ✕
      </button>
    </div>
  );
}
