import { normalize } from "../../shared/text";
import type { ImportCheck, ImportMode } from "../../shared/ui/ImportButton";

/**
 * Rules shared by the CSV imports of products, meals and meal plans.
 * See documentation: Modules/Diet/Decision 005 - Diet data in the database → Import.
 */

export type { ImportCheck, ImportMode };

/** Collects errors and warnings with the row number ("Wiersz 5: …"; the header is row 1). */
export class ImportLog {
  errors: string[] = [];
  warnings: string[] = [];
  error(row: number | null, message: string) {
    this.errors.push(row === null ? message : `Wiersz ${row}: ${message}`);
  }
  warn(row: number | null, message: string) {
    this.warnings.push(row === null ? message : `Wiersz ${row}: ${message}`);
  }
}

/** A check that stops before saving anything (e.g. a wrong header). */
export function failedCheck(errors: string[]): ImportCheck {
  return { errors, warnings: [], summary: "", replace: null, save: async () => {} };
}

/** The header must have exactly these columns, in this order. */
export function checkHeader(header: string[] | undefined, expected: readonly string[]): string | null {
  const found = (header ?? []).map((h) => h.trim());
  if (found.length === expected.length && expected.every((h, i) => found[i] === h)) return null;
  return `Nagłówek nie zgadza się z oczekiwanymi kolumnami. Oczekiwane: ${expected.join(" | ")}. W pliku: ${found.join(" | ")}.`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids of the Diet base are UUIDs: 36 characters, groups 8-4-4-4-12. */
export const isUuid = (value: string) => UUID.test(value);

/**
 * The id for a row's `ID` cell: empty → a new UUID (rows of one new item share it by `newKey`, e.g. the name),
 * a UUID → that id (known: update, unknown: add with this id), anything else → error (null).
 */
export class IdResolver {
  private newIds = new Map<string, string>();
  constructor(private known: ReadonlySet<string>) {}

  resolve(cell: string, newKey: string, log: ImportLog, row: number, column = "ID"): string | null {
    const value = cell.trim();
    if (value === "") {
      const key = normalize(newKey.trim());
      let id = this.newIds.get(key);
      if (!id) {
        id = crypto.randomUUID();
        this.newIds.set(key, id);
      }
      return id;
    }
    if (!isUuid(value)) {
      log.error(row, `${column} „${value}” nie jest poprawnym UUID - zostaw puste dla nowego elementu.`);
      return null;
    }
    return value.toLowerCase();
  }

  isKnown(id: string) {
    return this.known.has(id);
  }
}

/** Finds an item by its id cell or, when it is empty, by name (case and Polish letters ignored). */
export function findReference<T extends { id: string; name: string }>(
  items: readonly T[],
  idCell: string,
  name: string,
  what: string,
  log: ImportLog,
  row: number,
): T | null {
  const id = idCell.trim().toLowerCase();
  if (id !== "") {
    const found = items.find((item) => item.id === id);
    if (!found) log.error(row, `${what} o ID ${id} nie istnieje w bazie.`);
    return found ?? null;
  }
  const key = normalize(name.trim());
  if (key === "") {
    log.error(row, `brak ${what.toLowerCase()} (puste ID i nazwa).`);
    return null;
  }
  const matches = items.filter((item) => normalize(item.name) === key);
  if (matches.length === 0) log.error(row, `${what} „${name.trim()}” nie istnieje w bazie.`);
  if (matches.length > 1) log.error(row, `${what} „${name.trim()}” pasuje do kilku pozycji - podaj ID.`);
  return matches.length === 1 ? matches[0] : null;
}

/** Lines of a long list shown before "…i jeszcze N". */
const MAX_BLOCKERS = 10;

/** Blocker lines, shortened to MAX_BLOCKERS. */
export function shortList(lines: string[]): string[] {
  return lines.length > MAX_BLOCKERS ? [...lines.slice(0, MAX_BLOCKERS), `…i jeszcze ${lines.length - MAX_BLOCKERS}`] : lines;
}

/** "Magazyn: 2" style lines for saved data that loses its link; empty counts are left out. */
export function affectedLines(counts: [string, number][]): string[] {
  return counts.filter(([, n]) => n > 0).map(([label, n]) => `${label}: ${n}`);
}

/** "Nowe: 3, zmienione: 12" */
export function countSummary(ids: readonly string[], isKnown: (id: string) => boolean): string {
  const updated = ids.filter(isKnown).length;
  return `Nowe: ${ids.length - updated}, zmienione: ${updated}`;
}

/** First letter upper case, as the spreadsheet import did. */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
