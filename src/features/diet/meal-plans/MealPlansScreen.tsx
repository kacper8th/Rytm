import { useMemo, useState } from "react";
import { Link } from "react-router";
import { MACROS_ON_CARD, MealDetails, nutrientShort, number } from "../meals/MealDetails";
import {
  getMealPlanVariants,
  isOffTarget,
  itemTotals,
  mealTypeLabel,
  planItems,
  planMeal,
  planProduct,
  planTotals,
  TARGET_TOLERANCE,
  type MealPlan,
  type MealPlanItem,
} from "./meal-plans";
import "./MealPlansScreen.css";

const signed = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0, signDisplay: "exceptZero" });

/** Macros on a plan card — the meal card's macros plus fibre. */
const MACROS_ON_PLAN = [...MACROS_ON_CARD, "fiber"] as const;

export function MealPlansScreen() {
  const variants = getMealPlanVariants();
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [openNumber, setOpenNumber] = useState<number | null>(null);

  const variant = variants.find((v) => v.id === variantId) ?? variants[0];
  const totals = useMemo(
    () => new Map((variant?.plans ?? []).map((plan) => [plan.number, planTotals(plan)])),
    [variant],
  );

  if (!variant) {
    return (
      <div className="meal-plans page-wide">
        <PlansHeader count={0} />
        <p className="meals-empty">Brak jadłospisów.</p>
      </div>
    );
  }

  const openPlan = variant.plans.find((plan) => plan.number === openNumber) ?? null;

  return (
    <div className="meal-plans page-wide">
      <PlansHeader count={variant.plans.length} />

      <div className="meals-sort">
        <label className="meals-sort-label" htmlFor="meal-plans-variant">
          Wariant
        </label>
        <select
          id="meal-plans-variant"
          className="meals-sort-select"
          value={variant.id}
          onChange={(e) => {
            setVariantId(e.target.value);
            setOpenNumber(null);
          }}
        >
          {variants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </div>
      <p className="plans-target">
        Cel: {number.format(variant.targetKcal)} kcal · wyróżnione: poza ±{TARGET_TOLERANCE * 100}%
      </p>

      <div className="meals-layout">
        <ul className="meals-list">
          {variant.plans.map((plan) => {
            const isOpen = openNumber === plan.number;
            const day = totals.get(plan.number)!;
            const off = isOffTarget(day.kcal, variant.targetKcal);
            return (
              <li key={plan.number} className={"meals-item" + (isOpen ? " is-open" : "")}>
                <button
                  type="button"
                  className="meals-item-summary"
                  aria-expanded={isOpen}
                  onClick={() => setOpenNumber(isOpen ? null : plan.number)}
                >
                  <span className="meals-item-name">Jadłospis {plan.number}</span>
                  <span className="meals-item-kcal">
                    {number.format(day.kcal)}
                    <span className="meals-unit"> kcal</span>
                  </span>
                  <span className="meals-item-macros">
                    {MACROS_ON_PLAN.map((key) => (
                      <span key={key}>
                        {nutrientShort(key)} {number.format(day[key])} g
                      </span>
                    ))}
                    <span className={"plans-diff" + (off ? " is-off" : "")}>
                      {signed.format(day.kcal - variant.targetKcal)} kcal
                    </span>
                  </span>
                </button>

                {/* phone: details under the card */}
                {isOpen && (
                  <div className="meals-details meals-details-inline">
                    <PlanDetails plan={plan} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* PC: details of the selected plan next to the list */}
        <aside className="meals-panel">
          {openPlan ? (
            <div className="meals-details">
              <h2 className="meals-panel-title">Jadłospis {openPlan.number}</h2>
              <PlanDetails key={openPlan.number} plan={openPlan} />
            </div>
          ) : (
            <p className="meals-panel-empty">Wybierz jadłospis z listy.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function PlansHeader({ count }: { count: number }) {
  return (
    <header className="meals-header">
      <Link to="/diet" className="meals-back">
        ← Dieta
      </Link>
      <h1 className="meals-title">Jadłospisy</h1>
      <p className="meals-count">{count} jadłospisów</p>
    </header>
  );
}

/** Items of the day in meal-type order; a meal expands on click and collapses on the next click. */
function PlanDetails({ plan }: { plan: MealPlan }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const items = planItems(plan);

  return (
    <ul className="plans-items">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const content = <ItemSummary item={item} />;
        return (
          <li key={index} className={"plans-item" + (isOpen ? " is-open" : "")}>
            {item.kind === "meal" ? (
              <>
                <button
                  type="button"
                  className="plans-item-summary is-clickable"
                  aria-expanded={isOpen}
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                >
                  {content}
                </button>
                {isOpen && (
                  <div className="meals-details plans-item-details">
                    <MealDetails meal={planMeal(item)} steps={item.steps} macrosOnly />
                  </div>
                )}
              </>
            ) : (
              <div className="plans-item-summary">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ItemSummary({ item }: { item: MealPlanItem }) {
  const totals = itemTotals(item);
  const name = item.kind === "meal" ? planMeal(item).name : planProduct(item).name;
  return (
    <>
      <span className="plans-item-type">{mealTypeLabel(item.mealType)}</span>
      <span className="plans-item-name">
        {name}
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
