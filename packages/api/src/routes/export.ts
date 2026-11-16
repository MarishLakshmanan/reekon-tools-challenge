import { formatValue, toCsv, UNIT_LABELS, type Unit } from '@kerf/shared';
import { Router } from 'express';

import type { Db } from '../db';

const HEADERS = ['Project', 'Group', 'Label', 'Measurement', 'Value (mm)', 'Taken by', 'Taken at'];

type ExportRow = {
  project_name: string;
  group_name: string;
  label: string;
  value: number;
  user_name: string;
  created_at: number;
};

function isUnit(value: unknown): value is Unit {
  return typeof value === 'string' && value in UNIT_LABELS;
}

/** Returns a formatter for `timeZone`, or undefined if it isn't a valid IANA zone. */
function dateFormatter(timeZone: unknown) {
  if (typeof timeZone !== 'string' || !timeZone) return undefined;
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
  } catch {
    return undefined;
  }
}

/** Formats epoch ms as `YYYY-MM-DD HH:mm:ss` in the formatter's zone, which Excel and Sheets read as a date. */
function formatTimestamp(formatter: Intl.DateTimeFormat, ms: number): string {
  const p = Object.fromEntries(formatter.formatToParts(ms).map((part) => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

/** `GET /export.csv`: every measurement in the user's projects as CSV, in their unit and timezone. */
export function exportRouter(db: Db) {
  const router = Router();

  const listForUser = db.prepare(`
    SELECT p.name AS project_name, g.name AS group_name, m.label, m.value,
           u.name AS user_name, m.created_at
    FROM measurements m
    JOIN measurement_groups g ON g.id = m.group_id
    JOIN projects p ON p.id = g.project_id
    JOIN project_members pm ON pm.project_id = p.id
    JOIN users u ON u.id = m.created_by
    WHERE pm.user_id = ?
    ORDER BY p.name, p.id, g.id, m.created_at, m.id
  `);

  router.get('/export.csv', (req, res) => {
    const { unit, tz } = req.query;
    if (!isUnit(unit)) {
      res.status(400).json({ error: 'Invalid unit' });
      return;
    }
    const formatter = dateFormatter(tz);
    if (!formatter) {
      res.status(400).json({ error: 'Invalid timezone' });
      return;
    }

    const rows = (listForUser.all(req.userId) as unknown as ExportRow[]).map((r) => [
      r.project_name,
      r.group_name,
      r.label,
      formatValue(r.value, unit),
      r.value,
      r.user_name,
      formatTimestamp(formatter, r.created_at),
    ]);
    const today = formatTimestamp(formatter, Date.now()).slice(0, 10);

    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="kerf-measurements-${today}.csv"`);
    res.send(toCsv(HEADERS, rows));
  });

  return router;
}
