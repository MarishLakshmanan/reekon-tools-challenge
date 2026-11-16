# Kerf API

The API runs at `http://localhost:4000`. It sends and receives JSON.

## Authorization

Every route except `/health` and `/login` needs this header:

```
Authorization: Bearer <token>
```

Get a token from `POST /login`. The seeded passwords are in `packages/api/data/credentials.md`. A missing, wrong or signed-out token returns `401 { "error": "Unauthorized" }`.

Every error has the same shape: `{ "error": "message" }`.

## Routes

| Method | Path                         | What it does                                           |
| ------ | ---------------------------- | ------------------------------------------------------ |
| GET    | `/health`                    | Checks the server is up (no token needed)              |
| POST   | `/login`                     | Signs in and returns a session token (no token needed) |
| POST   | `/logout`                    | Ends the session for the token you sent                |
| GET    | `/me`                        | Returns the logged-in user                             |
| GET    | `/projects`                  | Lists your projects                                    |
| GET    | `/projects/:id/measurements` | Lists a project's groups and measurements              |
| POST   | `/groups/:id/measurements`   | Adds a measurement to a group                          |
| GET    | `/feed`                      | Returns the 20 latest measurements                     |
| POST   | `/dev/reset`                 | Resets the database to the seed data                   |

## Inputs and outputs

**GET `/health`** returns `{ ok: true }`.

**POST `/login`** takes `{ username: string, password: string, deviceId?: string }` and returns `{ token: string, user: { id, name } }`. It returns `400` if either is missing and `401` if they don't match. Each login creates a separate session, so one user can be signed in on several devices. `deviceId` is stored with the session.

**POST `/logout`** deletes the session and returns `{ ok: true }`. Other sessions stay signed in.

**GET `/me`** returns `{ id, name }`.

**GET `/projects`** returns a list of projects:

```ts
{ id: number, name: string, measurementCount: number }[]
```

**GET `/projects/:id/measurements`** returns a list of groups, each with its measurements:

```ts
{ id: number, projectId: number, name: string, measurements: Measurement[] }[]
```

It returns `404` if the project isn't yours.

**POST `/groups/:id/measurements`** takes this body:

```ts
{ value: number, label: string, deviceId?: string }
```

It returns the new `Measurement` with status `201`. It returns `400` if `value` isn't a positive integer or `label` is empty, and `404` if the group isn't yours.

**GET `/feed`** returns a list of measurements, newest first. Each one also has `projectId`, `projectName` and `groupName`.

**POST `/dev/reset`** restores the seed projects and measurements, keeps users and sessions, and returns `{ ok: true }`.

## WebSocket

`ws://localhost:4000/ws` carries live measurements and who's online. Messages are JSON with a `type`.
The first message must be `auth`, within 5 seconds, or the server closes the socket. A bad token
closes it with code `4401`.

| Direction | Message | What it does |
| --------- | ------- | ------------ |
| Client → server | `{ type: 'auth', token }` | Signs in with a session token |
| Client → server | `{ type: 'resume', after }` | Subscribes to live measurements. `after` is the highest measurement `id` the client has, or `null` for the latest 20. The server replies with every measurement from your projects after it |
| Client → server | `{ type: 'pong' }` | Answers a `ping` |
| Server → client | `{ type: 'ready' }` | `auth` worked; send `resume` next |
| Server → client | `{ type: 'measurements', items: FeedItem[] }` | Catch-up and live measurements from your projects |
| Server → client | `{ type: 'presence', online: User[] }` | Everyone who shares a project with you and has a socket open, including you |
| Server → client | `{ type: 'reset' }` | Data was reset; clear your list and send `resume` with `null` |
| Server → client | `{ type: 'ping' }` | Sent every 20 seconds. A socket that hasn't answered by the next ping is closed |

## Measurement

```ts
{
  id: number,
  groupId: number,
  value: number,     // millimetres
  label: string,
  deviceId: string,
  createdAt: number, // timestamp in milliseconds
  createdBy: number  // user ID
}
```
