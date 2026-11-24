import { useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { number } from "../meals/MealDetails";
import {
  copyName,
  deletePlan,
  getMealPlanVariants,
  planTotals,
  PLAN_NAME_MAX,
  rememberedVariantId,
  rememberVariant,
  renamePlan,
  TARGET_TOLERANCE,
  type MealPlan,
  type MealPlanItem,
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

/** Start of a new plan: empty or a copy; `key` starts the editor anew on each "Nowy jadłospis" / "Kopiuj". */
type NewDraft = { key: number; name: string; items: readonly MealPlanItem[] };

export function MealPlansScreen() {
  const variants = getMealPlanVariants();
  const [variantId, setVariantId] = useState(rememberedVariantId() ?? variants[0]?.id ?? "");
  const [openId, setOpenId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState<Saving>({ status: "idle" });
  const [newDraft, setNewDraft] = useState<NewDraft | null>(null);
  const draftCount = useRef(0);
  /** Deleting the opened plan; on error the details stay open with the message. */
  const [deleting, setDeleting] = useState<Saving>({ status: "idle" });

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

  /** Opens a plan (or none); closes the rename form, the editor and a new plan's draft without saving. */
  function open(planId: string | null) {
    setOpenId(planId);
    setRenaming(false);
    setEditing(false);
    setSaving({ status: "idle" });
    setDeleting({ status: "idle" });
    setNewDraft(null);
  }

  /** "Nowy jadłospis" (empty) or "Kopiuj" (the plan's items): closes the opened plan and opens a draft. */
  function startNew(name: string, items: readonly MealPlanItem[]) {
    open(null);
    draftCount.current += 1;
    setNewDraft({ key: draftCount.current, name, items });
  }

  async function removePlan(plan: MealPlan) {
    if (!window.confirm(`Usunąć jadłospis „${plan.name}”? Nie da się tego cofnąć w aplikacji.`)) return;
    setDeleting({ status: "saving" });
    try {
      await deletePlan(plan.id);
      open(null);
    } catch (error) {
      setDeleting({ status: "error", message: (error as Error).message });
    }
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

  const busyDeleting = deleting.status === "saving";

  /** Draft of a new plan in the selected variant; after a save the new plan opens. */
  const newEditor = (draft: NewDraft) => (
    <PlanEditor
      key={draft.key}
      mode="new"
      variantId={variant.id}
      name={draft.name}
      items={draft.items}
      targetKcal={variant.targetKcal}
      onClose={() => setNewDraft(null)}
      onCreated={(plan) => open(plan.id)}
    />
  );

  const details = (plan: MealPlan) =>
    editing ? (
      <PlanEditor key={plan.id} mode="edit" plan={plan} targetKcal={variant.targetKcal} onClose={() => setEditing(false)} />
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
            <button type="button" className="plans-button" disabled={busyDeleting} onClick={() => setRenaming(true)}>
              Zmień nazwę
            </button>
            <button type="button" className="plans-button" disabled={busyDeleting} onClick={() => setEditing(true)}>
              Edytuj
            </button>
            <button
              type="button"
              className="plans-button"
              disabled={busyDeleting}
              onClick={() => startNew(copyName(plan.name), plan.items)}
            >
              Kopiuj
            </button>
            <button type="button" className="plans-button" disabled={busyDeleting} onClick={() => void removePlan(plan)}>
              {busyDeleting ? "Usuwanie…" : "Usuń jadłospis"}
            </button>
          </div>
        )}
        {deleting.status === "error" && (
          <p className="plans-status is-error" role="alert">
            Nie udało się usunąć. {deleting.message}
          </p>
        )}
        <PlanItems key={plan.id} items={plan.items} />
      </>
    );

  return (
    <div className="meal-plans page-wide">
      <PlansHeader count={variant.plans.length}>
        <button type="button" className="plans-button plans-new-button" onClick={() => startNew("", [])}>
          Nowy jadłospis
        </button>
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

      {variant.plans.length === 0 && !newDraft && <p className="meals-empty">Brak jadłospisów w tym wariancie.</p>}

      <div className="meals-layout">
        <ul className="meals-list">
          {/* phone: a new plan's draft above the plan cards */}
          {newDraft && (
            <li className="meals-item is-open plans-new-item">
              <div className="meals-details meals-details-inline">
                <h2 className="meals-section-title plans-new-title">Nowy jadłospis</h2>
                {newEditor(newDraft)}
              </div>
            </li>
          )}
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
          {newDraft ? (
            <div className="meals-details">
              <h2 className="meals-panel-title">Nowy jadłospis</h2>
              {newEditor(newDraft)}
            </div>
          ) : openPlan ? (
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
