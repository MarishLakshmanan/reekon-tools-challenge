import type { Group, Measurement, NewMeasurement, Project, User } from '@kerf/shared';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { clearSession, getToken } from '@/lib/session';

const API_PORT = 4000;

// The API runs on the same machine as the Expo dev server: the page's host on web, and the
// dev server's host on a phone. EXPO_PUBLIC_API_URL overrides both.
function apiUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  const host =
    Platform.OS === 'web'
      ? globalThis.location?.hostname
      : Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host || 'localhost'}:${API_PORT}`;
}

/** The WebSocket endpoint, on the same host as the HTTP API. */
export function wsUrl() {
  return `${apiUrl().replace(/^http/, 'ws')}/ws`;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(apiUrl() + path, {
    ...init,
    headers: {
      ...(token && { authorization: `Bearer ${token}` }),
      'content-type': 'application/json',
      ...init.headers,
    },
  });
  // A rejected session means we're signed out; the route guard shows the sign-in screen.
  if (res.status === 401 && token) clearSession();
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? res.statusText);
  }
  return res.json();
}

export const api = {
  login: (username: string, password: string, deviceId: string) =>
    request<{ token: string; user: User }>('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, deviceId }),
    }),
  logout: () => request<{ ok: true }>('/logout', { method: 'POST' }),
  projects: () => request<Project[]>('/projects'),
  measurements: (projectId: number) => request<Group[]>(`/projects/${projectId}/measurements`),
  addMeasurement: (groupId: number, measurement: NewMeasurement) =>
    request<Measurement>(`/groups/${groupId}/measurements`, {
      method: 'POST',
      body: JSON.stringify(measurement),
    }),
  reset: () => request<{ ok: true }>('/dev/reset', { method: 'POST' }),
};
