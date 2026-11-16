import type { Server } from 'node:http';

import {
  CLOSE_UNAUTHORIZED,
  type ClientMessage,
  PING_INTERVAL_MS,
  type ServerMessage,
  type User,
} from '@kerf/shared';
import { type WebSocket, WebSocketServer } from 'ws';

import { sessionLookup } from './auth';
import type { Db } from './db';
import { feedQueries } from './routes/feed';

const AUTH_TIMEOUT_MS = 5000;

interface Client {
  /** Null until the client sends a valid `auth` message. */
  userId: number | null;
  token: string;
  /** True once the client has sent `resume`; only subscribed sockets receive live measurements. */
  subscribed: boolean;
  /** Cleared on each ping and set again by the pong. A socket still false at the next ping is dead. */
  alive: boolean;
}

/**
 * Live updates and presence over WebSockets. Holds every open socket in memory, so presence resets
 * when the API restarts, which closes all sockets anyway.
 */
export function createRealtime(db: Db, pingIntervalMs = PING_INTERVAL_MS) {
  const userIdFor = sessionLookup(db);
  const feed = feedQueries(db);
  const touchSession = db.prepare('UPDATE sessions SET last_seen = ? WHERE token = ?');
  const projectMembers = db.prepare('SELECT user_id FROM project_members WHERE project_id = ?');
  const coMembers = db.prepare(`
    SELECT DISTINCT u.id, u.name
    FROM project_members mine
    JOIN project_members theirs ON theirs.project_id = mine.project_id
    JOIN users u ON u.id = theirs.user_id
    WHERE mine.user_id = ?
    ORDER BY u.name
  `);

  const wss = new WebSocketServer({ noServer: true });
  const clients = new Map<WebSocket, Client>();
  const socketsByUser = new Map<number, Set<WebSocket>>();
  let heartbeat: NodeJS.Timeout | undefined;

  function send(ws: WebSocket, message: ServerMessage) {
    ws.send(JSON.stringify(message));
  }

  /** The people who share a project with `viewerId` (or are the viewer) and have a socket open. */
  function onlineFor(viewerId: number): User[] {
    return (coMembers.all(viewerId) as unknown as User[]).filter((u) => socketsByUser.has(u.id));
  }

  /**
   * Sends a fresh online list to every connected person who shares a project with `userId`,
   * including `userId`. Called when a person's first socket opens or their last one closes.
   */
  function pushPresence(userId: number) {
    for (const { id } of coMembers.all(userId) as unknown as User[]) {
      const sockets = socketsByUser.get(id);
      if (!sockets) continue;
      const message: ServerMessage = { type: 'presence', online: onlineFor(id) };
      sockets.forEach((ws) => send(ws, message));
    }
  }

  function authenticate(ws: WebSocket, client: Client, token: string) {
    const userId = userIdFor(token);
    if (userId === undefined) {
      ws.close(CLOSE_UNAUTHORIZED);
      return;
    }
    client.userId = userId;
    client.token = token;
    const sockets = socketsByUser.get(userId) ?? new Set();
    socketsByUser.set(userId, sockets);
    sockets.add(ws);
    touchSession.run(Date.now(), token);
    send(ws, { type: 'ready' });
    if (sockets.size === 1) pushPresence(userId);
    else send(ws, { type: 'presence', online: onlineFor(userId) });
  }

  /**
   * Subscribes the socket to live measurements and sends what it is missing in the same tick.
   * `node:sqlite` is synchronous, so no measurement can be saved between the two steps. That is
   * what keeps the catch-up free of gaps and repeats.
   */
  function resume(ws: WebSocket, client: Client, after: number | null) {
    client.subscribed = true;
    const items =
      after === null ? feed.latest(client.userId!) : feed.after(client.userId!, after);
    if (items.length) send(ws, { type: 'measurements', items });
  }

  function handleClose(ws: WebSocket) {
    const client = clients.get(ws);
    clients.delete(ws);
    if (client?.userId == null) return;
    touchSession.run(Date.now(), client.token);
    const sockets = socketsByUser.get(client.userId)!;
    sockets.delete(ws);
    if (sockets.size === 0) {
      socketsByUser.delete(client.userId);
      pushPresence(client.userId);
    }
  }

  wss.on('connection', (ws) => {
    const client: Client = { userId: null, token: '', subscribed: false, alive: true };
    clients.set(ws, client);

    const authTimer = setTimeout(() => {
      if (client.userId === null) ws.close(CLOSE_UNAUTHORIZED);
    }, AUTH_TIMEOUT_MS);

    ws.on('message', (data) => {
      let message: ClientMessage;
      try {
        message = JSON.parse(data.toString());
      } catch {
        ws.close(1003);
        return;
      }
      if (message.type === 'auth' && client.userId === null) {
        authenticate(ws, client, String(message.token));
      } else if (client.userId === null) {
        ws.close(CLOSE_UNAUTHORIZED);
      } else if (message.type === 'resume') {
        resume(ws, client, message.after);
      } else if (message.type === 'pong') {
        client.alive = true;
        touchSession.run(Date.now(), client.token);
      }
    });

    ws.on('close', () => {
      clearTimeout(authTimer);
      handleClose(ws);
    });
    ws.on('error', () => ws.terminate());
  });

  /**
   * Pings every socket each interval and terminates the ones that never answered the previous
   * ping. A device that vanishes (lid closed, battery dead) is therefore dropped within two
   * intervals, which closes its socket and updates presence.
   */
  function startHeartbeat() {
    heartbeat = setInterval(() => {
      for (const [ws, client] of clients) {
        if (!client.alive) {
          ws.terminate();
          continue;
        }
        client.alive = false;
        send(ws, { type: 'ping' });
      }
    }, pingIntervalMs);
    heartbeat.unref();
  }

  return {
    /** Accepts WebSocket upgrades on `/ws` for the given HTTP server and starts the heartbeat. */
    attach(server: Server) {
      server.on('upgrade', (req, socket, head) => {
        if (new URL(req.url ?? '', 'http://localhost').pathname !== '/ws') {
          socket.destroy();
          return;
        }
        wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
      });
      startHeartbeat();
    },

    /** Sends a saved measurement to the subscribed sockets of every member of its project. */
    publishMeasurement(id: number) {
      const item = feed.byId(id);
      if (!item) return;
      const message: ServerMessage = { type: 'measurements', items: [item] };
      for (const { user_id } of projectMembers.all(item.projectId) as { user_id: number }[]) {
        socketsByUser.get(user_id)?.forEach((ws) => {
          if (clients.get(ws)?.subscribed) send(ws, message);
        });
      }
    },

    /** Tells every subscribed client to clear its list and resume from scratch. */
    broadcastReset() {
      for (const [ws, client] of clients) {
        if (client.subscribed) send(ws, { type: 'reset' });
      }
    },

    /** Closes every socket that was opened with this session token. */
    closeSession(token: string) {
      for (const [ws, client] of clients) {
        if (client.token === token) ws.close();
      }
    },

    /** Stops the heartbeat and closes all sockets. */
    close() {
      clearInterval(heartbeat);
      clients.forEach((_, ws) => ws.terminate());
    },
  };
}

export type Realtime = ReturnType<typeof createRealtime>;
