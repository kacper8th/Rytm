import { parseCsv, parseDecimal } from "../../../shared/csv";
import { getDietUsage, loadDietBase } from "../diet-base";
import {
  affectedLines,
  capitalize,
  checkHeader,
  countSummary,
  failedCheck,
  findReference,
  IdResolver,
  ImportLog,
  shortList,
  type ImportCheck,
} from "../diet-import";
import { getMealPlanVariants } from "../meal-plans/meal-plans";
import { getProducts } from "../products/products";
import { GAIN_LABELS, MEAL_COLUMNS } from "./meals-export";
import { GAIN_MACROS, getMeals, MEAL_TAGS, saveMeals, type GainMacro, type Meal, type MealItem, type MealTag } from "./meals";

/**
 * Import of a meals CSV file (the export's "long" format: one row = one property of a meal).
 * See documentation: Modules/Diet/Meals → Import; rules of the ID columns: Modules/Diet/Decision 005 → Import.
 */

type Draft = {
  meal: Meal;
  firstRow: number;
  gainItems: Partial<Record<GainMacro, { item: MealItem; row: number }[]>>;
  gainMax: Partial<Record<GainMacro, number>>;
};

const GAIN_BY_LABEL = new Map(GAIN_MACROS.map(({ key }) => [GAIN_LABELS[key], key]));

export async function checkMealsFile(text: string): Promise<ImportCheck> {
  const [header, ...rows] = parseCsv(text);
  const headerError = checkHeader(header, MEAL_COLUMNS);
  if (headerError) return failedCheck([headerError]);
  if (rows.length === 0) return failedCheck(["Plik nie ma wierszy z daniami."]);

  const log = new ImportLog();
  const ids = new IdResolver(new Set(getMeals().map((m) => m.id)));
  const products = getProducts();
  const drafts = new Map<string, Draft>();

  rows.forEach((cells, index) => {
    const row = index + 2;
    if (cells.length !== MEAL_COLUMNS.length) {
      log.error(row, `oczekiwano ${MEAL_COLUMNS.length} kolumn, jest ${cells.length}.`);
      return;
    }
    const [idCell, rawName, rawParam, rawValue, productIdCell, productName, weight] = cells.map((c) => c.trim());
    const name = capitalize(rawName);
    if (!name) {
      log.error(row, "pusta nazwa dania.");
      return;
    }
    const id = ids.resolve(idCell, name, log, row);
    if (!id) return;
    let draft = drafts.get(id);
    if (!draft) {
      draft = {
        meal: { id, name, tags: [], recipe: null, ingredients: [], gains: {} },
        firstRow: row,
        gainItems: {},
        gainMax: {},
      };
      drafts.set(id, draft);
    } else if (draft.meal.name !== name) {
      log.error(row, `ID ${id} ma w wierszu ${draft.firstRow} nazwę „${draft.meal.name}”, a tu „${name}”.`);
      return;
    }
    const meal = draft.meal;
    const param = rawParam.toLowerCase() === "przepis" ? "Przepis" : rawParam;

    const item = (): MealItem | null => {
      const product = findReference(products, productIdCell, productName, "Produkt", log, row);
      const grams = parseDecimal(weight);
      if (grams === null || grams === 0) {
        log.error(row, `waga musi być liczbą większą od 0, jest „${weight}”.`);
        return null;
      }
      return product ? { productId: product.id, grams } : null;
    };

    if (param === "składnik") {
      // weight 0 = optional ingredient in the spreadsheet — left out, as before
      if (parseDecimal(weight) === 0) {
        log.warn(row, `„${productName}” ma wagę 0 - składnik opcjonalny, pominięty.`);
        return;
      }
      const ingredient = item();
      if (!ingredient) return;
      if (meal.ingredients.some((i) => i.productId === ingredient.productId)) {
        log.error(row, `składnik „${productName}” jest dwa razy.`);
        return;
      }
      meal.ingredients.push(ingredient);
    } else if (param === "Przepis") {
      if (meal.recipe !== null) log.error(row, "więcej niż jeden przepis.");
      else if (!rawValue) log.warn(row, "pusty przepis - danie bez przepisu.");
      else meal.recipe = rawValue;
    } else if ((MEAL_TAGS as readonly string[]).includes(param)) {
      if (rawValue.toLowerCase() !== "tak") log.error(row, `oczekiwano „tak”, jest „${rawValue}”.`);
      else if (!meal.tags.includes(param as MealTag)) meal.tags.push(param as MealTag);
    } else if (/^przyrost \S+ max$/.test(param) && GAIN_BY_LABEL.has(param.split(" ")[1])) {
      const key = GAIN_BY_LABEL.get(param.split(" ")[1])!;
      const max = parseDecimal(rawValue);
      if (max === null || max === 0 || !Number.isInteger(max)) {
        log.error(row, `max musi być liczbą całkowitą większą od 0, jest „${rawValue}”.`);
      } else if (draft.gainMax[key] !== undefined) {
        log.error(row, "max podany dwa razy.");
      } else {
        draft.gainMax[key] = max;
      }
    } else if (/^przyrost \S+$/.test(param) && GAIN_BY_LABEL.has(param.split(" ")[1])) {
      const key = GAIN_BY_LABEL.get(param.split(" ")[1])!;
      const gainItem = item();
      if (!gainItem) return;
      const list = (draft.gainItems[key] ??= []);
      if (list.some((g) => g.item.productId === gainItem.productId)) {
        log.error(row, `produkt przyrostu „${productName}” jest dwa razy.`);
        return;
      }
      list.push({ item: gainItem, row });
    } else {
      log.error(row, `nieznany Parametr „${rawParam}”.`);
    }
  });

  for (const draft of drafts.values()) {
    const { meal } = draft;
    const where = `Danie „${meal.name}” (od wiersza ${draft.firstRow})`;
    if (meal.ingredients.length === 0) log.error(null, `${where}: brak składników.`);
    for (const { key } of GAIN_MACROS) {
      const items = draft.gainItems[key];
      const max = draft.gainMax[key];
      if (items && max === undefined) log.error(null, `${where}: przyrost ${GAIN_LABELS[key]} ma kroki, ale nie ma max.`);
      if (!items && max !== undefined) log.error(null, `${where}: przyrost ${GAIN_LABELS[key]} ma max, ale nie ma kroków.`);
      if (!items || max === undefined) continue;
      for (const { item, row } of items) {
        if (!meal.ingredients.some((i) => i.productId === item.productId)) {
          log.error(row, "produkt przyrostu musi być też składnikiem dania.");
        }
      }
      meal.gains[key] = { max, items: items.map((g) => g.item) };
    }
  }

  // saved meal plans must still fit the changed meals (gain steps within max)
  for (const variant of getMealPlanVariants()) {
    for (const plan of variant.plans) {
      for (const item of plan.items) {
        const changed = item.kind === "meal" ? drafts.get(item.mealId)?.meal : undefined;
        if (!changed || item.kind !== "meal") continue;
        for (const [key, steps] of Object.entries(item.steps) as [GainMacro, number][]) {
          const max = changed.gains[key]?.max ?? 0;
          if (steps > max) {
            log.error(
              null,
              `Jadłospis „${plan.name}” (${variant.name}) ma ${steps} kroków przyrostu ${GAIN_LABELS[key]} dania „${changed.name}”, a nowy max to ${max}.`,
            );
          }
        }
      }
    }
  }

  if (log.errors.length > 0) return failedCheck(log.errors);
  const meals = [...drafts.values()].map((d) => d.meal);

  // replace: meals not in the file are deleted — not when a meal plan still uses them
  const deleted = getMeals().filter((m) => !drafts.has(m.id));
  const deletedById = new Map(deleted.map((m) => [m.id, m]));
  const blockers: string[] = [];
  for (const variant of getMealPlanVariants()) {
    for (const plan of variant.plans) {
      for (const item of plan.items) {
        const meal = item.kind === "meal" ? deletedById.get(item.mealId) : undefined;
        if (meal) blockers.push(`Danie „${meal.name}” jest w jadłospisie „${plan.name}” (${variant.name}).`);
      }
    }
  }
  const usage = deleted.length > 0 ? await getDietUsage() : null;

  const summary = countSummary(
    meals.map((m) => m.id),
    (id) => ids.isKnown(id),
  );
  return {
    errors: [],
    warnings: log.warnings,
    summary,
    replace: {
      summary: `${summary}, usunięte: ${deleted.length}`,
      deleted: deleted.length,
      blockers: shortList(blockers),
      affected: usage
        ? affectedLines([["Plan tygodnia - dania w zapisanych dniach", deleted.filter((m) => usage.weekDays.meals[m.id]).length]])
        : [],
    },
    save: (mode) => saveMeals(meals, mode),
    afterSave: () => loadDietBase(true),
  };
}
