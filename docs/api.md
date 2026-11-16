# Kerf API

The API runs at `http://localhost:4000`. It sends and receives JSON.

## Authorization

Every route except `/health` needs this header:

```
Authorization: Bearer <token>
```

The seed tokens are `alex-7f3c2a91`, `sam-4b8e10d6` and `priya-2d9e5b07`. A missing or wrong token returns `401 { "error": "Unauthorized" }`.

Every error has the same shape: `{ "error": "message" }`.

## Routes

| Method | Path                         | What it does                                 |
| ------ | ---------------------------- | -------------------------------------------- |
| GET    | `/health`                    | Checks the server is up (no token needed)    |
| GET    | `/me`                        | Returns the logged-in user                   |
| GET    | `/projects`                  | Lists your projects                          |
| GET    | `/projects/:id/measurements` | Lists a project's groups and measurements    |
| POST   | `/groups/:id/measurements`   | Adds a measurement to a group                |
| GET    | `/feed`                      | Returns the 20 latest measurements           |
| POST   | `/dev/reset`                 | Resets the database to the seed data         |

## Inputs and outputs

**GET `/health`** returns `{ ok: true }`.

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

**POST `/dev/reset`** returns `{ ok: true }`.

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
