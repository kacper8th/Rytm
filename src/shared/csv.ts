/**
 * CSV files written by the app (export) — the same format as a spreadsheet export:
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
