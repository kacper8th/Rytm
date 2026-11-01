import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { number } from "../../meals/MealDetails";
import { dateLabel, dateRangeLabel } from "../week-plan";
import {
  deleteShoppingList,
  getShoppingList,
  isOwnItem,
  itemGrams,
  isInPantry,
  itemsToBuy,
  missingByDay,
  missingGrams,
  rangeDates,
  setItemChecked,
  type ShoppingList,
  type ShoppingListItem,
} from "./shopping-list";
import { removeManual, setAddedGrams, setOwnItem } from "./manual-items/manual-items";
import { ManualItemControls } from "./manual-items/ManualItemControls";
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

/** Chosen day of the filter by day; null = "Wszystkie". Not remembered — every opening starts with all days. */
type DayFilter = string | null;

/**
 * Grams to buy for the chosen day plus grams added by hand (they have no date); all days when no day is chosen.
 * Planned grams covered by the Pantry are left out (see missingByDay()).
 */
function filteredGrams(item: ShoppingListItem, day: DayFilter): number {
  if (day === null) return missingGrams(item);
  return (missingByDay(item)[day] ?? 0) + (item.addedGrams ?? 0);
}

/** Covered by the Pantry — for the chosen day, or for the whole list when no day is chosen. */
function isCovered(item: ShoppingListItem, day: DayFilter): boolean {
  if (day === null) return isInPantry(item);
  return item.pantryGrams !== null && filteredGrams(item, day) === 0;
}

/** With a day chosen: products needed on that day; what was added by hand is always shown. */
function isShownForDay(item: ShoppingListItem, day: DayFilter): boolean {
  if (day === null || isOwnItem(item) || item.addedGrams !== null) return true;
  return item.days[day] !== undefined;
}

/** Products grouped by category (categories A–Z), sorted within each group; by amount, own items (no grams) go last. */
function groupItems(
  items: readonly ShoppingListItem[],
  sort: Sort,
  days: DayFilter,
): { category: string; items: ShoppingListItem[] }[] {
  const compare = (a: ShoppingListItem, b: ShoppingListItem) => {
    if (sort.key === "grams" && isOwnItem(a) !== isOwnItem(b)) return isOwnItem(a) ? 1 : -1;
    const order =
      sort.key === "name" ? a.name.localeCompare(b.name, "pl") : filteredGrams(a, days) - filteredGrams(b, days);
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
  const [dayFilter, setDayFilter] = useState<DayFilter>(null);
  /** "Pokaż z magazynu" — not remembered; every opening starts with pantry products hidden. */
  const [showPantry, setShowPantry] = useState(false);

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
    const shown = list.items.filter(
      (i) => (showPantry || !isCovered(i, dayFilter)) && (!hideChecked || !i.checked) && isShownForDay(i, dayFilter),
    );
    return groupItems(shown, sort, dayFilter);
  }, [list, showPantry, hideChecked, sort, dayFilter]);

  /** Products covered by the Pantry — for the chosen day, or for the whole list. */
  const pantryCount = list?.items.filter((i) => isShownForDay(i, dayFilter) && isCovered(i, dayFilter)).length ?? 0;

  /** Days some product is needed on, in date order — the options of the filter. */
  const listDays = useMemo(
    () => (list ? [...new Set(list.items.flatMap((i) => Object.keys(i.days)))].sort() : []),
    [list],
  );

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

  /** Puts an item as saved into the list (null = removed). */
  function replaceItem(productId: string, saved: ShoppingListItem | null) {
    setLoad((prev) => {
      if (prev.status !== "ready") return prev;
      const items = prev.list.items.flatMap((i) => (i.productId !== productId ? [i] : saved ? [saved] : []));
      return { status: "ready", list: { ...prev.list, items } };
    });
  }

  function saveAddedGrams(item: ShoppingListItem, grams: number) {
    run(async () => replaceItem(item.productId, await setAddedGrams(id, item.productId, grams)));
  }

  function saveOwnItem(item: ShoppingListItem, name: string, amount: string) {
    run(async () => replaceItem(item.productId, await setOwnItem(id, item.productId, name, amount)));
  }

  /** An own item or a product added only by hand disappears; a product from the plan keeps its planned grams. */
  function removeAddition(item: ShoppingListItem) {
    run(async () => {
      await removeManual(id, item.productId);
      const onlyByHand = isOwnItem(item) || Object.keys(item.days).length === 0;
      replaceItem(item.productId, onlyByHand ? null : { ...item, addedGrams: null });
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

  const toBuy = list ? itemsToBuy(list.items) : [];
  const checkedCount = toBuy.filter((i) => i.checked).length;

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
            {toBuy.length}
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
          <div className="week-actions shopping-actions">
            <Link to={`/diet/shopping-lists/${list.id}/add`} className="week-button is-primary">
              Dodaj produkt
            </Link>
          </div>

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

          {pantryCount > 0 && (
            <label className="shopping-toggle">
              <input type="checkbox" checked={showPantry} onChange={(e) => setShowPantry(e.target.checked)} />
              Pokaż z magazynu ({pantryCount})
            </label>
          )}

          {listDays.length > 0 && (
            <div className="meals-sort">
              <label className="meals-sort-label" htmlFor="shopping-day">
                Dzień
              </label>
              <select
                id="shopping-day"
                className="meals-sort-select"
                value={dayFilter ?? ""}
                onChange={(e) => setDayFilter(e.target.value || null)}
              >
                <option value="">Wszystkie</option>
                {listDays.map((date) => (
                  <option key={date} value={date}>
                    {dateLabel(date)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {groups.length === 0 && (
            <p className="meals-empty">{dayFilter !== null ? "Brak produktów na wybrany dzień." : "Wszystko kupione."}</p>
          )}

          {groups.map((group) => (
            <section key={group.category} className="shopping-group">
              <h2 className="shopping-group-title">{capitalize(group.category)}</h2>
              <ul className="shopping-items">
                {group.items.map((item) => {
                  const isOpen = openProduct === item.productId;
                  const own = isOwnItem(item);
                  const days = Object.entries(item.days).sort(([a], [b]) => a.localeCompare(b));
                  const inPantry = isCovered(item, dayFilter);
                  const planned = itemGrams({ days: item.days });
                  return (
                    <li
                      key={item.productId}
                      className={
                        "shopping-item" + (item.checked ? " is-checked" : "") + (inPantry ? " is-in-pantry" : "")
                      }
                    >
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
                        <span className="shopping-item-name">
                          {item.name}
                          {own && <span className="manual-mark">ręcznie</span>}
                          {inPantry && <span className="manual-mark">w magazynie</span>}
                        </span>
                        <span className="shopping-item-grams">
                          {own ? (
                            item.amount ?? ""
                          ) : (
                            <>
                              {number.format(filteredGrams(item, dayFilter))}
                              <span className="meals-unit"> g</span>
                              {dayFilter !== null && (
                                <span className="meals-unit"> (z {number.format(missingGrams(item))} g)</span>
                              )}
                            </>
                          )}
                        </span>
                      </button>
                      {item.pantryGrams !== null && planned > 0 && (
                        <p className="shopping-pantry-note">
                          potrzeba {number.format(planned)} g · w magazynie {number.format(item.pantryGrams)} g
                          {item.addedGrams !== null && <> · dodane ręcznie {number.format(item.addedGrams)} g</>}
                        </p>
                      )}
                      {isOpen && (
                        <div className="shopping-days">
                          {days.length > 0 && (
                            <p className="shopping-days-list">
                              {days.map(([date, grams]) => `${dateLabel(date)}: ${number.format(grams)} g`).join(" · ")}
                            </p>
                          )}
                          {(own || item.addedGrams !== null) && (
                            <ManualItemControls
                              key={`${item.addedGrams}-${item.name}-${item.amount}`}
                              item={item}
                              busy={action.status === "saving"}
                              onSaveGrams={(grams) => saveAddedGrams(item, grams)}
                              onSaveOwn={(name, amount) => saveOwnItem(item, name, amount)}
                              onRemove={() => removeAddition(item)}
                            />
                          )}
                        </div>
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
