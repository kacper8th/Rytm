import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { getProducts, productMatches, type Product } from "../../../products/products";
import { dateRangeLabel } from "../../../../../shared/dates";
import { getShoppingList, type ShoppingList } from "../shopping-list";
import { addOwnItem, addProduct } from "./manual-items";
import "../../../meals/MealsScreen.css";
import "../../WeekPlanScreen.css";
import "../ShoppingList.css";
import "./ManualItems.css";

/** Search results shown at most — the query narrows them down. */
const MAX_RESULTS = 30;

type Choice = { kind: "none" } | { kind: "product"; product: Product } | { kind: "own" };

type Save = { status: "idle" } | { status: "saving" } | { status: "error"; message: string };

/** Adds a product from Products (grams) or an own item (name + amount) to an existing list, then returns to it. */
export function AddItemScreen() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const listUrl = `/diet/shopping-lists/${id}`;
  const [list, setList] = useState<ShoppingList | null>(null);
  const [query, setQuery] = useState("");
  const [choice, setChoice] = useState<Choice>({ kind: "none" });
  const [grams, setGrams] = useState("");
  const [ownName, setOwnName] = useState("");
  const [amount, setAmount] = useState("");
  const [save, setSave] = useState<Save>({ status: "idle" });

  // Only for the header (range); adding works without it.
  useEffect(() => {
    let cancelled = false;
    getShoppingList(id).then(
      (loaded) => !cancelled && setList(loaded),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [id]);

  const results = useMemo(
    () => (query.trim() ? getProducts().filter((p) => productMatches(p, query)).slice(0, MAX_RESULTS) : []),
    [query],
  );

  const gramsValue = Number(grams.replace(",", "."));
  const canAdd =
    save.status !== "saving" &&
    ((choice.kind === "product" && gramsValue > 0) || (choice.kind === "own" && ownName.trim() !== ""));

  async function add() {
    setSave({ status: "saving" });
    try {
      if (choice.kind === "product") await addProduct(id, choice.product, gramsValue);
      else await addOwnItem(id, ownName.trim(), amount.trim());
      navigate(listUrl, { replace: true });
    } catch (error) {
      setSave({ status: "error", message: (error as Error).message });
    }
  }

  function chooseOwn() {
    setOwnName(query.trim());
    setChoice({ kind: "own" });
  }

  return (
    <div className="shopping">
      <header className="meals-header">
        <Link to={listUrl} className="meals-back">
          ← Lista zakupów
        </Link>
        <h1 className="meals-title">Dodaj produkt</h1>
        {list && <p className="meals-count">{dateRangeLabel(list.from, list.to)}</p>}
      </header>

      {choice.kind === "none" && (
        <>
          <input
            type="search"
            className="meals-search"
            placeholder="Szukaj produktu…"
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
          />
          {query.trim() && (
            <ul className="meals-list">
              {results.map((product) => (
                <li key={product.id} className="meals-item">
                  <button
                    type="button"
                    className="meals-item-summary"
                    onClick={() => setChoice({ kind: "product", product })}
                  >
                    <span className="meals-item-name">{product.name}</span>
                    <span className="meals-item-macros">
                      {[product.brand, product.category].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                </li>
              ))}
              <li className="meals-item manual-own-option">
                <button type="button" className="meals-item-summary" onClick={chooseOwn}>
                  <span className="meals-item-name">Dodaj jako własną pozycję: „{query.trim()}”</span>
                  <span className="meals-item-macros">poza bazą produktów — trafi do grupy „Inne”</span>
                </button>
              </li>
            </ul>
          )}
        </>
      )}

      {choice.kind === "product" && (
        <div className="manual-form">
          <div className="manual-chosen">
            <span className="meals-item-name">{choice.product.name}</span>
            <button type="button" className="week-button" onClick={() => setChoice({ kind: "none" })}>
              Zmień
            </button>
          </div>
          <label className="manual-field">
            <span className="meals-sort-label">Ilość (g)</span>
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
        </div>
      )}

      {choice.kind === "own" && (
        <div className="manual-form">
          <label className="manual-field">
            <span className="meals-sort-label">Nazwa</span>
            <input className="meals-sort-select" value={ownName} onChange={(e) => setOwnName(e.target.value)} />
          </label>
          <label className="manual-field">
            <span className="meals-sort-label">Ilość</span>
            <input
              className="meals-sort-select"
              placeholder="np. 2 szt., 1 op. (opcjonalnie)"
              value={amount}
              autoFocus
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <button type="button" className="week-button manual-back" onClick={() => setChoice({ kind: "none" })}>
            ← Wróć do wyszukiwania
          </button>
        </div>
      )}

      {save.status === "saving" && <p className="week-status">Zapisywanie…</p>}
      {save.status === "error" && (
        <div className="week-status is-error" role="alert">
          <span>Nie udało się dodać. {save.message}</span>
          <button type="button" className="week-button" onClick={() => void add()}>
            Spróbuj ponownie
          </button>
        </div>
      )}

      <div className="week-actions manual-actions">
        <button type="button" className="week-button is-primary" disabled={!canAdd} onClick={() => void add()}>
          Dodaj
        </button>
        <Link to={listUrl} className="week-button">
          Anuluj
        </Link>
      </div>
    </div>
  );
}
