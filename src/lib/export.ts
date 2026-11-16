import type { Unit } from '@kerf/shared';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { fetchMeasurementsCsv } from '@/lib/export-file';

/**
 * Downloads the user's measurements as a CSV: a file download on web, the share sheet on a phone,
 * from where it can be saved to Files or Drive or opened in a spreadsheet app.
 */
export async function downloadMeasurementsCsv(unit: Unit): Promise<void> {
  const { csv, filename } = await fetchMeasurementsCsv(unit);

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing files isn’t available on this device');
  }

  const file = new File(Paths.cache, filename);
  // create() throws if the file exists, e.g. from an earlier export today.
  if (file.exists) file.delete();
  file.create();
  await file.write(csv);

  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: 'Export measurements',
  });
}
