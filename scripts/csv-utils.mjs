// Helpers shared by the import scripts (import-products.mjs, import-meals.mjs).

/** Minimal CSV parser: comma separator, quoted fields, "" as an escaped quote. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

const POLISH_LETTERS = { ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z" };

/** "Mąka orkiszowa jasna typ 700" → "maka-orkiszowa-jasna-typ-700" */
export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (ch) => POLISH_LETTERS[ch])
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "1,5" → 1.5; returns null when the value is not a valid non-negative number. */
export function parseNumber(text) {
  const normalized = text.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}
