import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { number } from "../meals/MealDetails";
import { getProducts, type Product } from "../products/products";
import { getPantry, removeFromPantry, setPantryGrams, type PantryItem } from "./pantry";
import "../meals/MealsScreen.css";
import "../week-plan/WeekPlanScreen.css";
import "../week-plan/shopping-list/ShoppingList.css";
import "../week-plan/shopping-list/manual-items/ManualItems.css";
import "./Pantry.css";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; items: PantryItem[] };

/** Saving an edit or a removal; on error the user can retry the same action. */
type Action = { status: "idle" } | { status: "saving" } | { status: "error"; message: string; retry: () => void };

type Row = { item: PantryItem; product: Product };

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Pantry products grouped by category (categories A–Z, products A–Z);
 * products no longer in Products go last, unnamed.
 */
function groupItems(items: readonly PantryItem[]) {
  const products = new Map(getProducts().map((p) => [p.id, p]));
  const groups = new Map<string, Row[]>();
  const missing: PantryItem[] = [];
  for (const item of items) {
    const product = products.get(item.productId);
    if (!product) {
      missing.push(item);
      continue;
    }
    const group = groups.get(product.category) ?? [];
    group.push({ item, product });
    groups.set(product.category, group);
  }
  const named = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "pl"))
    .map(([category, rows]) => ({
      category,
      rows: rows.sort((a, b) => a.product.name.localeCompare(b.product.name, "pl")),
    }));
  return { groups: named, missing };
}

export function PantryScreen() {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [reloadCount, setReloadCount] = useState(0);
  const [action, setAction] = useState<Action>({ status: "idle" });
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });
    getPantry().then(
      (items) => !cancelled && setLoad({ status: "ready", items }),
      (error: Error) => !cancelled && setLoad({ status: "error", message: error.message }),
    );
    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  const items = load.status === "ready" ? load.items : null;
  const { groups, missing } = useMemo(() => groupItems(items ?? []), [items]);

  function run(task: () => Promise<void>) {
    const attempt = async () => {
      setAction({ status: "saving" });
      try {
        await task();
        setAction({ status: "idle" });
      } catch (error) {
        setAction({ status: "error", message: (error as Error).message, retry: () => void attempt() });
      }
    };
    void attempt();
  }

  /** Puts an item as saved into the pantry (null = removed). */
  function replaceItem(productId: string, saved: PantryItem | null) {
    setLoad((prev) => {
      if (prev.status !== "ready") return prev;
      const next = prev.items.flatMap((i) => (i.productId !== productId ? [i] : saved ? [saved] : []));
      return { status: "ready", items: next };
    });
  }

  function saveGrams(productId: string, grams: number) {
    setEditing(null);
    run(async () => replaceItem(productId, await setPantryGrams(productId, grams)));
  }

  function remove(productId: string) {
    run(async () => {
      await removeFromPantry(productId);
      replaceItem(productId, null);
    });
  }

  const busy = action.status === "saving";

  return (
    <div className="shopping">
      <header className="meals-header">
        <Link to="/diet" className="meals-back">
          ← Dieta
        </Link>
        <h1 className="meals-title">Magazyn</h1>
        {items && <p className="meals-count">Produkty: {items.length}</p>}
      </header>

      {action.status === "saving" && <p className="week-status">Zapisywanie…</p>}
      {action.status === "error" && (
        <div className="week-status is-error" role="alert">
          <span>Nie udało się zapisać. {action.message}</span>
          <button type="button" className="week-button" onClick={action.retry}>
            Spróbuj ponownie
          </button>
          <button type="button" className="week-button" onClick={() => setAction({ status: "idle" })}>
            Zamknij
          </button>
        </div>
      )}

      {load.status === "loading" && <p className="meals-empty">Ładowanie…</p>}

      {load.status === "error" && (
        <div className="week-status is-error" role="alert">
          <span>Nie udało się wczytać magazynu. {load.message}</span>
          <button type="button" className="week-button" onClick={() => setReloadCount((n) => n + 1)}>
            Spróbuj ponownie
          </button>
        </div>
      )}

      {items && (
        <>
          <div className="week-actions shopping-actions">
            <Link to="/diet/pantry/add" className="week-button is-primary">
              Dodaj produkt
            </Link>
          </div>

          {items.length === 0 && <p className="meals-empty">Magazyn jest pusty.</p>}

          {groups.map((group) => (
            <section key={group.category} className="shopping-group">
              <h2 className="shopping-group-title">{capitalize(group.category)}</h2>
              <ul className="shopping-items">
                {group.rows.map(({ item, product }) => (
                  <PantryRow
                    key={`${item.productId}-${item.grams}`}
                    name={product.name}
                    item={item}
                    busy={busy}
                    editing={editing === item.productId}
                    onEdit={() => setEditing(item.productId)}
                    onCancel={() => setEditing(null)}
                    onSave={(grams) => saveGrams(item.productId, grams)}
                    onRemove={() => remove(item.productId)}
                  />
                ))}
              </ul>
            </section>
          ))}

          {missing.length > 0 && (
            <section className="shopping-group">
              <h2 className="shopping-group-title">Brak w bazie</h2>
              <ul className="shopping-items">
                {missing.map((item) => (
                  <PantryRow
                    key={item.productId}
                    name="Produkt usunięty z bazy"
                    item={item}
                    busy={busy}
                    editing={false}
                    onRemove={() => remove(item.productId)}
                  />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

type PantryRowProps = {
  name: string;
  item: PantryItem;
  busy: boolean;
  editing: boolean;
  /** Without onEdit the row has only ✕ (a product no longer in Products). */
  onEdit?: () => void;
  onCancel?: () => void;
  onSave?: (grams: number) => void;
  onRemove: () => void;
};

/** A pantry product: name, grams, ✎ (edit the grams in place) and ✕ (remove, no confirmation — easy to add again). */
function PantryRow({ name, item, busy, editing, onEdit, onCancel, onSave, onRemove }: PantryRowProps) {
  const [grams, setGrams] = useState(String(item.grams));
  const gramsValue = Number(grams.replace(",", "."));

  if (editing && onSave && onCancel) {
    return (
      <li className="pantry-item">
        <div className="manual-edit pantry-edit">
          <label className="manual-field">
            <span className="meals-sort-label">{name} (g)</span>
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
          <div className="week-actions">
            <button
              type="button"
              className="week-button is-primary"
              disabled={busy || !(gramsValue > 0)}
              onClick={() => onSave(gramsValue)}
            >
              Zapisz
            </button>
            <button type="button" className="week-button" onClick={onCancel}>
              Anuluj
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="pantry-item">
      <span className={"shopping-item-name" + (onEdit ? "" : " pantry-missing")}>{name}</span>
      <span className="shopping-item-grams">
        {number.format(item.grams)}
        <span className="meals-unit"> g</span>
      </span>
      {onEdit && (
        <button type="button" className="manual-icon" disabled={busy} aria-label={`Edytuj: ${name}`} onClick={onEdit}>
          ✎
        </button>
      )}
      <button type="button" className="manual-icon" disabled={busy} aria-label={`Usuń: ${name}`} onClick={onRemove}>
        ✕
      </button>
    </li>
  );
}
