# 3. Who's online

The dashboard shows who has the app or dashboard open right now, limited to people who share a
project with you. Each person appears once however many devices they use, and a device that
disappears drops off within about a minute.

## Decisions

- **Same WebSocket as live updates.** See [task 2](02-live-updates.md). An open, authenticated
  socket means that device is online.
- **`device_id` and `last_seen` on `sessions`.** Each app install or browser generates a random ID
  once, stores it, and sends it at login. This is separate from the tape measure's `deviceId` on
  measurements. Sessions are already one per device ([task 1](01-sign-in.md)), so this reuses that
  table. `last_seen` is updated when a socket authenticates, answers a ping, or closes. Existing
  databases get the two columns added by `ALTER TABLE` on startup.
- **Heartbeat every 20s over the socket.** The server pings each socket every 20 seconds and closes
  it if there's no reply by the next ping. A lost device drops off within about 40 seconds.
- **Online = at least one live socket.** The server keeps a map in memory from each user to their
  live sockets. Two devices show up once, and closing one keeps the user online. An API restart
  drops every socket anyway, so presence isn't stored in the DB.
- **Changes are pushed.** When a user goes from 0 to 1 sockets or from 1 to 0, the server sends the
  update to everyone who shares a project with them. On connect, the client gets the current list.
- **Only people who share a project with you.** The list is filtered through `project_members`, so
  users with no shared projects aren't shown at all (e.g. Sam in the seed data).

## Avoided

- **HTTP heartbeat (`POST /presence`):** the socket already proves the device is there, so this
  would duplicate it.
- **Polling for the online list:** the server already knows when someone joins or leaves, so it
  pushes the change.
- **Separate `devices` table:** sessions already map one-to-one to devices.
