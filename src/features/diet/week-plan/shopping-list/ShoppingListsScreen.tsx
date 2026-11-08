import { useEffect, useState } from "react";
import { Link } from "react-router";
import { dateRangeLabel } from "../../../../shared/dates";
import { listShoppingLists, type ShoppingListSummary } from "./shopping-list";
import "../../meals/MealsScreen.css";
import "../WeekPlanScreen.css";
import "./ShoppingList.css";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; lists: ShoppingListSummary[] };

/** Saved shopping lists, newest first. */
export function ShoppingListsScreen() {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });
    listShoppingLists().then(
      (lists) => !cancelled && setLoad({ status: "ready", lists }),
      (error: Error) => !cancelled && setLoad({ status: "error", message: error.message }),
    );
    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  return (
    <div className="shopping">
      <header className="meals-header">
        <Link to="/diet" className="meals-back">
          ← Dieta
        </Link>
        <h1 className="meals-title">Listy zakupów</h1>
      </header>

      <div className="week-actions shopping-actions">
        <Link to="/diet/shopping-lists/new" className="week-button is-primary">
          Nowa lista
        </Link>
      </div>

      {load.status === "loading" && <p className="meals-empty">Ładowanie…</p>}

      {load.status === "error" && (
        <div className="week-status is-error" role="alert">
          <span>Nie udało się wczytać list. {load.message}</span>
          <button type="button" className="week-button" onClick={() => setReloadCount((n) => n + 1)}>
            Spróbuj ponownie
          </button>
        </div>
      )}

      {load.status === "ready" &&
        (load.lists.length === 0 ? (
          <p className="meals-empty">Brak list zakupów.</p>
        ) : (
          <ul className="meals-list">
            {load.lists.map((list) => (
              <li key={list.id} className="meals-item">
                <Link to={`/diet/shopping-lists/${list.id}`} className="meals-item-summary shopping-link">
                  <span className="meals-item-name">{dateRangeLabel(list.from, list.to)}</span>
                  <span className="meals-item-macros">
                    <span>{list.items} prod.</span>
                    <span className={list.checked === list.items ? "shopping-done" : undefined}>
                      kupione {list.checked}/{list.items}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
