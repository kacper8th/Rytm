/**
 * CSV files written and read by the app (export / import) — the same format as a spreadsheet export:
 * comma separator, decimal comma, CRLF line ends, UTF-8 with a BOM.
 */

/** One cell: text as is, a number with a decimal comma, null as an empty cell. */
export type CsvCell = string | number | null;

const BOM = "﻿";

function formatCell(cell: CsvCell): string {
  if (cell === null) return "";
  const text = typeof cell === "number" ? String(cell).replace(".", ",") : cell;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The whole file: a BOM, the header row, then one line per row. */
export function toCsv(header: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  const lines = [header, ...rows].map((row) => row.map(formatCell).join(","));
  return BOM + lines.join("\r\n") + "\r\n";
}

/** Rounds a calculated value, so sums like 878.6999999 are written as 878,7. */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Rows of a CSV file: comma separator, quoted fields (may span lines), "" as an escaped quote.
 * A BOM at the start is skipped; rows with only empty cells are left out.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.startsWith(BOM) ? text.slice(1) : text;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
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
      if (ch === "\r" && input[i + 1] === "\n") i++;
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

/** "1,5" or "1.5" → 1.5; null when the text is not a number ≥ 0. */
export function parseDecimal(text: string): number | null {
  const normalized = text.trim().replace(",", ".");
  return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : null;
}

/** Lets the browser download a text file. */
export function downloadFile(fileName: string, content: string, type = "text/csv;charset=utf-8"): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
