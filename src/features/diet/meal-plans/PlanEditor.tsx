import { useMemo, useState } from "react";
import { matchesWords } from "../../../shared/text";
import { MACROS_ON_CARD, MealDetails, nutrientShort, number } from "../meals/MealDetails";
import {
  getMeals,
  MEAL_TAGS,
  mealIngredients,
  mealTotals,
  type GainMacro,
  type GainSteps,
  type Meal,
  type MealTag,
} from "../meals/meals";
import { getProducts, productMatches, type Product } from "../products/products";
import {
  canAddItem,
  createPlan,
  findPlanMeal,
  ITEM_GRAMS_MAX,
  itemsTotals,
  MEAL_TYPES,
  mealTypeLabel,
  PLAN_NAME_MAX,
  savePlanItems,
  type MealPlan,
  type MealPlanItem,
  type MealType,
} from "./meal-plans";
import { ItemSummary, PlanCardSummary } from "./PlanItems";
import "./MealPlansScreen.css";

/**
 * Edit mode of one meal plan: gain steps of a meal, swap a meal or a product, product grams, add and remove items.
 * Changes go into a draft; "Zapisz" saves the whole draft. See documentation: Modules/Diet/Meal plans → Edit.
 * The same editor makes a new plan (empty or a copy) with a name field — Meal plans → New.
 */

type Saving = { status: "idle" } | { status: "saving" } | { status: "error"; message: string };

/** An item of the draft with a key that stays the same while items are added and removed. */
type DraftItem = { key: number; item: MealPlanItem };

/** What replaces the item list: a list for swapping one item, or the steps of adding a new one. */
type Picker =
  | { mode: "swap"; key: number }
  | { mode: "add-type" }
  | { mode: "add-kind"; mealType: MealType }
  | { mode: "add"; mealType: MealType; kind: MealPlanItem["kind"] }
  | null;

/** Saved items of a new plan — none; one constant so the memo of the saved totals keeps. */
const EMPTY_ITEMS: readonly MealPlanItem[] = [];

/** Grams of a product added in the editor, changed afterwards in its grams field. */
const NEW_PRODUCT_GRAMS = 100;

type PlanEditorProps = {
  targetKcal: number;
  /** Called after a cancel, and after a save of an existing plan. */
  onClose: () => void;
} & (
  | { mode: "edit"; plan: MealPlan }
  | {
      mode: "new";
      variantId: string;
      /** Start of the draft: empty, or the name and items of the copied plan. */
      name: string;
      items: readonly MealPlanItem[];
      /** Called after the new plan was saved. */
      onCreated: (plan: MealPlan) => void;
    }
);

/** Grams typed by the user: a number > 0 and ≤ ITEM_GRAMS_MAX, decimal comma allowed; otherwise null. */
function parseGrams(text: string): number | null {
  const value = Number(text.trim().replace(",", "."));
  return text.trim() !== "" && Number.isFinite(value) && value > 0 && value <= ITEM_GRAMS_MAX ? value : null;
}

/** Steps with zeros left out — the shape the server saves, so an unchanged draft equals the saved plan. */
function withStep(steps: GainSteps, key: GainMacro, change: number): GainSteps {
  const next = { ...steps, [key]: (steps[key] ?? 0) + change };
  if (!next[key]) delete next[key];
  return next;
}

export function PlanEditor(props: PlanEditorProps) {
  const { targetKcal, onClose } = props;
  const isNew = props.mode === "new";
  /** The saved items the draft is compared with; a new plan has none. */
  const savedItems = props.mode === "edit" ? props.plan.items : EMPTY_ITEMS;
  const startItems = props.mode === "edit" ? props.plan.items : props.items;
  const [draft, setDraft] = useState<DraftItem[]>(() => startItems.map((item, key) => ({ key, item })));
  const [nextKey, setNextKey] = useState(startItems.length);
  const [name, setName] = useState(props.mode === "new" ? props.name : "");
  /** Grams as typed, per item key — kept apart from the draft so a half-typed value is not lost. */
  const [gramsText, setGramsText] = useState<Record<number, string>>({});
  const [openKey, setOpenKey] = useState<number | null>(null);
  const [picker, setPicker] = useState<Picker>(null);
  const [saving, setSaving] = useState<Saving>({ status: "idle" });

  const items = draft.map((d) => d.item);
  const busy = saving.status === "saving";
  const invalid = draft.some(({ key }) => gramsText[key] !== undefined && parseGrams(gramsText[key]) === null);
  const changed = JSON.stringify(items) !== JSON.stringify(savedItems);
  const trimmedName = name.trim();
  /** An edit saves only a change; a new plan needs a name and at least one item. */
  const canSave = !busy && !invalid && (isNew ? trimmedName !== "" && items.length > 0 : changed);
  const totals = itemsTotals(items);
  const savedTotals = useMemo(() => itemsTotals(savedItems), [savedItems]);

  /** Items in meal-type order; items of the same type keep their order. */
  const ordered = [...draft].sort((a, b) => typeIndex(a.item.mealType) - typeIndex(b.item.mealType));
  const addableTypes = MEAL_TYPES.filter(({ key }) => canAddItem(items, key, "meal") || canAddItem(items, key, "product"));

  function replaceItem(key: number, item: MealPlanItem) {
    setDraft((current) => current.map((d) => (d.key === key ? { key, item } : d)));
  }

  function addItem(item: MealPlanItem) {
    setDraft((current) => [...current, { key: nextKey, item }]);
    if (item.kind === "meal") setOpenKey(nextKey);
    setNextKey((key) => key + 1);
  }

  /** Removes the item from the draft (and its typed grams); "Anuluj" of the whole draft brings it back. */
  function removeItem(key: number) {
    setDraft((current) => current.filter((d) => d.key !== key));
    setGramsText(({ [key]: _removed, ...rest }) => rest);
  }

  function changeGrams(key: number, item: Extract<MealPlanItem, { kind: "product" }>, text: string) {
    setGramsText((texts) => ({ ...texts, [key]: text }));
    const grams = parseGrams(text);
    if (grams !== null) replaceItem(key, { ...item, grams });
  }

  async function save() {
    setSaving({ status: "saving" });
    try {
      if (props.mode === "new") {
        props.onCreated(await createPlan(props.variantId, trimmedName, items));
      } else {
        await savePlanItems(props.plan.id, items);
        onClose();
      }
    } catch (error) {
      setSaving({ status: "error", message: (error as Error).message });
    }
  }

  // ---- lists that replace the items: swap one item, or add a new one ----

  if (picker?.mode === "swap") {
    const entry = draft.find((d) => d.key === picker.key);
    if (!entry) return null;
    const { key, item } = entry;
    return item.kind === "meal" ? (
      <MealPicker
        title="Zmień danie"
        mealType={item.mealType}
        currentId={item.mealId}
        onPick={(meal, steps) => {
          replaceItem(key, { ...item, mealId: meal.id, steps });
          setPicker(null);
          setOpenKey(key);
        }}
        onCancel={() => setPicker(null)}
      />
    ) : (
      <ProductPicker
        title="Zmień produkt"
        mealType={item.mealType}
        currentId={item.productId}
        onPick={(product) => {
          replaceItem(key, { ...item, productId: product.id });
          setPicker(null);
        }}
        onCancel={() => setPicker(null)}
      />
    );
  }

  if (picker?.mode === "add-type") {
    return (
      <ChoiceList
        title="Dodaj pozycję"
        hint="Typ posiłku"
        options={addableTypes.map(({ key, label }) => ({ key, label }))}
        onPick={(mealType) =>
          setPicker(
            canAddItem(items, mealType, "product") ? { mode: "add-kind", mealType } : { mode: "add", mealType, kind: "meal" },
          )
        }
        onCancel={() => setPicker(null)}
      />
    );
  }

  if (picker?.mode === "add-kind") {
    return (
      <ChoiceList
        title={`Dodaj pozycję: ${mealTypeLabel(picker.mealType)}`}
        hint="Rodzaj pozycji"
        options={[
          { key: "meal", label: "Danie" },
          { key: "product", label: "Produkt" },
        ]}
        onPick={(kind) => setPicker({ mode: "add", mealType: picker.mealType, kind })}
        onCancel={() => setPicker(null)}
      />
    );
  }

  if (picker?.mode === "add") {
    const { mealType } = picker;
    return picker.kind === "meal" ? (
      <MealPicker
        title="Dodaj danie"
        mealType={mealType}
        onPick={(meal, steps) => {
          addItem({ mealType, kind: "meal", mealId: meal.id, steps });
          setPicker(null);
        }}
        onCancel={() => setPicker(null)}
      />
    ) : (
      <ProductPicker
        title="Dodaj produkt"
        mealType={mealType}
        onPick={(product) => {
          addItem({ mealType, kind: "product", productId: product.id, grams: NEW_PRODUCT_GRAMS });
          setPicker(null);
        }}
        onCancel={() => setPicker(null)}
      />
    );
  }

  // ---- the draft ----

  const removeButton = (key: number) => (
    <button type="button" className="plans-button" disabled={draft.length <= 1} onClick={() => removeItem(key)}>
      Usuń
    </button>
  );

  return (
    <div className="plans-editor">
      <div className="plans-actions">
        <button type="button" className="plans-button is-primary" disabled={!canSave} onClick={() => void save()}>
          {busy ? "Zapisywanie…" : "Zapisz"}
        </button>
        <button type="button" className="plans-button" disabled={busy} onClick={onClose}>
          Anuluj
        </button>
      </div>
      {saving.status === "error" && (
        <p className="plans-status is-error" role="alert">
          Nie udało się zapisać. {saving.message}
        </p>
      )}

      {isNew && (
        <label className="plans-name-field">
          <span>Nazwa</span>
          <input
            type="text"
            className="plans-input"
            maxLength={PLAN_NAME_MAX}
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
        </label>
      )}

      <div className="plans-editor-totals">
        <PlanCardSummary title={isNew ? "Razem" : "Po zmianach"} totals={totals} targetKcal={targetKcal} />
        {!isNew && changed && <ChangeRow totals={totals} saved={savedTotals} />}
      </div>

      <ul className="plans-items">
        {ordered.map(({ key, item }) => {
          const isOpen = openKey === key;
          const meal = item.kind === "meal" ? findPlanMeal(item) : undefined;
          return (
            <li key={key} className={"plans-item" + (isOpen ? " is-open" : "")}>
              {item.kind === "meal" ? (
                <>
                  <button
                    type="button"
                    className="plans-item-summary is-clickable"
                    aria-expanded={isOpen}
                    disabled={!meal}
                    onClick={() => setOpenKey(isOpen ? null : key)}
                  >
                    <ItemSummary item={item} />
                  </button>
                  <div className="plans-item-edit">
                    <button type="button" className="plans-button" onClick={() => setPicker({ mode: "swap", key })}>
                      Zmień danie
                    </button>
                    {removeButton(key)}
                  </div>
                  {isOpen && meal && (
                    <div className="meals-details plans-item-details">
                      <MealDetails
                        meal={meal}
                        steps={item.steps}
                        macrosOnly
                        onStep={(macro, change) => replaceItem(key, { ...item, steps: withStep(item.steps, macro, change) })}
                      />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="plans-item-summary">
                    <ItemSummary item={item} />
                  </div>
                  <div className="plans-item-edit">
                    <label className="plans-grams">
                      <input
                        type="text"
                        inputMode="decimal"
                        className={
                          "plans-input" +
                          (gramsText[key] !== undefined && parseGrams(gramsText[key]) === null ? " is-invalid" : "")
                        }
                        aria-label="Gramy"
                        value={gramsText[key] ?? number.format(item.grams)}
                        onChange={(e) => changeGrams(key, item, e.target.value)}
                      />
                      <span className="meals-unit">g</span>
                    </label>
                    <button type="button" className="plans-button" onClick={() => setPicker({ mode: "swap", key })}>
                      Zmień produkt
                    </button>
                    {removeButton(key)}
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {invalid && <p className="plans-status is-error">Gramy: liczba większa od 0 (do {ITEM_GRAMS_MAX}).</p>}

      <div className="plans-actions plans-editor-add">
        <button type="button" className="plans-button" disabled={addableTypes.length === 0} onClick={() => setPicker({ mode: "add-type" })}>
          Dodaj pozycję
        </button>
      </div>
    </div>
  );
}

const typeIndex = (type: MealType) => MEAL_TYPES.findIndex((t) => t.key === type);

const signed = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1, signDisplay: "exceptZero" });

/** Values shown in the change row: kcal, then the macros of a plan card. */
const CHANGE_KEYS = ["kcal", ...MACROS_ON_CARD, "fiber"] as const;

type Totals = ReturnType<typeof itemsTotals>;

/** Difference of the draft from the saved plan: kcal and macros; up in green, down in red (by the shown, rounded value). */
function ChangeRow({ totals, saved }: { totals: Totals; saved: Totals }) {
  return (
    <span className="meals-item-macros plans-change">
      <span>Zmiana:</span>
      {CHANGE_KEYS.map((key) => {
        const diff = Math.round((totals[key] - saved[key]) * 10) / 10;
        const shown = signed.format(diff);
        const direction = diff > 0 ? "is-up" : diff < 0 ? "is-down" : undefined;
        return (
          <span key={key} className={direction}>
            {key === "kcal" ? `${shown} kcal` : `${nutrientShort(key)} ${shown} g`}
          </span>
        );
      })}
    </span>
  );
}

function PickerHeader({ title, onCancel }: { title: string; onCancel: () => void }) {
  return (
    <div className="plans-picker-header">
      <h3 className="meals-section-title">{title}</h3>
      <button type="button" className="plans-button" onClick={onCancel}>
        Anuluj
      </button>
    </div>
  );
}

type ChoiceListProps<K extends string> = {
  title: string;
  hint: string;
  options: { key: K; label: string }[];
  onPick: (key: K) => void;
  onCancel: () => void;
};

/** A short list of choices (meal type, meal or product) while adding an item. */
function ChoiceList<K extends string>({ title, hint, options, onPick, onCancel }: ChoiceListProps<K>) {
  return (
    <div className="plans-picker">
      <PickerHeader title={title} onCancel={onCancel} />
      <p className="meals-note">{hint}</p>
      <ul className="plans-items">
        {options.map(({ key, label }) => (
          <li key={key} className="plans-item">
            <button type="button" className="plans-item-summary is-clickable" onClick={() => onPick(key)}>
              <span className="plans-item-name">{label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

type MealPickerProps = {
  title: string;
  mealType: MealType;
  /** The meal of the item being swapped; none when adding. */
  currentId?: string;
  onPick: (meal: Meal, steps: GainSteps) => void;
  onCancel: () => void;
};

/** Filter of the meal list: one tag, "all", or nothing chosen yet (also all meals). */
type MealFilter = MealTag | "all" | null;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Meals with filter buttons (tags / all, none chosen at first) and search by name; a tap opens a preview with gain steps from 0. */
function MealPicker({ title, mealType, currentId, onPick, onCancel }: MealPickerProps) {
  const [filter, setFilter] = useState<MealFilter>(null);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [steps, setSteps] = useState<GainSteps>({});

  const meals = getMeals().filter(
    (meal) => (filter === null || filter === "all" || meal.tags.includes(filter)) && matchesWords(meal.name, query),
  );
  const filters: { key: Exclude<MealFilter, null>; label: string }[] = [
    ...MEAL_TAGS.map((tag) => ({ key: tag, label: capitalize(tag) })),
    { key: "all", label: "Wszystkie dania" },
  ];

  return (
    <div className="plans-picker">
      <PickerHeader title={`${title}: ${mealTypeLabel(mealType)}`} onCancel={onCancel} />
      <input
        type="search"
        className="plans-input plans-picker-search"
        placeholder="Szukaj dania"
        aria-label="Szukaj dania"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="plans-picker-filters" role="group" aria-label="Filtr dań">
        {filters.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={"plans-filter" + (filter === key ? " is-active" : "")}
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {meals.length === 0 && <p className="meals-note">Brak dań.</p>}
      <ul className="plans-items">
        {meals.map((meal) => {
          const isOpen = openId === meal.id;
          return (
            <li key={meal.id} className={"plans-item" + (isOpen ? " is-open" : "")}>
              <button
                type="button"
                className="plans-item-summary is-clickable"
                aria-expanded={isOpen}
                onClick={() => {
                  setOpenId(isOpen ? null : meal.id);
                  setSteps({});
                }}
              >
                <OptionSummary
                  name={meal.name}
                  note={meal.id === currentId ? "obecnie w jadłospisie" : undefined}
                  totals={mealTotals(mealIngredients(meal, isOpen ? steps : {}))}
                />
              </button>
              {isOpen && (
                <div className="meals-details plans-item-details">
                  <div className="plans-actions">
                    <button type="button" className="plans-button is-primary" onClick={() => onPick(meal, steps)}>
                      Wybierz
                    </button>
                  </div>
                  <MealDetails
                    meal={meal}
                    steps={steps}
                    macrosOnly
                    onStep={(key, change) => setSteps((current) => withStep(current, key, change))}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type ProductPickerProps = {
  title: string;
  mealType: MealType;
  /** The product of the item being swapped; none when adding. */
  currentId?: string;
  onPick: (product: Product) => void;
  onCancel: () => void;
};

/** Products with search by name; values per 100 g. */
function ProductPicker({ title, mealType, currentId, onPick, onCancel }: ProductPickerProps) {
  const [query, setQuery] = useState("");
  const products = useMemo(() => getProducts().filter((p) => productMatches(p, query)), [query]);

  return (
    <div className="plans-picker">
      <PickerHeader title={`${title}: ${mealTypeLabel(mealType)}`} onCancel={onCancel} />
      <input
        type="search"
        className="plans-input plans-picker-search"
        placeholder="Szukaj produktu"
        aria-label="Szukaj produktu"
        value={query}
        autoFocus
        onChange={(e) => setQuery(e.target.value)}
      />
      <p className="meals-note">Wartości na 100 g.</p>
      {products.length === 0 && <p className="meals-note">Brak produktów.</p>}
      <ul className="plans-items">
        {products.map((product) => (
          <li key={product.id} className="plans-item">
            <button type="button" className="plans-item-summary is-clickable" onClick={() => onPick(product)}>
              <OptionSummary
                name={product.brand ? `${product.name} (${product.brand})` : product.name}
                note={product.id === currentId ? "obecnie w jadłospisie" : undefined}
                totals={mealTotals([{ product, grams: 100 }])}
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

type OptionSummaryProps = { name: string; note?: string; totals: Totals };

/** One row of a picker list: name, kcal, macros. */
function OptionSummary({ name, note, totals }: OptionSummaryProps) {
  return (
    <>
      <span className="plans-item-name">
        {name}
        {note && <span className="meals-unit"> · {note}</span>}
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
