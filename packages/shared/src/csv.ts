const BOM = '\uFEFF';
const FORMULA_START = /^[=+\-@\t\r]/;

function formatCell(cell: string | number): string {
  if (typeof cell === 'number') return String(cell);
  const text = FORMULA_START.test(cell) ? `'${cell}` : cell;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * Writes rows as CSV for Excel and Google Sheets: a UTF-8 BOM so Excel reads it as UTF-8, CRLF
 * line endings, and RFC 4180 quoting. Text starting with = + - @ tab or CR gets a leading ' so a
 * label can't run as a formula. Numbers are written as they are.
 */
export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(formatCell).join(','));
  return BOM + lines.map((line) => `${line}\r\n`).join('');
}
