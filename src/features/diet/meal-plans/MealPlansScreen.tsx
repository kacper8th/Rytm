import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { number } from "../meals/MealDetails";
import {
  getMealPlanVariants,
  planTotals,
  PLAN_NAME_MAX,
  rememberedVariantId,
  rememberVariant,
  renamePlan,
  TARGET_TOLERANCE,
  type MealPlan,
} from "./meal-plans";
import { PlanCardSummary, PlanItems } from "./PlanItems";
import { PlanEditor } from "./PlanEditor";
import { exportMealPlanVariant } from "./meal-plans-export";
import { downloadFile } from "../../../shared/csv";
import { toIsoDate } from "../../../shared/dates";
import { slugify } from "../../../shared/text";
import { ExportButton } from "../../../shared/ui/ExportButton";
import { ImportButton } from "../../../shared/ui/ImportButton";
import { checkMealPlansFile } from "./meal-plans-import";
import "./MealPlansScreen.css";

/** Saving a new name; on error the form stays open so the user can retry. */
type Saving = { status: "idle" } | { status: "saving" } | { status: "error"; message: string };

export function MealPlansScreen() {
  const variants = getMealPlanVariants();
  const [variantId, setVariantId] = useState(rememberedVariantId() ?? variants[0]?.id ?? "");
  const [openId, setOpenId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState<Saving>({ status: "idle" });

  const variant = variants.find((v) => v.id === variantId) ?? variants[0];
  const totals = useMemo(
    () => new Map((variant?.plans ?? []).map((plan) => [plan.id, planTotals(plan)])),
    [variant],
  );

  if (!variant) {
    return (
      <div className="meal-plans page-wide">
        <PlansHeader count={0}>
          <ImportButton id="meal-plans" check={checkMealPlansFile} />
        </PlansHeader>
        <p className="meals-empty">Brak jadłospisów.</p>
      </div>
    );
  }

  const openPlan = variant.plans.find((plan) => plan.id === openId) ?? null;

  function open(planId: string | null) {
    setOpenId(planId);
    setRenaming(false);
    setEditing(false);
    setSaving({ status: "idle" });
  }

  async function saveName(plan: MealPlan, name: string) {
    setSaving({ status: "saving" });
    try {
      await renamePlan(plan.id, name);
      setRenaming(false);
      setSaving({ status: "idle" });
    } catch (error) {
      setSaving({ status: "error", message: (error as Error).message });
    }
  }

  const details = (plan: MealPlan) =>
    editing ? (
      <PlanEditor key={plan.id} plan={plan} targetKcal={variant.targetKcal} onClose={() => setEditing(false)} />
    ) : (
      <>
        {renaming ? (
          <NameForm
            initial={plan.name}
            saving={saving}
            onSave={(name) => void saveName(plan, name)}
            onCancel={() => {
              setRenaming(false);
              setSaving({ status: "idle" });
            }}
          />
        ) : (
          <div className="plans-actions">
            <button type="button" className="plans-button" onClick={() => setRenaming(true)}>
              Zmień nazwę
            </button>
            <button type="button" className="plans-button" onClick={() => setEditing(true)}>
              Edytuj
            </button>
          </div>
        )}
        <PlanItems key={plan.id} items={plan.items} />
      </>
    );

  return (
    <div className="meal-plans page-wide">
      <PlansHeader count={variant.plans.length}>
        <ExportButton
          onExport={() =>
            downloadFile(`jadlospisy-${slugify(variant.name)}-${toIsoDate(new Date())}.csv`, exportMealPlanVariant(variant))
          }
        />
        <ImportButton id="meal-plans" check={checkMealPlansFile} />
      </PlansHeader>

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
            rememberVariant(e.target.value);
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
            const isOpen = openId === plan.id;
            return (
              <li key={plan.id} className={"meals-item" + (isOpen ? " is-open" : "")}>
                <button
                  type="button"
                  className="meals-item-summary"
                  aria-expanded={isOpen}
                  onClick={() => open(isOpen ? null : plan.id)}
                >
                  <PlanCardSummary title={plan.name} totals={totals.get(plan.id)!} targetKcal={variant.targetKcal} />
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
              <h2 className="meals-panel-title">{openPlan.name}</h2>
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

function PlansHeader({ count, children }: { count: number; children?: ReactNode }) {
  return (
    <header className="meals-header">
      <Link to="/diet" className="meals-back">
        ← Dieta
      </Link>
      <h1 className="meals-title">Jadłospisy</h1>
      <p className="meals-count">{count} jadłospisów</p>
      {children}
    </header>
  );
}
