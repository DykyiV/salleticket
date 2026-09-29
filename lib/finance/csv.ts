/**
 * Excel-friendly CSV: `;`-separated with a UTF-8 BOM and CRLF, so Excel in
 * Ukrainian / EU locales opens Cyrillic correctly in separate columns.
 * Cells that start with = + - @ are prefixed with ' so a spreadsheet never
 * evaluates user-supplied text as a formula (CSV injection).
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  let s = typeof value === "number" ? value.toFixed(2) : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: (string | number | null)[][]): string {
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** Content-Disposition for a download with a UTF-8 file name. */
export function csvDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
