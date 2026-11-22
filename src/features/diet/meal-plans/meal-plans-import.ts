import { parseCsv, parseDecimal } from "../../../shared/csv";
import { getDietUsage, loadDietBase } from "../diet-base";
import {
  affectedLines,
  checkHeader,
  countSummary,
  failedCheck,
  findReference,
  IdResolver,
  ImportLog,
  type ImportCheck,
} from "../diet-import";
import { GAIN_MACROS, getMeals, type GainSteps } from "../meals/meals";
import { getProducts, type NutrientKey } from "../products/products";
import { MEAL_PLAN_COLUMNS } from "./meal-plans-export";
import {
  getMealPlanVariants,
  itemTotals,
  MEAL_TYPES,
  PLAN_NAME_MAX,
  saveMealPlans,
  type MealPlan,
  type MealPlanItem,
  type MealType,
} from "./meal-plans";

/**
 * Import of one meal plan variant from a CSV file (the export's format: one row = one item of a plan).
 * See documentation: Modules/Diet/Meal plans → Import; rules of the ID columns: Modules/Diet/Decision 005 → Import.
 */

type Column = (typeof MEAL_PLAN_COLUMNS)[number];

/** Gain step columns → key of the meal's gains. */
const GAIN_COLUMNS: [Column, (typeof GAIN_MACROS)[number]["key"]][] = [
  ["Doważanie białko", "protein"],
  ["Doważanie węgle", "carbs"],
  ["Doważanie tłuszcze", "fat"],
];

/** Values in the file compared with the app's calculation (warning only) — allowed difference. */
const CHECKED: [Column, NutrientKey, number][] = [
  ["Kalorie", "kcal", 1],
  ["Węglowodany", "carbs", 0.5],
  ["Białko", "protein", 0.5],
  ["Tłuszcz", "fat", 0.5],
  ["Błonnik", "fiber", 0.5],
];

export async function checkMealPlansFile(text: string): Promise<ImportCheck> {
  const [header, ...rows] = parseCsv(text);
  const headerError = checkHeader(header, MEAL_PLAN_COLUMNS);
  if (headerError) return failedCheck([headerError]);
  if (rows.length === 0) return failedCheck(["Plik nie ma wierszy z jadłospisami."]);
  if (rows.some((cells) => cells.length !== MEAL_PLAN_COLUMNS.length)) {
    const row = rows.findIndex((cells) => cells.length !== MEAL_PLAN_COLUMNS.length) + 2;
    return failedCheck([`Wiersz ${row}: oczekiwano ${MEAL_PLAN_COLUMNS.length} kolumn.`]);
  }

  const log = new ImportLog();
  const variants = getMealPlanVariants();
  const cellOf = (cells: string[], column: Column) => cells[MEAL_PLAN_COLUMNS.indexOf(column)].trim();

  // one file = one variant: the same variant columns in every row
  const first = rows[0];
  const variantName = cellOf(first, "Wariant");
  const rawTarget = cellOf(first, "Kalorie docelowe");
  const targetKcal = parseDecimal(rawTarget);
  if (!variantName) log.error(2, "pusty Wariant.");
  if (targetKcal === null || targetKcal === 0) log.error(2, `Kalorie docelowe muszą być liczbą większą od 0, jest „${rawTarget}”.`);
  const variantIds = new IdResolver(new Set(variants.map((v) => v.id)));
  const variantId = variantIds.resolve(cellOf(first, "ID wariantu"), variantName, log, 2, "ID wariantu");

  const planIds = new IdResolver(new Set(variants.flatMap((v) => v.plans.map((p) => p.id))));
  const plans = new Map<string, MealPlan & { firstRow: number }>();
  const meals = getMeals();
  const products = getProducts();

  rows.forEach((cells, index) => {
    const row = index + 2;
    const cell = (column: Column) => cellOf(cells, column);
    for (const column of ["ID wariantu", "Wariant", "Kalorie docelowe"] as const) {
      if (cell(column) !== cellOf(first, column)) {
        log.error(row, `${column} „${cell(column)}” różni się od wiersza 2 - jeden plik to jeden wariant.`);
      }
    }

    const planName = cell("Nazwa szablonu");
    if (!planName || planName.length > PLAN_NAME_MAX) {
      log.error(row, `Nazwa szablonu musi mieć 1–${PLAN_NAME_MAX} znaków.`);
      return;
    }
    const planId = planIds.resolve(cell("ID jadłospisu"), planName, log, row, "ID jadłospisu");
    if (!planId) return;

    const mealType = cell("Typ posiłku");
    if (!MEAL_TYPES.some((t) => t.key === mealType)) {
      log.error(row, `nieznany Typ posiłku „${mealType}”.`);
      return;
    }
    const steps: GainSteps = {};
    for (const [column, key] of GAIN_COLUMNS) {
      const count = parseDecimal(cell(column));
      if (count === null || !Number.isInteger(count)) {
        log.error(row, `${column} musi być liczbą całkowitą ≥ 0, jest „${cell(column)}”.`);
        return;
      }
      if (count > 0) steps[key] = count;
    }
    const grams = parseDecimal(cell("Waga [g]"));
    if (grams === null) {
      log.error(row, `Waga [g] musi być liczbą, jest „${cell("Waga [g]")}”.`);
      return;
    }

    let item: MealPlanItem;
    const kind = cell("Typ pozycji");
    if (kind === "danie") {
      const meal = findReference(meals, cell("ID pozycji"), cell("Nazwa"), "Danie", log, row);
      if (!meal) return;
      if (grams !== 0) {
        log.error(row, `danie musi mieć Waga [g] 0, jest ${grams}.`);
        return;
      }
      for (const [key, count] of Object.entries(steps)) {
        const gain = meal.gains[key as keyof GainSteps];
        if (!gain) {
          log.error(row, `kroki doważania (${key}), ale danie nie ma takiego przyrostu.`);
          return;
        }
        if (count > gain.max) {
          log.error(row, `${count} kroków doważania (${key}), danie pozwala na najwyżej ${gain.max}.`);
          return;
        }
      }
      item = { mealType: mealType as MealType, kind: "meal", mealId: meal.id, steps };
    } else if (kind === "produkt") {
      const product = findReference(products, cell("ID pozycji"), cell("Nazwa"), "Produkt", log, row);
      if (!product) return;
      if (grams === 0) {
        log.error(row, "produkt musi mieć Waga [g] większą od 0.");
        return;
      }
      if (Object.keys(steps).length > 0) {
        log.error(row, "produkt nie może mieć kroków doważania.");
        return;
      }
      item = { mealType: mealType as MealType, kind: "product", productId: product.id, grams };
    } else {
      log.error(row, `nieznany Typ pozycji „${kind}”.`);
      return;
    }

    const calculated = itemTotals(item);
    for (const [column, key, tolerance] of CHECKED) {
      const inFile = parseDecimal(cell(column));
      if (inFile !== null && Math.abs(inFile - calculated[key]) > tolerance) {
        log.warn(row, `${column} w pliku ${inFile}, w aplikacji ${calculated[key].toFixed(1)}.`);
      }
    }

    let plan = plans.get(planId);
    if (!plan) {
      plan = { id: planId, name: planName, items: [], firstRow: row };
      plans.set(planId, plan);
    } else if (plan.name !== planName) {
      log.error(row, `ID jadłospisu ${planId} ma w wierszu ${plan.firstRow} nazwę „${plan.name}”, a tu „${planName}”.`);
      return;
    }
    plan.items.push(item);
  });

  for (const plan of plans.values()) {
    for (const { key, max } of MEAL_TYPES) {
      const count = plan.items.filter((i) => i.mealType === key).length;
      if (count > max) log.error(null, `Jadłospis „${plan.name}” ma ${count}× ${key}, najwyżej ${max}.`);
    }
  }

  if (log.errors.length > 0 || !variantId || targetKcal === null) return failedCheck(log.errors);
  const cleanPlans = [...plans.values()].map(({ id, name, items }) => ({ id, name, items }));
  const variantLabel = variantIds.isKnown(variantId) ? "zmieniony" : "nowy";
  const summary = `Wariant „${variantName}” (${variantLabel}). Jadłospisy - ${countSummary(
    cleanPlans.map((p) => p.id),
    (id) => planIds.isKnown(id),
  ).toLowerCase()}`;

  // replace: plans of this variant not in the file are deleted; nothing in the base uses a plan, so nothing blocks it
  const deleted = (variants.find((v) => v.id === variantId)?.plans ?? []).filter((p) => !plans.has(p.id));
  const usage = deleted.length > 0 ? await getDietUsage() : null;
  return {
    errors: [],
    warnings: log.warnings,
    summary,
    replace: {
      summary: `${summary}, usunięte: ${deleted.length}`,
      deleted: deleted.length,
      blockers: [],
      affected: usage
        ? affectedLines([["Plan tygodnia - dni z tym jadłospisem jako źródłem", deleted.reduce((n, p) => n + (usage.weekDays.plans[p.id] ?? 0), 0)]])
        : [],
    },
    save: async (mode) => {
      await saveMealPlans({ id: variantId, name: variantName, targetKcal }, cleanPlans, mode);
      await loadDietBase(true);
    },
  };
}
