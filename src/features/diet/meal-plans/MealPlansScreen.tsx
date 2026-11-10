import { useMemo, useState } from "react";
import { Link } from "react-router";
import { number } from "../meals/MealDetails";
import { getMealPlanVariants, planName, planTotals, PLAN_NAME_MAX, renamePlan, TARGET_TOLERANCE, type MealPlan } from "./meal-plans";
import { PlanCardSummary, PlanItems } from "./PlanItems";
import { usePlanNames } from "./usePlanNames";
import "./MealPlansScreen.css";

/** Saving a new name; on error the form stays open so the user can retry. */
type Saving = { status: "idle" } | { status: "saving" } | { status: "error"; message: string };

export function MealPlansScreen() {
  const variants = getMealPlanVariants();
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [openNumber, setOpenNumber] = useState<number | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [saving, setSaving] = useState<Saving>({ status: "idle" });
  const { names, error: namesError, reload: reloadNames, setNames } = usePlanNames();

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
  const nameOf = (plan: MealPlan) => planName(names, variant.id, plan.number);

  function open(planNumber: number | null) {
    setOpenNumber(planNumber);
    setRenaming(false);
    setSaving({ status: "idle" });
  }

  async function saveName(plan: MealPlan, name: string) {
    if (!names) return;
    setSaving({ status: "saving" });
    try {
      setNames(await renamePlan(names, variant!.id, plan.number, name));
      setRenaming(false);
      setSaving({ status: "idle" });
    } catch (error) {
      setSaving({ status: "error", message: (error as Error).message });
    }
  }

  const details = (plan: MealPlan) => (
    <>
      {renaming ? (
        <NameForm
          initial={nameOf(plan)}
          saving={saving}
          onSave={(name) => void saveName(plan, name)}
          onCancel={() => {
            setRenaming(false);
            setSaving({ status: "idle" });
          }}
        />
      ) : (
        <div className="plans-actions">
          {/* names must be loaded: a rename replaces the whole loaded set */}
          <button type="button" className="plans-button" disabled={!names} onClick={() => setRenaming(true)}>
            Zmień nazwę
          </button>
        </div>
      )}
      <PlanItems key={plan.number} items={plan.items} />
    </>
  );

  return (
    <div className="meal-plans page-wide">
      <PlansHeader count={variant.plans.length} />

      {namesError && (
        <div className="plans-status is-error" role="alert">
          <span>Nie udało się wczytać nazw jadłospisów. {namesError}</span>
          <button type="button" className="plans-button" onClick={reloadNames}>
            Spróbuj ponownie
          </button>
        </div>
      )}

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
            open(null);
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
                  onClick={() => open(isOpen ? null : plan.number)}
                >
                  <PlanCardSummary title={nameOf(plan)} totals={totals.get(plan.number)!} targetKcal={variant.targetKcal} />
                </button>

                {/* phone: details under the card */}
                {isOpen && <div className="meals-details meals-details-inline">{details(plan)}</div>}
              </li>
            );
          })}
        </ul>

        {/* PC: details of the selected plan next to the list */}
        <aside className="meals-panel">
          {openPlan ? (
            <div className="meals-details">
              <h2 className="meals-panel-title">{nameOf(openPlan)}</h2>
              {details(openPlan)}
            </div>
          ) : (
            <p className="meals-panel-empty">Wybierz jadłospis z listy.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

type NameFormProps = {
  initial: string;
  saving: Saving;
  onSave: (name: string) => void;
  onCancel: () => void;
};

/** Name of one plan; an empty name cannot be saved — every plan always has a name. */
function NameForm({ initial, saving, onSave, onCancel }: NameFormProps) {
  const [name, setName] = useState(initial);
  const trimmed = name.trim();
  const busy = saving.status === "saving";

  return (
    <form
      className="plans-name-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (trimmed && !busy) onSave(trimmed);
      }}
    >
      <label className="plans-name-field">
        <span>Nazwa jadłospisu</span>
        <input
          type="text"
          className="plans-input"
          maxLength={PLAN_NAME_MAX}
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <div className="plans-actions">
        <button type="submit" className="plans-button is-primary" disabled={busy || !trimmed}>
          {busy ? "Zapisywanie…" : "Zapisz"}
        </button>
        <button type="button" className="plans-button" disabled={busy} onClick={onCancel}>
          Anuluj
        </button>
      </div>
      {saving.status === "error" && (
        <p className="plans-status is-error" role="alert">
          Nie udało się zapisać. {saving.message}
        </p>
      )}
    </form>
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
