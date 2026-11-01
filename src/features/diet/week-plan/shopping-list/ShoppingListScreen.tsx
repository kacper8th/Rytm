import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { number } from "../../meals/MealDetails";
import { dateLabel, dateRangeLabel } from "../week-plan";
import {
  deleteShoppingList,
  getShoppingList,
  itemGrams,
  rangeDates,
  setItemChecked,
  type ShoppingList,
  type ShoppingListItem,
} from "./shopping-list";
import "../../meals/MealsScreen.css";
import "../../meal-plans/MealPlansScreen.css";
import "../WeekPlanScreen.css";
import "./ShoppingList.css";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; list: ShoppingList };

/** Saving a check or deleting the list; on error the user can retry the same action. */
type Action = { status: "idle" } | { status: "saving" } | { status: "error"; message: string; retry: () => void };

type SortKey = "name" | "grams";
type Sort = { key: SortKey; descending: boolean };

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Nazwa" },
  { key: "grams", label: "Ilość" },
];

/** "Ukryj kupione" is a view setting — remembered on this device only. */
const HIDE_CHECKED_KEY = "rytm.shoppingList.hideChecked";

function readHideChecked(): boolean {
  try {
    return localStorage.getItem(HIDE_CHECKED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeHideChecked(value: boolean) {
  try {
    localStorage.setItem(HIDE_CHECKED_KEY, value ? "1" : "0");
  } catch {
    // Storage blocked (e.g. private window) — the setting is just not remembered.
  }
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Products grouped by category (categories A–Z), sorted within each group. */
function groupItems(items: readonly ShoppingListItem[], sort: Sort): { category: string; items: ShoppingListItem[] }[] {
  const compare = (a: ShoppingListItem, b: ShoppingListItem) => {
    const order = sort.key === "name" ? a.name.localeCompare(b.name, "pl") : itemGrams(a) - itemGrams(b);
    return sort.descending ? -order : order;
  };
  const groups = new Map<string, ShoppingListItem[]>();
  for (const item of items) {
    const group = groups.get(item.category) ?? [];
    group.push(item);
    groups.set(item.category, group);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "pl"))
    .map(([category, group]) => ({ category, items: group.sort(compare) }));
}

export function ShoppingListScreen() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [reloadCount, setReloadCount] = useState(0);
  const [action, setAction] = useState<Action>({ status: "idle" });
  const [sort, setSort] = useState<Sort>({ key: "name", descending: false });
  const [hideChecked, setHideChecked] = useState(readHideChecked);
  const [openProduct, setOpenProduct] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });
    getShoppingList(id).then(
      (list) => !cancelled && setLoad({ status: "ready", list }),
      (error: Error) => !cancelled && setLoad({ status: "error", message: error.message }),
    );
    return () => {
      cancelled = true;
    };
  }, [id, reloadCount]);

  const list = load.status === "ready" ? load.list : null;
  const groups = useMemo(() => {
    if (!list) return [];
    return groupItems(hideChecked ? list.items.filter((i) => !i.checked) : list.items, sort);
  }, [list, hideChecked, sort]);

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

  function setChecked(productId: string, checked: boolean) {
    setLoad((prev) => {
      if (prev.status !== "ready") return prev;
      const items = prev.list.items.map((i) => (i.productId === productId ? { ...i, checked } : i));
      return { status: "ready", list: { ...prev.list, items } };
    });
  }

  /** Shows the change at once and saves it; on error the check is undone. */
  function toggle(item: ShoppingListItem) {
    const checked = !item.checked;
    setChecked(item.productId, checked);
    run(async () => {
      try {
        await setItemChecked(id, item.productId, checked);
        setChecked(item.productId, checked);
      } catch (error) {
        setChecked(item.productId, !checked);
        throw error;
      }
    });
  }

  function remove(list: ShoppingList) {
    if (!window.confirm(`Usunąć listę zakupów ${dateRangeLabel(list.from, list.to)}?`)) return;
    run(async () => {
      await deleteShoppingList(list.id);
      navigate("/diet/shopping-lists", { replace: true });
    });
  }

  function changeHideChecked(value: boolean) {
    setHideChecked(value);
    writeHideChecked(value);
  }

  const checkedCount = list?.items.filter((i) => i.checked).length ?? 0;

  return (
    <div className="shopping">
      <header className="meals-header">
        <Link to="/diet/shopping-lists" className="meals-back">
          ← Listy zakupów
        </Link>
        <h1 className="meals-title">{list ? dateRangeLabel(list.from, list.to) : "Lista zakupów"}</h1>
        {list && (
          <p className="meals-count">
            Zaplanowane: {list.plannedDays}/{rangeDates(list.from, list.to).length} dni · kupione {checkedCount}/
            {list.items.length}
          </p>
        )}
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
          <span>Nie udało się wczytać listy. {load.message}</span>
          <button type="button" className="week-button" onClick={() => setReloadCount((n) => n + 1)}>
            Spróbuj ponownie
          </button>
        </div>
      )}

      {list && (
        <>
          <div className="meals-sort">
            <label className="meals-sort-label" htmlFor="shopping-sort">
              Sortuj
            </label>
            <select
              id="shopping-sort"
              className="meals-sort-select"
              value={sort.key}
              onChange={(e) => setSort((s) => ({ ...s, key: e.target.value as SortKey }))}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="meals-sort-direction"
              onClick={() => setSort((s) => ({ ...s, descending: !s.descending }))}
              aria-label={sort.descending ? "Malejąco" : "Rosnąco"}
            >
              {sort.descending ? "↓" : "↑"}
            </button>
          </div>

          <label className="shopping-toggle">
            <input type="checkbox" checked={hideChecked} onChange={(e) => changeHideChecked(e.target.checked)} />
            Ukryj kupione
          </label>

          {groups.length === 0 && <p className="meals-empty">Wszystko kupione.</p>}

          {groups.map((group) => (
            <section key={group.category} className="shopping-group">
              <h2 className="shopping-group-title">{capitalize(group.category)}</h2>
              <ul className="shopping-items">
                {group.items.map((item) => {
                  const isOpen = openProduct === item.productId;
                  return (
                    <li key={item.productId} className={"shopping-item" + (item.checked ? " is-checked" : "")}>
                      <input
                        type="checkbox"
                        className="shopping-check"
                        checked={item.checked}
                        aria-label={`Kupione: ${item.name}`}
                        onChange={() => toggle(item)}
                      />
                      <button
                        type="button"
                        className="shopping-item-summary"
                        aria-expanded={isOpen}
                        onClick={() => setOpenProduct(isOpen ? null : item.productId)}
                      >
                        <span className="shopping-item-name">{item.name}</span>
                        <span className="shopping-item-grams">
                          {number.format(itemGrams(item))}
                          <span className="meals-unit"> g</span>
                        </span>
                      </button>
                      {isOpen && (
                        <p className="shopping-days">
                          {Object.entries(item.days)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([date, grams]) => `${dateLabel(date)}: ${number.format(grams)} g`)
                            .join(" · ")}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          <div className="week-actions shopping-delete">
            <button type="button" className="week-button" disabled={action.status === "saving"} onClick={() => remove(list)}>
              Usuń listę
            </button>
          </div>
        </>
      )}
    </div>
  );
}
