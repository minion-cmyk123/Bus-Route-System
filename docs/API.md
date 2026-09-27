# API reference

Base path: `/api`. JSON request and response bodies. Cookie-based authentication. All mutations must include `Content-Type: application/json` when sending a body and `X-Requested-With: transit-client`. Browser origin must match `APP_ORIGIN`. There is no cross-origin browser API.

Errors use `{"error":"Human-readable message","requestId":"..."}`. Common statuses: 400 validation, 401 unauthenticated, 403 unauthorized/origin rejected, 404 missing record, 409 conflict, 429 throttled, 500 internal failure.

| Method | Path                | Access        | Result                                         |
| ------ | ------------------- | ------------- | ---------------------------------------------- |
| GET    | `/health`           | Public        | Process liveness                               |
| GET    | `/ready`            | Public        | Database/migration-table readiness             |
| GET    | `/network`          | Public        | Stops, directional routes and unexpired alerts |
| GET    | `/journeys`         | Public        | Up to eight timetable itineraries              |
| GET    | `/auth/me`          | Public        | `{user}` or `{user:null}`                      |
| POST   | `/auth/register`    | Public        | Create a passenger and a session               |
| POST   | `/auth/login`       | Public        | Create/rotate a session                        |
| POST   | `/auth/logout`      | Public        | Revoke current session and clear cookie        |
| GET    | `/saved`            | Passenger     | Current user’s saved journeys                  |
| POST   | `/saved`            | Passenger     | Save an origin/destination pair                |
| DELETE | `/saved/:id`        | Owner         | Delete saved journey, HTTP 204                 |
| GET    | `/admin/overview`   | Administrator | Counts and latest 30 audit events              |
| POST   | `/admin/stops`      | Administrator | Create a stop                                  |
| POST   | `/admin/routes`     | Administrator | Create a directional route                     |
| PUT    | `/admin/routes/:id` | Administrator | Replace route with a version check             |
| POST   | `/admin/alerts`     | Administrator | Publish a notice                               |
| DELETE | `/admin/alerts/:id` | Administrator | Remove a notice, HTTP 204                      |

## Journey search

```http
GET /api/journeys?from=saddar&to=secretariat&date=2026-09-26&time=08:00&accessible=false
```

`date`: valid `YYYY-MM-DD`; `time`: `HH:mm`, Pakistan local time; `accessible`: optional `true`/`false`. Different, existing stops are required. Historical dates are allowed for timetable exploration. Times in returned journeys and legs are integer minutes since midnight; fare is integer PKR.

## Accounts

Registration: `{"name":"A Rider","email":"rider@example.com","password":"a-long-unique-password"}`. Passwords are 12–128 characters; names 1–80. Email is normalized to lowercase. Login accepts email and password only. Role changes are not part of this API; use the administrator provisioning command to create an operator.

Authentication limits: 15 attempts per normalized email and 60 per IP in 15 minutes, shared across API instances. Registration has an additional per-process limit of 10 per 15 minutes. Sessions expire after seven days and are revoked immediately on logout. Expired sessions/counters are cleaned during auth activity.

## Save a journey

```json
{ "fromId": "saddar", "toId": "secretariat", "label": "My commute" }
```

No ticket or seat is reserved. This stores a reusable search pair. At most 50 per account; duplicates return 409.

## Write a route

```json
{
  "code": "C5",
  "name": "Community Link",
  "color": "#38866b",
  "fare": 50,
  "status": "active",
  "frequency": 15,
  "startMinute": 360,
  "endMinute": 1200,
  "days": [0, 1, 2, 3, 4, 5, 6],
  "accessible": true,
  "stops": [
    { "id": "saddar", "offset": 0 },
    { "id": "faizabad", "offset": 20 }
  ]
}
```

For PUT, include the `version` from the current network response. `days` uses Sunday=0. Stop IDs must be unique and existing, offsets start at zero and strictly increase, and the last trip must finish before midnight. Frequency is 1–180 minutes; fare is 0–10,000 PKR; 2–50 stops. Route codes are unique uppercase alphanumeric/hyphen strings up to 10 characters. Direction is the listed stop order; create a separate return route.

## Write a stop or notice

Stop: `{"name":"Central","area":"City","lat":33.7,"lng":73.1,"accessible":true}`.

Notice: `{"title":"Timetable update","message":"Service starts later tomorrow.","severity":"info","routeId":null,"expiresAt":"2026-10-01T18:00:00+05:00"}`. Severity is info, warning or critical. Expiry must be in the future. `routeId:null` means network-wide.

## Caching and limits

API responses are `no-store` to avoid personal data leakage. The client caches queries in memory and refreshes network data every 60 seconds. The global API limiter allows 180 requests per IP per minute per process. Bodies are limited to 32 KiB. For a public multi-instance deployment, configure a shared edge rate limiter as well.
