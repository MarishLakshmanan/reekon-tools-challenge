import type { FeedItem, User } from './types';

/** Messages the client sends over the WebSocket. */
export type ClientMessage =
  | { type: 'auth'; token: string }
  | { type: 'resume'; after: number | null }
  | { type: 'pong' };

/** Messages the server sends over the WebSocket. */
export type ServerMessage =
  | { type: 'ready' }
  | { type: 'measurements'; items: FeedItem[] }
  | { type: 'presence'; online: User[] }
  | { type: 'reset' }
  | { type: 'ping' };

/** Close code the server uses when the auth token is missing or invalid. */
export const CLOSE_UNAUTHORIZED = 4401;

/** How often the server pings each socket. A silent socket is dropped after two intervals. */
export const PING_INTERVAL_MS = 20_000;
