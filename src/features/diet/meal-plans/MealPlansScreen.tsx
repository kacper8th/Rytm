import { useMemo, useState } from "react";
import { Link } from "react-router";
import { number } from "../meals/MealDetails";
import { getMealPlanVariants, planTotals, TARGET_TOLERANCE } from "./meal-plans";
import { PlanCardSummary, PlanItems } from "./PlanItems";
import "./MealPlansScreen.css";

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
            return (
              <li key={plan.number} className={"meals-item" + (isOpen ? " is-open" : "")}>
                <button
                  type="button"
                  className="meals-item-summary"
                  aria-expanded={isOpen}
                  onClick={() => setOpenNumber(isOpen ? null : plan.number)}
                >
                  <PlanCardSummary
                    title={`Jadłospis ${plan.number}`}
                    totals={totals.get(plan.number)!}
                    targetKcal={variant.targetKcal}
                  />
                </button>

                {/* phone: details under the card */}
                {isOpen && (
                  <div className="meals-details meals-details-inline">
                    <PlanItems items={plan.items} />
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
              <PlanItems key={openPlan.number} items={openPlan.items} />
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
