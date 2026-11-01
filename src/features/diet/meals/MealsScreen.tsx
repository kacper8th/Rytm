import { useMemo, useState } from "react";
import { Link } from "react-router";
import { MACROS_ON_CARD, MealDetails, nutrientShort, number } from "./MealDetails";
import { getMeals, mealIngredients, mealTotals, type GainMacro, type GainSteps, type Meal } from "./meals";
import { matchesWords } from "../../../shared/text";
import { collapseOnClick } from "../../../shared/ui/collapseOnClick";
import "./MealsScreen.css";

type SortKey = "name" | "kcal" | "protein" | "fat" | "carbs";
type Sort = { key: SortKey; descending: boolean };

const collator = new Intl.Collator("pl");

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Nazwa" },
  { key: "kcal", label: "Kalorie (kcal)" },
  { key: "protein", label: "Białko (g)" },
  { key: "fat", label: "Tłuszcz (g)" },
  { key: "carbs", label: "Węglowodany (g)" },
];

export function MealsScreen() {
  const [sort, setSort] = useState<Sort>({ key: "name", descending: false });
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  /** Gain steps chosen per meal — only a preview, nothing is saved. */
  const [steps, setSteps] = useState<Record<string, GainSteps>>({});

  const allMeals = getMeals();
  /** Totals of the base meal (no gain), used on the list and for sorting. */
  const baseTotals = useMemo(
    () => new Map(allMeals.map((meal) => [meal.id, mealTotals(mealIngredients(meal))])),
    [allMeals],
  );

  const meals = useMemo(() => {
    const direction = sort.descending ? -1 : 1;
    return allMeals
      .filter((meal) => matchesWords(meal.name, query))
      .sort((a, b) => {
        if (sort.key === "name") return collator.compare(a.name, b.name) * direction;
        const diff = baseTotals.get(a.id)![sort.key] - baseTotals.get(b.id)![sort.key];
        return diff !== 0 ? diff * direction : collator.compare(a.name, b.name);
      });
  }, [allMeals, baseTotals, query, sort]);

  const openMeal = allMeals.find((meal) => meal.id === openId) ?? null;

  /** Steps stay within 0…max, even when clicks come faster than the buttons get disabled. */
  function changeStep(mealId: string, key: GainMacro, change: number) {
    const max = allMeals.find((meal) => meal.id === mealId)?.gains[key]?.max ?? 0;
    setSteps((current) => {
      const count = Math.min(Math.max((current[mealId]?.[key] ?? 0) + change, 0), max);
      return { ...current, [mealId]: { ...current[mealId], [key]: count } };
    });
  }

  return (
    <div className="meals page-wide">
      <header className="meals-header">
        <Link to="/diet" className="meals-back">
          ← Dieta
        </Link>
        <h1 className="meals-title">Dania</h1>
        <p className="meals-count">
          {query ? `${meals.length} z ${allMeals.length}` : allMeals.length} dań
        </p>
      </header>

      <input
        type="search"
        className="meals-search"
        placeholder="Szukaj dania…"
        aria-label="Szukaj dań"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="meals-sort">
        <label className="meals-sort-label" htmlFor="meals-sort-key">
          Sortuj według
        </label>
        <select
          id="meals-sort-key"
          className="meals-sort-select"
          value={sort.key}
          onChange={(e) => {
            const key = e.target.value as SortKey;
            // Name ascending, nutrients descending (highest first).
            setSort({ key, descending: key !== "name" });
          }}
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

      <div className="meals-layout">
        <ul className="meals-list">
          {meals.map((meal) => {
            const isOpen = openId === meal.id;
            const totals = baseTotals.get(meal.id)!;
            return (
              <li key={meal.id} className={"meals-item" + (isOpen ? " is-open" : "")}>
                <button
                  type="button"
                  className="meals-item-summary"
                  aria-expanded={isOpen}
                  onClick={() => setOpenId(isOpen ? null : meal.id)}
                >
                  <span className="meals-item-main">
                    <span className="meals-item-name">{meal.name}</span>
                    <Tags meal={meal} />
                  </span>
                  <span className={"meals-item-kcal" + (sort.key === "kcal" ? " is-sorted" : "")}>
                    {number.format(totals.kcal)}
                    <span className="meals-unit"> kcal</span>
                  </span>
                  <span className="meals-item-macros">
                    {MACROS_ON_CARD.map((key) => (
                      <span key={key} className={sort.key === key ? "is-sorted" : undefined}>
                        {nutrientShort(key)} {number.format(totals[key])} g
                      </span>
                    ))}
                  </span>
                </button>

                {/* phone: details under the card */}
                {isOpen && (
                  <div className="meals-details meals-details-inline" onClick={collapseOnClick(() => setOpenId(null))}>
                    <MealDetails
                      meal={meal}
                      steps={steps[meal.id] ?? {}}
                      onStep={(key, change) => changeStep(meal.id, key, change)}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* PC: details of the selected meal next to the list */}
        <aside className="meals-panel">
          {openMeal ? (
            <div className="meals-details">
              <h2 className="meals-panel-title">{openMeal.name}</h2>
              <Tags meal={openMeal} />
              <MealDetails
                meal={openMeal}
                steps={steps[openMeal.id] ?? {}}
                onStep={(key, change) => changeStep(openMeal.id, key, change)}
              />
            </div>
          ) : (
            <p className="meals-panel-empty">Wybierz danie z listy.</p>
          )}
        </aside>
      </div>

      {meals.length === 0 && <p className="meals-empty">Brak dań dla „{query}”.</p>}
    </div>
  );
}

function Tags({ meal }: { meal: Meal }) {
  if (meal.tags.length === 0) return null;
  return (
    <span className="meals-tags">
      {meal.tags.map((tag) => (
        <span key={tag} className="meals-tag">
          {tag}
        </span>
      ))}
    </span>
  );
}
