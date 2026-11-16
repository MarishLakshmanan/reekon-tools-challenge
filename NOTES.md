# Notes

The full design for each task, including the options we rejected, is in [docs/tasks/](docs/tasks/).
The API is documented in [docs/api.md](docs/api.md).

## Running it

Run `yarn`, then `yarn dev`, as in the README. Passwords are generated on first run and written to
`packages/api/data/credentials.md`; sign in as `alex`, `sam` or `priya`. If you have a `kerf.db` from
before sign-in existed, delete `packages/api/data/kerf.db` and restart.

## What we built

**Sign-in.** Users sign in with a username and password. Each device gets a random session token,
stored in SQLite, and passwords are hashed with `scrypt`. We rejected JWTs because they can't be
revoked.

- Not done: sign-up, password reset, session expiry, rate limiting on `/login`.

**Live updates.** Each client has one WebSocket. After reconnecting, it asks for everything after
the last measurement `id` it saw and drops duplicates, so nothing is missed or repeated.

- Not done: running more than one API instance, which would need Redis pub-sub.

**Who's online.** This uses the same socket. A user is online while they have at least one open
socket. The server pings every 20s, so a device that vanishes drops off in about 40s.

- Not done: idle or away status, "last seen".

**CSV export.** `GET /export.csv` is built on the server from your projects only. The columns are
project, group, label, the measurement as the app shows it, `Value (mm)` as a plain number for
formulas, who took it, the device, and when. The file starts with a BOM so Excel reads it as UTF-8,
and labels can't run as formulas. It downloads on web and opens the share sheet on a phone.

- Not done: XLSX, unsynced readings still on a phone, Excel locales that use `;` as the separator.

**Assumptions:**

- Three seeded users are enough, so there's no sign-up.
- A single API process.
- "Online" means a live connection.
- Millimetres are the right number column, because that's what's stored.

## How we verified it

By hand. Claude drove the app in a browser through the Playwright MCP server. We checked:

- signing in and out on two devices
- live updates and catch-up after an API restart
- presence across two windows
- the CSV opened in Google Sheets

We also checked the CSV bytes with `curl`. Given the 4-hour limit, we chose manual testing over
writing automated tests.

## Packages

- `expo-secure-store` keeps the session token on a phone.
- `ws` is the WebSocket server.
- `expo-file-system` and `expo-sharing` save the CSV and open the share sheet; both work in Expo Go.

## What got in the way

- **No migrations.** An old `kerf.db` has to be deleted after sign-in. Later columns are added with
  `ALTER TABLE`.
- **`/dev/reset` restarts IDs at 1.** This breaks the catch-up cursor, so the server broadcasts a
  reset and clients reload.
- **The unit setting lives only on the device.** The export request has to send it.

## Where AI tooling was wrong

- **Invisible characters.** Claude wrote invisible BOM characters into source files instead of the
  `\uFEFF` escape. We caught it by grepping for the bytes.
- **An unwanted config plugin.** `expo install expo-sharing` added a config plugin that would have
  broken Expo Go. We removed it.

## Next

- Automated tests.
- Session expiry and rate limiting on login.
- Real database migrations.
