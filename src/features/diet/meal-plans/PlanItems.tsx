import { useState, type ReactNode } from "react";
import { MACROS_ON_CARD, MealDetails, nutrientShort, number } from "../meals/MealDetails";
import type { NutrientKey } from "../products/products";
import {
  findPlanMeal,
  findPlanProduct,
  isOffTarget,
  itemTotals,
  mealTypeLabel,
  sortItems,
  type MealPlanItem,
} from "./meal-plans";
import "./MealPlansScreen.css";

/** Parts of a meal plan shared by Meal plans and Week plan. */

const signed = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0, signDisplay: "exceptZero" });

/** Macros on a plan card — the meal card's macros plus fibre. */
const MACROS_ON_PLAN = [...MACROS_ON_CARD, "fiber"] as const;

type PlanCardSummaryProps = {
  title: ReactNode;
  totals: Record<NutrientKey, number>;
  /** Without it no difference is shown (e.g. the variant no longer exists). */
  targetKcal?: number;
};

/** Content of a plan card (goes inside a .meals-item-summary button): title, kcal, macros, difference from the target. */
export function PlanCardSummary({ title, totals, targetKcal }: PlanCardSummaryProps) {
  return (
    <>
      <span className="meals-item-name">{title}</span>
      <span className="meals-item-kcal">
        {number.format(totals.kcal)}
        <span className="meals-unit"> kcal</span>
      </span>
      <span className="meals-item-macros">
        {MACROS_ON_PLAN.map((key) => (
          <span key={key}>
            {nutrientShort(key)} {number.format(totals[key])} g
          </span>
        ))}
        {targetKcal !== undefined && (
          <span className={"plans-diff" + (isOffTarget(totals.kcal, targetKcal) ? " is-off" : "")}>
            {signed.format(totals.kcal - targetKcal)} kcal
          </span>
        )}
      </span>
    </>
  );
}

/** Items of the day in meal-type order; a meal expands on click and collapses on the next click. */
export function PlanItems({ items }: { items: readonly MealPlanItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <ul className="plans-items">
      {sortItems(items).map((item, index) => {
        const isOpen = openIndex === index;
        const meal = item.kind === "meal" ? findPlanMeal(item) : undefined;
        return (
          <li key={index} className={"plans-item" + (isOpen ? " is-open" : "")}>
            {item.kind === "meal" && meal ? (
              <>
                <button
                  type="button"
                  className="plans-item-summary is-clickable"
                  aria-expanded={isOpen}
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                >
                  <ItemSummary item={item} />
                </button>
                {isOpen && (
                  <div className="meals-details plans-item-details">
                    <MealDetails meal={meal} steps={item.steps} macrosOnly />
                  </div>
                )}
              </>
            ) : (
              <div className="plans-item-summary">
                <ItemSummary item={item} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ItemSummary({ item }: { item: MealPlanItem }) {
  const found = item.kind === "meal" ? findPlanMeal(item) : findPlanProduct(item);
  const type = <span className="plans-item-type">{mealTypeLabel(item.mealType)}</span>;

  if (!found) {
    return (
      <>
        {type}
        <span className="plans-item-name plans-item-missing">
          Brak w bazie: {item.kind === "meal" ? item.mealId : item.productId}
        </span>
      </>
    );
  }

  const totals = itemTotals(item);
  return (
    <>
      {type}
      <span className="plans-item-name">
        {found.name}
        {item.kind === "product" && <span className="meals-unit"> · {number.format(item.grams)} g</span>}
      </span>
      <span className="meals-item-kcal">
        {number.format(totals.kcal)}
        <span className="meals-unit"> kcal</span>
      </span>
      <span className="meals-item-macros">
        {MACROS_ON_CARD.map((key) => (
          <span key={key}>
            {nutrientShort(key)} {number.format(totals[key])} g
          </span>
        ))}
      </span>
    </>
  );
}
