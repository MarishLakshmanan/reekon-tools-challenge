# 1. Sign-in

Replace the fixed tokens with username + password sign-in, in the app and on the dashboard.

## Decisions

- **Session tokens, not JWTs.** `POST /login` returns a random token stored in a `sessions` table.
  `requireUser` looks it up on each request. Sign-out deletes the row, so it is a real server-side
  revoke. Sessions live in SQLite, so an API restart doesn't log anyone out.
- **One session per device.** A separate `sessions` table (not a `users.token` column) lets the same
  user be signed in on phone and browser at once, and signing out on one leaves the other alone.
- **Unique `username`** on `users` for login. `name` stays as the display name.
- **Passwords hashed** with Node's built-in `crypto.scrypt` (per-user salt, `timingSafeEqual`).
  No new dependency.
- **Seeded credentials.** Passwords are generated randomly only when the `users` table is empty.
  The seed writes them to `packages/api/data/credentials.md` (gitignored).
- **Reset keeps users.** `/dev/reset` reseeds projects and measurements only, so passwords and
  sessions survive it.
- **No migration.** Delete the old `kerf.db`; a fresh one is created with the new schema.
- **App routing.** Expo Router guards the screens based on auth state. The token is kept in
  `expo-secure-store` on native and in local storage on web. Any 401 signs the user out.

## Avoided

- **JWT:** can't be revoked without a DB check, which removes its benefit, and needs a signing
  secret that must survive restarts.
- **Firebase Auth:** overkill for three seeded users and adds an external service to set up.
- **Email / SMS verification** (at sign-in or after first use of the given password): we have no
  emails or phone numbers for the users, so it was skipped.
- **Sign-up route:** users are seeded and nothing in the brief needs self-registration.
