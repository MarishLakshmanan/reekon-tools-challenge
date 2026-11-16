# 4. CSV export

A dashboard button downloads the measurements from all your projects as one CSV file. The file
opens cleanly in Excel and Google Sheets. The `Measurement` column matches what the app shows, and
`Value (mm)` is a plain number that works in formulas. The export works on desktop and on a phone.

## Columns

One row per measurement, sorted by project, then group (in the order they were created), then time taken:

| Column        | Example                        | Source                                          |
| ------------- | ------------------------------ | ----------------------------------------------- |
| `Project`     | `Hendricks Kitchen Remodel`    | `projects.name`                                 |
| `Group`       | `Base cabinets`                | `measurement_groups.name`                       |
| `Label`       | `Sink wall run`                | `measurements.label`                            |
| `Measurement` | `120"` / `120.00"` / `3048 mm` | `formatValue(value, unit)`, same as the app     |
| `Value (mm)`  | `3048`                         | `measurements.value`, unchanged                 |
| `Taken by`    | `Alex`                         | `users.name` via `created_by`                   |
| `Device`      | `TP-3F2A`                      | `measurements.device_id`, the tape measure's ID |
| `Taken at`    | `2026-11-16 14:03:00`          | `created_at` in the requested timezone          |

## Decisions

- **Server builds the file: `GET /export.csv?unit=<unit>&tz=<IANA zone>`.** It uses the same bearer
  token check as every other route. It takes measurements only from projects the user belongs to,
  filtered through `project_members` like the other routes, and joins the project, group and user
  names. `unit` is one of `fractional | decimal | metric`, and `tz` is a zone such as
  `Europe/London`. Either one missing or invalid returns `400`. If there are no measurements, the
  response is the header row alone.
- **The client sends `unit` and `tz`.** The unit is a per-device setting (`src/lib/settings.ts`)
  that the server doesn't know about, and timestamps should be in the user's local time.
- **Response headers:** `Content-Type: text/csv; charset=utf-8` and
  `Content-Disposition: attachment; filename="kerf-measurements-YYYY-MM-DD.csv"`. The client
  doesn't read this header: it names the file itself, with the date in the device's timezone.
- **Two value columns.** `Measurement` is the display string, so it matches the app. `Value (mm)`
  is the stored integer, which is exact and works in formulas. A single column can't do both: a
  display string like `3 1/4"` is text, so formulas ignore it, and without the `"` a value like
  `1/4` turns into a date.
- **Dates as `YYYY-MM-DD HH:mm:ss`.** Excel and Sheets both read this format as a date. They don't
  reliably parse epoch milliseconds or ISO `T…Z` strings.
- **`toCsv(headers, rows)` in `packages/shared`.** It's a pure function with no DB or HTTP code, so
  it can be tested on its own, but this task shipped without automated tests. The endpoint builds the rows, including calling `formatValue`, and
  passes them to `toCsv()`. It writes CSV this way:
  - **UTF-8 BOM** (`\uFEFF`) at the start. Without it, Excel on Windows reads the file in
    a legacy code page (usually Windows-1252) and garbles non-ASCII text.
  - **RFC 4180 quoting.** Any field containing `,`, `"`, CR or LF goes in double quotes, with each
    inner `"` doubled. Line endings are `\r\n`.
  - **Formula-injection guard.** A text field that starts with `=`, `+`, `-`, `@`, tab or CR gets a
    leading `'`, so a teammate's label like `=HYPERLINK(...)` shows as text instead of running.
    Number fields are never prefixed.
- **Client delivery depends on the platform.** A plain link can't send the bearer token, so the
  client always `fetch`es the CSV with the header. `Response.text()` drops a leading BOM (the fetch spec decodes it away), so the
  client adds it back before saving. Then:
  - **Web:** turns the response into a `Blob` and clicks a temporary `<a download>` link.
  - **iOS and Android:** writes the file to the cache directory and opens the share sheet, from
    which it can be saved to Files or Drive or opened in Sheets or Excel. Check the Expo file-system
    and sharing docs for the SDK version in `package.json` before using their APIs.

## Avoided

- **Dumping the tables as they are:** this would include other users' projects, and IDs and epoch
  numbers mean nothing in a spreadsheet.
- **Building the file on the client:** the client would need every measurement loaded. The server
  already has one query that does the joins and access check.
- **Exporting unsynced (`pending`) measurements:** the export is built from server data, so it holds
  only readings that have synced.
- **A numeric column in the user's unit:** millimetres are what's stored, so they're exact and the
  same for everyone. The user's unit appears only in `Measurement`.
- **Locale handling:** in locales where Excel's list separator is `;`, the file may open in one
  column. This is accepted. The `sep=,` hint line was rejected because it shows up as a junk first row
  in Sheets.
- **XLSX and TSV:** the task asks for CSV, and an XLSX library is heavy on mobile.
- **A signed or cookie download URL:** fetching with the existing bearer token works on every
  platform without new auth code.

## Not done (time)

The export is one button that downloads everything in your projects. Next, let the user filter it
before downloading:

- choose which columns to include
- only measurements captured by a given person
- only measurements from chosen projects, or from a specific job
