import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { createShoppingList, defaultRange, loadRangeItems, rangeError, type RangeItems } from "./shopping-list";
import "../../meals/MealsScreen.css";
import "../../meal-plans/MealPlansScreen.css";
import "../WeekPlanScreen.css";
import "./ShoppingList.css";

type Preview = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; range: RangeItems };

type Save = { status: "idle" } | { status: "saving" } | { status: "error"; message: string };

const dateParam = (value: string | null) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);

/** A new list for a date range; `?from=&to=` (from Week plan) presets the range, otherwise today – Sunday. */
export function NewShoppingListScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [from, setFrom] = useState(() => dateParam(params.get("from")) ?? defaultRange().from);
  const [to, setTo] = useState(() => dateParam(params.get("to")) ?? defaultRange().to);
  const [preview, setPreview] = useState<Preview>({ status: "loading" });
  const [reloadCount, setReloadCount] = useState(0);
  const [save, setSave] = useState<Save>({ status: "idle" });

  const error = rangeError(from, to);

  useEffect(() => {
    if (error) return;
    let cancelled = false;
    setPreview({ status: "loading" });
    loadRangeItems(from, to).then(
      (range) => !cancelled && setPreview({ status: "ready", range }),
      (e: Error) => !cancelled && setPreview({ status: "error", message: e.message }),
    );
    return () => {
      cancelled = true;
    };
  }, [from, to, error, reloadCount]);

  const range = !error && preview.status === "ready" ? preview.range : null;
  const canCreate = range !== null && range.plannedDays > 0 && range.items.length > 0 && save.status !== "saving";

  async function create() {
    if (!range) return;
    setSave({ status: "saving" });
    try {
      const id = await createShoppingList(from, to, range.plannedDays, range.items);
      navigate(`/diet/shopping-lists/${id}`, { replace: true });
    } catch (e) {
      setSave({ status: "error", message: (e as Error).message });
    }
  }

  return (
    <div className="shopping">
      <header className="meals-header">
        <Link to="/diet/shopping-lists" className="meals-back">
          ← Listy zakupów
        </Link>
        <h1 className="meals-title">Nowa lista zakupów</h1>
      </header>

      <div className="shopping-range">
        <label className="shopping-field">
          <span className="meals-sort-label">od</span>
          <input type="date" className="meals-sort-select" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="shopping-field">
          <span className="meals-sort-label">do</span>
          <input type="date" className="meals-sort-select" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      {error ? (
        <p className="week-status is-error">{error}</p>
      ) : (
        <>
          {preview.status === "loading" && <p className="week-status">Ładowanie planu…</p>}
          {preview.status === "error" && (
            <div className="week-status is-error" role="alert">
              <span>Nie udało się wczytać planu. {preview.message}</span>
              <button type="button" className="week-button" onClick={() => setReloadCount((n) => n + 1)}>
                Spróbuj ponownie
              </button>
            </div>
          )}
          {range && (
            <p className="plans-target">
              Zaplanowane: {range.plannedDays}/{range.rangeDays} dni · produkty: {range.items.length}
              {range.missing > 0 && <span className="shopping-missing"> · pominięte (brak w bazie): {range.missing}</span>}
            </p>
          )}
          {range && range.plannedDays === 0 && <p className="meals-empty">Brak zaplanowanych dni w tym zakresie.</p>}
        </>
      )}

      {save.status === "saving" && <p className="week-status">Zapisywanie…</p>}
      {save.status === "error" && (
        <p className="week-status is-error" role="alert">
          Nie udało się zapisać. {save.message}
        </p>
      )}

      <div className="week-actions">
        <button type="button" className="week-button is-primary" disabled={!canCreate} onClick={() => void create()}>
          Utwórz listę
        </button>
        <Link to="/diet/shopping-lists" className="week-button">
          Anuluj
        </Link>
      </div>
    </div>
  );
}
