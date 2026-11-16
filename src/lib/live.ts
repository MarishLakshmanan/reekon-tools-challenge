import {
  CLOSE_UNAUTHORIZED,
  type ClientMessage,
  type FeedItem,
  type ServerMessage,
  type User,
} from '@kerf/shared';
import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';

import { wsUrl } from '@/lib/api';
import { clearSession, getToken, subscribeSession } from '@/lib/session';

export interface Live {
  status: 'connecting' | 'live' | 'offline';
  /** Measurements from the user's projects, newest first. */
  feed: FeedItem[];
  /** People who share a project with the user and have the app or dashboard open. */
  online: User[];
}

const MIN_RETRY_MS = 1000;
const MAX_RETRY_MS = 30_000;
// The server pings every 20s, so this long without any message means the connection is dead.
const SILENCE_LIMIT_MS = 45_000;

const EMPTY: Live = { status: 'offline', feed: [], online: [] };

let state = EMPTY;
const listeners = new Set<() => void>();

let socket: WebSocket | undefined;
let socketToken: string | undefined;
let retryDelay = MIN_RETRY_MS;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let silenceTimer: ReturnType<typeof setTimeout> | undefined;
let appActive = true;

function publish(patch: Partial<Live>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function send(message: ClientMessage) {
  socket?.send(JSON.stringify(message));
}

function merge(current: FeedItem[], incoming: FeedItem[]) {
  const known = new Set(current.map((item) => item.id));
  const added = incoming.filter((item) => !known.has(item.id));
  return added.length ? [...added, ...current].sort((a, b) => b.id - a.id) : current;
}

function handle(message: ServerMessage) {
  switch (message.type) {
    case 'ready':
      retryDelay = MIN_RETRY_MS;
      publish({ status: 'live' });
      // The feed is newest first, so its first item holds the highest id we have seen.
      send({ type: 'resume', after: state.feed[0]?.id ?? null });
      break;
    case 'measurements':
      publish({ feed: merge(state.feed, message.items) });
      break;
    case 'presence':
      publish({ online: message.online });
      break;
    case 'reset':
      publish({ feed: [] });
      send({ type: 'resume', after: null });
      break;
    case 'ping':
      send({ type: 'pong' });
      break;
  }
}

/** Detaches and closes the current socket and cancels the timers that belong to it. */
function drop() {
  clearTimeout(retryTimer);
  clearTimeout(silenceTimer);
  if (socket) {
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.close();
  }
  socket = undefined;
  socketToken = undefined;
}

function armSilenceTimer() {
  clearTimeout(silenceTimer);
  silenceTimer = setTimeout(connect, SILENCE_LIMIT_MS);
}

/**
 * Opens a socket for the signed-in user, replacing any current one, and signs in on it with the
 * session token. Once the server says `ready`, the client asks for everything after the highest
 * measurement id it has, so a reconnect fills the gap without repeating anything.
 *
 * It runs again if the socket closes (after a backoff delay) or if nothing arrives for
 * SILENCE_LIMIT_MS, which is how a connection that died during laptop sleep is noticed.
 */
function connect() {
  const token = getToken();
  if (!token || !appActive) return;
  drop();
  publish({ status: 'connecting' });

  const ws = new WebSocket(wsUrl());
  socket = ws;
  socketToken = token;
  ws.onopen = () => send({ type: 'auth', token });
  ws.onmessage = (event) => {
    armSilenceTimer();
    handle(JSON.parse(String(event.data)));
  };
  ws.onclose = (event) => {
    socket = undefined;
    clearTimeout(silenceTimer);
    if (event.code === CLOSE_UNAUTHORIZED) {
      clearSession();
      return;
    }
    publish({ status: 'offline' });
    retryTimer = setTimeout(connect, retryDelay);
    retryDelay = Math.min(retryDelay * 2, MAX_RETRY_MS);
  };
  armSilenceTimer();
}

/** Brings the connection in line with the current session and whether the app is in the foreground. */
function sync() {
  const token = getToken();
  if (!token) {
    drop();
    publish(EMPTY);
  } else if (!appActive) {
    drop();
    publish({ status: 'offline' });
  } else if (!socket || token !== socketToken) {
    if (token !== socketToken) publish(EMPTY);
    connect();
  }
}

/** Drops the current connection and opens a new one right away, for example on pull-to-refresh. */
export function reconnect() {
  retryDelay = MIN_RETRY_MS;
  connect();
}

subscribeSession(sync);
if (Platform.OS === 'web') {
  if (typeof window !== 'undefined') window.addEventListener('online', reconnect);
} else {
  // A backgrounded phone counts as offline, so the socket is closed rather than left to go stale.
  AppState.addEventListener('change', (next) => {
    appActive = next === 'active';
    sync();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The live feed, the online list and the connection status. The connection is opened by sign-in. */
export function useLive() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}
