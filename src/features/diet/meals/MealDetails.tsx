import { NUTRIENT_GROUPS, NUTRIENTS, type NutrientKey } from "../products/products";
import {
  GAIN_MACROS,
  ingredientAmount,
  isRecipeLink,
  mealIngredients,
  mealTotals,
  type GainMacro,
  type GainSteps,
  type Meal,
} from "./meals";
import "./MealsScreen.css";

/** Display helpers shared by the diet screens. */
export const number = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 });

export const MACROS_ON_CARD = ["protein", "fat", "carbs"] as const;

export function nutrientShort(key: NutrientKey): string {
  return NUTRIENTS.find((n) => n.key === key)!.short;
}

type MealDetailsProps = {
  meal: Meal;
  steps: GainSteps;
  /** Without it the gain steps are read-only (e.g. fixed by a meal plan) and only steps above 0 are shown. */
  onStep?: (key: GainMacro, change: number) => void;
  /** true = nutrient totals without vitamins and minerals. */
  macrosOnly?: boolean;
};

/** Gain, ingredient table, nutrient totals and recipe of one meal — used by Meals and Meal plans. */
export function MealDetails({ meal, steps, onStep, macrosOnly = false }: MealDetailsProps) {
  const base = new Map(meal.ingredients.map((item) => [item.productId, item.grams]));
  const ingredients = mealIngredients(meal, steps);
  const totals = mealTotals(ingredients);
  const gains = GAIN_MACROS.filter(({ key }) => meal.gains[key] && (onStep || (steps[key] ?? 0) > 0));
  const groups = macrosOnly ? NUTRIENT_GROUPS.filter(({ group }) => group === "macro") : NUTRIENT_GROUPS;

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
                  {onStep ? (
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
                  ) : (
                    <span className="meals-gain-count">+{count}</span>
                  )}
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
        {groups.map(({ group, label }) => (
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
        {!macrosOnly && <p className="meals-note">Brak danych o składniku liczy się jako 0.</p>}
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
