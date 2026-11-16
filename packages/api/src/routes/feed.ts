import type { FeedItem } from '@kerf/shared';
import { Router } from 'express';

import type { Db } from '../db';
import { type MeasurementRow, toMeasurement } from '../rows';

const FEED_SIZE = 20;

type FeedRow = MeasurementRow & { project_id: number; project_name: string; group_name: string };

export function toFeedItem(row: FeedRow): FeedItem {
  return {
    ...toMeasurement(row),
    projectId: row.project_id,
    projectName: row.project_name,
    groupName: row.group_name,
  };
}

const FEED_SELECT = `
  SELECT m.*, g.project_id, g.name AS group_name, p.name AS project_name
  FROM measurements m
  JOIN measurement_groups g ON g.id = m.group_id
  JOIN projects p ON p.id = g.project_id
`;

/** Prepared feed queries, shared by the HTTP route and the WebSocket. */
export function feedQueries(db: Db) {
  const latest = db.prepare(`
    ${FEED_SELECT}
    JOIN project_members pm ON pm.project_id = p.id
    WHERE pm.user_id = ?
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT ${FEED_SIZE}
  `);
  const after = db.prepare(`
    ${FEED_SELECT}
    JOIN project_members pm ON pm.project_id = p.id
    WHERE pm.user_id = ? AND m.id > ?
    ORDER BY m.id
  `);
  const byId = db.prepare(`${FEED_SELECT} WHERE m.id = ?`);

  return {
    /** The newest measurements from the user's projects, newest first. */
    latest: (userId: number) => (latest.all(userId) as unknown as FeedRow[]).map(toFeedItem),

    /**
     * Every measurement from the user's projects with an id above `afterId`, oldest first, with
     * no limit. IDs from projects the user isn't in are skipped, so the result can have gaps.
     */
    after: (userId: number, afterId: number) =>
      (after.all(userId, afterId) as unknown as FeedRow[]).map(toFeedItem),

    /** One measurement with its project and group names, or undefined if it doesn't exist. */
    byId: (id: number) => {
      const row = byId.get(id) as unknown as FeedRow | undefined;
      return row && toFeedItem(row);
    },
  };
}

export function feedRouter(db: Db) {
  const router = Router();
  const queries = feedQueries(db);

  router.get('/feed', (req, res) => {
    res.json(queries.latest(req.userId));
  });

  return router;
}
