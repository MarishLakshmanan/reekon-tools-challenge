# Project structure

Kerf is a Yarn workspaces monorepo with three parts: the Expo app at the root, plus an API and a shared library under `packages/`. `yarn dev` starts the app and the API together.

```
kerf/
├── src/                 Expo app
│   ├── app/             Screens (Expo Router: each file is a route)
│   │   ├── _layout.tsx      Root navigator
│   │   ├── index.tsx        Home (/)
│   │   ├── capture.tsx      Take measurements with the tape
│   │   ├── dashboard.tsx    Office dashboard (uses /feed)
│   │   ├── settings.tsx     Settings
│   │   └── projects/[id].tsx  One project's measurements
│   ├── components/      UI pieces (button, card, feed-row, themed-text…)
│   ├── lib/             Logic: api.ts (API client), tape.ts (mock tape),
│   │                    settings.ts, use-load.ts
│   ├── hooks/           Theme and colour-scheme hooks
│   ├── constants/       theme.ts, layout.ts
│   └── global.css
├── packages/
│   ├── api/             Express + SQLite server (port 4000)
│   │   └── src/         index.ts (start), app.ts (routes), auth.ts,
│   │                    db.ts, seed.ts, routes/*.ts
│   └── shared/          Code used by both the app and the API
│       └── src/         types.ts (Project, Measurement…), format.ts (unit formatting)
├── assets/              Icons and splash images
├── scripts/dev.mjs      Runs the API and the app together
├── docs/                Project docs (api.md, this file)
└── app.json             Expo config
```

## How the parts connect

- **Shared code:** the app and the API both import `@kerf/shared`, so they use the same types and the same unit formatting.
- **Import alias:** `@/` points to `src/`, as in `@/lib/tape`.
- **API URL:** the app calls the API through `src/lib/api.ts`, which uses `EXPO_PUBLIC_API_URL` when it's set. See [api.md](api.md) for the routes.
- **Native folders:** there are no `ios/` or `android/` folders. Expo generates them from `app.json` when it builds.

## Libraries

**App (root `package.json`)**

| Library | Used for |
| --- | --- |
| `expo` (SDK 58), `react-native` 0.88, `react` 19 | The app framework |
| `react-native-web`, `react-dom` | Running the app in a browser |
| `expo-router` | Navigation (see Routers below) |
| `react-native-screens`, `react-native-safe-area-context`, `react-native-gesture-handler` | Navigation support |
| `react-native-reanimated`, `react-native-worklets` | Animations |
| `@react-native-async-storage/async-storage` | Saving settings on the device |
| `expo-constants`, `expo-device`, `expo-linking`, `expo-web-browser` | Device and app info, links |
| `expo-font`, `expo-image`, `expo-symbols`, `expo-glass-effect`, `expo-splash-screen`, `expo-status-bar`, `expo-system-ui`, `@expo/ui` | Fonts, images, icons and UI |
| `@kerf/shared` | Types and unit formatting shared with the API |

**API (`packages/api`)**

| Library | Used for |
| --- | --- |
| `express` 5 | The web server |
| `node:sqlite` (built into Node 22.13+) | The SQLite database |
| `tsx` | Running TypeScript directly |
| `@kerf/shared` | Shared types |

**Tooling:** `typescript`, `eslint` with `eslint-config-expo`, and `vitest` (with `vite`) for tests.

## Routers

**App: Expo Router** (file-based). Each file in `src/app/` is a screen, and `_layout.tsx` sets up one `Stack` navigator for all of them.

| File | Route | Title |
| --- | --- | --- |
| `index.tsx` | `/` | Projects |
| `capture.tsx` | `/capture` | Capture |
| `dashboard.tsx` | `/dashboard` | Office dashboard |
| `settings.tsx` | `/settings` | Settings |
| `projects/[id].tsx` | `/projects/:id` | The project's name (set inside the screen) |

**API: Express `Router`.** `app.ts` mounts three routers, and the `/health`, `/me` and `/dev/reset` routes are defined directly in `app.ts`.

| Router | File | Routes |
| --- | --- | --- |
| `projectsRouter` | `packages/api/src/routes/projects.ts` | `GET /projects` |
| `measurementsRouter` | `packages/api/src/routes/measurements.ts` | `GET /projects/:id/measurements`, `POST /groups/:id/measurements` |
| `feedRouter` | `packages/api/src/routes/feed.ts` | `GET /feed` |

See [api.md](api.md) for what each route does.
