import { request } from "../../shared/api";
import type { MealPlan, MealPlanItem, MealPlanVariant } from "./meal-plans/meal-plans";
import type { Meal } from "./meals/meals";
import type { Product } from "./products/products";

/**
 * Diet base — products, meals and meal plans, stored in D1 (/api/diet-base).
 * Loaded once per app session; after that the module functions (getProducts, getMeals, getMealPlanVariants)
 * read it synchronously. Diet screens are shown inside DietBaseGate, which loads it first.
 * See documentation: Modules/Diet/Decision 005 - Diet data in the database.
 */
export type DietBase = {
  products: Product[];
  meals: Meal[];
  variants: MealPlanVariant[];
};

type Indexed = DietBase & {
  productsById: Map<string, Product>;
  mealsById: Map<string, Meal>;
};

let base: Indexed | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function setBase(next: DietBase, loaded: boolean) {
  if (loaded) loadCount++;
  base = {
    ...next,
    productsById: new Map(next.products.map((p) => [p.id, p])),
    mealsById: new Map(next.meals.map((m) => [m.id, m])),
  };
  listeners.forEach((listener) => listener());
}

/** Number of loads from the server — DietBaseGate shows the screen anew after a load (e.g. after an import). */
let loadCount = 0;
export const dietBaseLoadCount = () => loadCount;
export function subscribeDietBase(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const isDietBaseLoaded = () => base !== null;

/** Loads the base from the server; `force` loads it again (after an import). */
export function loadDietBase(force = false): Promise<void> {
  if (base && !force) return Promise.resolve();
  if (loading && !force) return loading;
  loading = request("/api/diet-base")
    .then((response) => response.json() as Promise<DietBase>)
    .then((loaded) => setBase(loaded, true))
    .finally(() => {
      loading = null;
    });
  return loading;
}

/** The loaded base. Only used inside DietBaseGate, so it is always loaded there. */
export function dietBase(): Indexed {
  if (!base) throw new Error("Diet base not loaded — the screen must be inside DietBaseGate.");
  return base;
}

/** Puts the changed plan lists of the variants into the loaded base (after a save on the server). */
function updatePlansInBase(change: (variant: MealPlanVariant) => MealPlan[]) {
  const current = dietBase();
  setBase({ ...current, variants: current.variants.map((v) => ({ ...v, plans: change(v) })) }, false);
}

/** Puts changed fields of one meal plan into the loaded base. */
const updatePlanInBase = (planId: string, change: Partial<Pick<MealPlan, "name" | "items">>) =>
  updatePlansInBase((v) => v.plans.map((p) => (p.id === planId ? { ...p, ...change } : p)));

/** After a rename on the server. */
export const setPlanNameInBase = (planId: string, name: string) => updatePlanInBase(planId, { name });

/** After an edit of the plan's items on the server. */
export const setPlanItemsInBase = (planId: string, items: MealPlanItem[]) => updatePlanInBase(planId, { items });

/** After a new plan was added on the server — at the end of its variant, as the server orders it. */
export const addPlanToBase = (variantId: string, plan: MealPlan) =>
  updatePlansInBase((v) => (v.id === variantId ? [...v.plans, plan] : v.plans));

/** After a plan was deleted on the server. */
export const removePlanFromBase = (planId: string) => updatePlansInBase((v) => v.plans.filter((p) => p.id !== planId));

/** Where the user's saved data uses items of the base — for an import that replaces data (GET /api/diet-base/usage). */
export type DietUsage = {
  pantry: string[];
  /** product id → number of shopping lists */
  shoppingLists: Record<string, number>;
  /** id → number of week plan days */
  weekDays: { products: Record<string, number>; meals: Record<string, number>; plans: Record<string, number> };
};

export async function getDietUsage(): Promise<DietUsage> {
  const response = await request("/api/diet-base/usage");
  return (await response.json()) as DietUsage;
}
