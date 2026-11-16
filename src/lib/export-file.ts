import type { Unit } from '@kerf/shared';

import { api } from '@/lib/api';

/**
 * Fetches the measurements CSV in the device's timezone and names the file after today's date.
 * Re-adds the BOM that `Response.text()` strips, because Excel needs it to read the file as UTF-8.
 */
export async function fetchMeasurementsCsv(unit: Unit) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const text = await api.exportCsv(unit, timeZone);
  // en-CA formats dates as YYYY-MM-DD.
  const today = new Date().toLocaleDateString('en-CA', { timeZone });
  return {
    csv: text.startsWith('\uFEFF') ? text : `\uFEFF${text}`,
    filename: `kerf-measurements-${today}.csv`,
  };
}
