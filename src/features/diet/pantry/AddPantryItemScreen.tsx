import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { getProducts, productMatches, type Product } from "../products/products";
import { addToPantry } from "./pantry";
import "../meals/MealsScreen.css";
import "../week-plan/WeekPlanScreen.css";
import "../week-plan/shopping-list/ShoppingList.css";
import "../week-plan/shopping-list/manual-items/ManualItems.css";

/** Search results shown at most — the query narrows them down. */
const MAX_RESULTS = 30;

type Save = { status: "idle" } | { status: "saving" } | { status: "error"; message: string };

/** Adds a product from Products with grams to the pantry, then returns to it. As the add screen of Manual items, without own items. */
export function AddPantryItemScreen() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [grams, setGrams] = useState("");
  const [save, setSave] = useState<Save>({ status: "idle" });

  const results = useMemo(
    () => (query.trim() ? getProducts().filter((p) => productMatches(p, query)).slice(0, MAX_RESULTS) : []),
    [query],
  );

  const gramsValue = Number(grams.replace(",", "."));
  const canAdd = save.status !== "saving" && product !== null && gramsValue > 0;

  async function add() {
    if (!product) return;
    setSave({ status: "saving" });
    try {
      await addToPantry(product.id, gramsValue);
      navigate("/diet/pantry", { replace: true });
    } catch (error) {
      setSave({ status: "error", message: (error as Error).message });
    }
  }

  return (
    <div className="shopping">
      <header className="meals-header">
        <Link to="/diet/pantry" className="meals-back">
          ← Magazyn
        </Link>
        <h1 className="meals-title">Dodaj produkt</h1>
      </header>

      {product === null ? (
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
              {results.map((p) => (
                <li key={p.id} className="meals-item">
                  <button type="button" className="meals-item-summary" onClick={() => setProduct(p)}>
                    <span className="meals-item-name">{p.name}</span>
                    <span className="meals-item-macros">{[p.brand, p.category].filter(Boolean).join(" · ")}</span>
                  </button>
                </li>
              ))}
              {results.length === 0 && <li className="meals-empty">Brak produktów.</li>}
            </ul>
          )}
        </>
      ) : (
        <div className="manual-form">
          <div className="manual-chosen">
            <span className="meals-item-name">{product.name}</span>
            <button type="button" className="week-button" onClick={() => setProduct(null)}>
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
        <Link to="/diet/pantry" className="week-button">
          Anuluj
        </Link>
      </div>
    </div>
  );
}
