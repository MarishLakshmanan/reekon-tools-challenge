import type { Unit } from '@kerf/shared';

import { fetchMeasurementsCsv } from '@/lib/export-file';

/**
 * Downloads the user's measurements as a CSV: a file download on web, the share sheet on a phone,
 * from where it can be saved to Files or Drive or opened in a spreadsheet app.
 */
export async function downloadMeasurementsCsv(unit: Unit): Promise<void> {
  const { csv, filename } = await fetchMeasurementsCsv(unit);

  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
