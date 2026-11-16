import type { User } from '@kerf/shared';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { useSyncExternalStore } from 'react';

export interface Session {
  loading: boolean;
  token?: string;
  user?: User;
}

const STORAGE_KEY = 'kerf.session';

// SecureStore has no web support, so the browser uses localStorage.
const storage =
  Platform.OS === 'web'
    ? {
        get: async () => globalThis.localStorage?.getItem(STORAGE_KEY) ?? null,
        set: async (value: string) => globalThis.localStorage?.setItem(STORAGE_KEY, value),
        remove: async () => globalThis.localStorage?.removeItem(STORAGE_KEY),
      }
    : {
        get: () => SecureStore.getItemAsync(STORAGE_KEY),
        set: (value: string) => SecureStore.setItemAsync(STORAGE_KEY, value),
        remove: () => SecureStore.deleteItemAsync(STORAGE_KEY),
      };

let session: Session = { loading: true };
const listeners = new Set<() => void>();

function publish(next: Session) {
  session = next;
  listeners.forEach((l) => l());
}

// Skipped during web server rendering, where there is no storage to read.
if (Platform.OS !== 'web' || typeof window !== 'undefined') {
  storage
    .get()
    .then((raw) => {
      const saved = raw ? (JSON.parse(raw) as { token: string; user: User }) : undefined;
      publish({ loading: false, ...saved });
    })
    .catch(() => publish({ loading: false }));
}

export function getToken() {
  return session.token;
}

export async function setSession(token: string, user: User) {
  await storage.set(JSON.stringify({ token, user }));
  publish({ loading: false, token, user });
}

export async function clearSession() {
  publish({ loading: false });
  await storage.remove().catch(() => {});
}

export function subscribeSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSession() {
  return useSyncExternalStore(
    subscribeSession,
    () => session,
    () => session,
  );
}
