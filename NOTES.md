# Notes

The full design for each task, including the options I rejected, is in [docs/tasks/](docs/tasks/).
The API is documented in [docs/api.md](docs/api.md).

## Running it

Run `yarn`, then `yarn dev`, as in the README. Passwords are generated on first run and written to
`packages/api/data/credentials.md`; sign in as `alex`, `sam` or `priya`. If you have a `kerf.db` from
before sign-in existed, delete `packages/api/data/kerf.db` and restart.

## What I built

**Sign-in.** Users sign in with a username and password. Each sign-in gets a random session token,
stored in SQLite, so every device has its own, and passwords are hashed with `scrypt`. I rejected JWTs because they can't be
revoked.

- Not done: sign-up, password reset, session expiry, rate limiting on `/login`.

**Live updates.** Each client has one WebSocket. After reconnecting, it asks for everything after
the last measurement `id` it saw and drops duplicates, so nothing is missed or repeated.

- Not done: running more than one API instance, which would need Redis pub-sub.

**Who's online.** This uses the same socket. A user is online while they have at least one open
socket. The server pings every 20s, so a device that vanishes drops off within about 40s.

- Not done: idle or away status. Each session already stores a `last_seen` time (updated on connect,
  on every ping reply and on close), but the dashboard doesn't show it.

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

## How I verified it

By hand. Claude drove the app in a browser through the Playwright MCP server. I checked:

- signing in and out on two devices
- live updates and catch-up after an API restart
- presence across two windows
- the CSV opened in Google Sheets

I also checked the CSV bytes with `curl`. Given the 4-hour limit, I chose manual testing over
writing automated tests. The one exception is the CSV export: I wrote and ran test cases for
`toCsv()` and `/export.csv`, but didn't commit them, to keep AI-generated filler out of the repo.

## Packages

- `expo-secure-store` keeps the session token on a phone.
- `ws` is the WebSocket server.
- `expo-file-system` and `expo-sharing` save the CSV and open the share sheet; both work in Expo Go.

## What got in the way

- **No migrations.** An old `kerf.db` has to be deleted after sign-in. Later columns are added with
  `ALTER TABLE`.
- **`/dev/reset` restarts IDs at 1.** This breaks the catch-up cursor, so the server broadcasts a
  reset and clients clear their list and ask for it again.
- **The unit setting lives only on the device.** The export request has to send it.
- **University Wi-Fi.** It blocks device-to-device traffic, so my phone couldn't reach the Expo
  server or the API. I had to tunnel both.

## Where AI tooling was wrong

- **Invisible characters.** Claude wrote invisible BOM characters into source files instead of the
  `\uFEFF` escape. I caught it by grepping for the bytes.
- **A wrong example value.** Claude's CSV design doc said the app shows 3048 mm as `10' 0"`. The
  app only shows inches (`120"`). I caught it by checking the doc against `formatFractionalInches`.

## Next

- **Accounts:** sign-up through project invites, creating projects and managing members, session
  expiry, rate limiting on login, password reset. Then move to a managed auth service once there are
  real users.
- **Database:** versioned migrations so old databases upgrade instead of being deleted, then Postgres
  for hosting. Firebase is an option, but it would mean rebuilding project access as security rules.
- **Realtime:** consider switching from WebSockets to SSE. SSE is plain HTTP, resumes on its own and
  passes through proxies more easily. The cost is a separate presence heartbeat and cookie-based
  auth. Which one wins depends on how the office actually uses the dashboard.
- **CSV filters:** pick which columns to include, and export only measurements taken by a given
  person, or from chosen projects or a specific job.
- **Automated tests**, starting with the CSV export.
