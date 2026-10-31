import { useMemo, useState } from "react";
import { Link } from "react-router";
import { NUTRIENT_GROUPS, NUTRIENTS, type NutrientKey } from "../products/products";
import {
  GAIN_MACROS,
  getMeals,
  ingredientAmount,
  isRecipeLink,
  mealIngredients,
  mealTotals,
  type GainMacro,
  type GainSteps,
  type Meal,
} from "./meals";
import "./MealsScreen.css";

type SortKey = "name" | "kcal" | "protein" | "fat" | "carbs";
type Sort = { key: SortKey; descending: boolean };

const collator = new Intl.Collator("pl");
const number = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 });

const MACROS_ON_CARD = ["protein", "fat", "carbs"] as const;

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Nazwa" },
  { key: "kcal", label: "Kalorie (kcal)" },
  { key: "protein", label: "Białko (g)" },
  { key: "fat", label: "Tłuszcz (g)" },
  { key: "carbs", label: "Węglowodany (g)" },
];

/** Lower case without Polish letters, so "nalesniki" finds "naleśniki". */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Every word of the query must appear in the name. */
function matchesQuery(meal: Meal, query: string): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const text = normalize(meal.name);
  return words.every((word) => text.includes(word));
}

function nutrientShort(key: NutrientKey): string {
  return NUTRIENTS.find((n) => n.key === key)!.short;
}

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
      .filter((meal) => matchesQuery(meal, query))
      .sort((a, b) => {
        if (sort.key === "name") return collator.compare(a.name, b.name) * direction;
        const diff = baseTotals.get(a.id)![sort.key] - baseTotals.get(b.id)![sort.key];
        return diff !== 0 ? diff * direction : collator.compare(a.name, b.name);
      });
  }, [allMeals, baseTotals, query, sort]);

  const openMeal = allMeals.find((meal) => meal.id === openId) ?? null;

  function changeStep(mealId: string, key: GainMacro, change: number) {
    setSteps((current) => ({
      ...current,
      [mealId]: { ...current[mealId], [key]: (current[mealId]?.[key] ?? 0) + change },
    }));
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
                  <div className="meals-details meals-details-inline">
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

type MealDetailsProps = {
  meal: Meal;
  steps: GainSteps;
  onStep: (key: GainMacro, change: number) => void;
};

function MealDetails({ meal, steps, onStep }: MealDetailsProps) {
  const base = new Map(meal.ingredients.map((item) => [item.productId, item.grams]));
  const ingredients = mealIngredients(meal, steps);
  const totals = mealTotals(ingredients);
  const gains = GAIN_MACROS.filter(({ key }) => meal.gains[key]);

  return (
    <>
      {gains.length > 0 && (
        <section className="meals-section">
          <h3 className="meals-section-title">Przyrost</h3>
          <ul className="meals-gains">
            {gains.map(({ key, label }) => {
              const gain = meal.gains[key]!;
              const count = steps[key] ?? 0;
              return (
                <li key={key} className="meals-gain">
                  <span className="meals-gain-label">{label}</span>
                  <span className="meals-gain-controls">
                    <button
                      type="button"
                      className="meals-gain-button"
                      onClick={() => onStep(key, -1)}
                      disabled={count <= 0}
                      aria-label={`${label}: mniej`}
                    >
                      −
                    </button>
                    <span className="meals-gain-count">
                      {count} / {gain.max}
                    </span>
                    <button
                      type="button"
                      className="meals-gain-button"
                      onClick={() => onStep(key, 1)}
                      disabled={count >= gain.max}
                      aria-label={`${label}: więcej`}
                    >
                      +
                    </button>
                  </span>
                  <span className="meals-gain-items">
                    krok:{" "}
                    {gain.items
                      .map((item) => {
                        const name = ingredients.find((i) => i.product.id === item.productId)?.product.name;
                        return `+${number.format(item.grams)} g ${name ?? item.productId}`;
                      })
                      .join(", ")}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="meals-section">
        <h3 className="meals-section-title">Składniki</h3>
        <div className="meals-ingredients-wrap">
          <table className="meals-ingredients">
            <thead>
              <tr>
                <th className="meals-ingredients-name">Produkt</th>
                <th>g</th>
                <th>kcal</th>
                {MACROS_ON_CARD.map((key) => (
                  <th key={key}>{nutrientShort(key)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ingredients.map((ingredient) => {
                const added = ingredient.grams - (base.get(ingredient.product.id) ?? ingredient.grams);
                return (
                  <tr key={ingredient.product.id}>
                    <th scope="row" className="meals-ingredients-name">
                      {ingredient.product.name}
                    </th>
                    <td className={added > 0 ? "is-sorted" : undefined}>
                      {number.format(ingredient.grams)}
                      {added > 0 && <span className="meals-added"> (+{number.format(added)})</span>}
                    </td>
                    <td>{number.format(ingredientAmount(ingredient, "kcal"))}</td>
                    {MACROS_ON_CARD.map((key) => (
                      <td key={key}>{number.format(ingredientAmount(ingredient, key))}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" className="meals-ingredients-name">
                  Razem
                </th>
                <td>{number.format(ingredients.reduce((sum, i) => sum + i.grams, 0))}</td>
                <td>{number.format(totals.kcal)}</td>
                {MACROS_ON_CARD.map((key) => (
                  <td key={key}>{number.format(totals[key])}</td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="meals-section meals-nutrients">
        {NUTRIENT_GROUPS.map(({ group, label }) => (
          <div key={group}>
            <h3 className="meals-section-title">{label}</h3>
            <dl className="meals-nutrient-list">
              {NUTRIENTS.filter((n) => n.group === group).map((n) => (
                <div key={n.key}>
                  <dt>{n.label}</dt>
                  <dd>
                    {number.format(totals[n.key])} {n.unit}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        <p className="meals-note">Brak danych o składniku liczy się jako 0.</p>
      </section>

      <section className="meals-section">
        <h3 className="meals-section-title">Przepis</h3>
        {meal.recipe === null ? (
          <p className="meals-note">Brak przepisu.</p>
        ) : isRecipeLink(meal.recipe) ? (
          <a href={meal.recipe.trim()} target="_blank" rel="noreferrer" className="meals-recipe-link">
            Otwórz przepis ↗
          </a>
        ) : (
          <p className="meals-recipe">{meal.recipe}</p>
        )}
      </section>
    </>
  );
}
