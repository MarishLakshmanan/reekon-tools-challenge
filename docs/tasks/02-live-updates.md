# 2. Live updates

New measurements show up on the office dashboard as soon as they're captured, with no reload. After a
dropped connection the dashboard catches up with nothing missing or repeated, and users only see
measurements from their own projects.

## Decisions

- **WebSockets.** One socket per open app or dashboard carries both live measurements and presence
  ([task 3](03-whos-online.md)), so there is no second channel to build. Browsers and Expo Go both
  have `WebSocket` built in.
- **Auth in the first message.** Browsers can't set an `Authorization` header on a WebSocket, so the
  client connects and sends `{ type: 'auth', token }`. The server closes the socket if the token is
  invalid. Tokens stay out of URLs and logs.
- **Only the project's members get each measurement.** When a measurement is saved, the server
  sends it only to sockets whose user belongs to that project.
- **Catch-up with an ID cursor.** The client remembers the highest measurement `id` it has seen.
  After reconnecting it sends `{ type: 'resume', after: <id> }`, and the server returns every
  missed measurement from the user's projects (`id > after`, filtered by membership, no limit).
  Live messages then continue. The server subscribes the socket and runs this query in the same
  tick, and SQLite is synchronous here, so nothing can be saved in between.
- **Gaps are expected.** IDs from other projects are skipped, so the client never assumes they are
  consecutive.
- **Dedupe by `id`.** A measurement can arrive both in the catch-up and live. The client ignores any
  `id` it already has.
- **Reconnect with backoff.** The client reconnects on close, waiting longer after each failure
  (1s up to 30s). The server's `ping` is an app message, not a protocol ping, because browsers and
  React Native can't see protocol pings. If no message arrives for 45s the client treats the
  connection as dead and reconnects, which catches a laptop waking from sleep.
- **Reset is broadcast.** `/dev/reset` restarts measurement IDs at 1, so the server sends
  `{ type: 'reset' }` and clients clear their list and reload.

## Avoided

- **Polling:** every open dashboard repeatedly calling `GET /feed` adds load and delay for nothing
  new most of the time.
- **Server-sent events:** one-way only. Presence would need a separate HTTP heartbeat next to the
  stream. One socket covers both.
- **GraphQL subscriptions / hosted pub-sub (Ably, Pusher, Supabase):** an extra layer or an external
  service on top of the same transport. Not needed at this size.
- **Timestamp cursor (`since created_at`):** timestamps can tie and rely on the server clock. The
  auto-increment `id` is strictly increasing.
- **Server-side queue per client:** reliable, but the server must track and clean up every client.
  The stateless ID cursor gives the same result.
- **Message broker (MQTT, Redis Streams, NATS):** overkill for one API process.
