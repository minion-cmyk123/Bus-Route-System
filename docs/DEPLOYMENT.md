# Deployment and operations

## Local production build preview

```bash
npm ci
npm run build
```

Set `APP_ORIGIN=http://localhost:3001` in `.env`, keep `NODE_ENV=development`, then `npm start`. This serves the compiled client and API from the same origin with the local embedded database. It is a preview, not the production security mode.

## HTTPS production deployment

Prerequisites: Docker Engine with Compose v2, a domain pointing to the server, inbound 80/443, and a backup location. This topology exposes only Caddy; PostgreSQL and the app stay on the private Compose network.

Create a local, ignored `.env`:

```dotenv
PUBLIC_DOMAIN=transit.example.com
ACME_EMAIL=admin@example.com
POSTGRES_PASSWORD=replace-with-a-strong-url-safe-random-value
```

The password is interpolated into a PostgreSQL URL, so use URL-safe characters or supply a separately encoded connection URL in an adapted configuration.

```bash
docker compose -f compose.production.yaml up -d --build
```

The migration job must complete successfully before the app starts. Caddy obtains a TLS certificate for the configured domain. The production network starts empty; create an administrator from JSON stdin:

```bash
docker compose -f compose.production.yaml exec -T app node dist/scripts/create-admin.js < /absolute/path/to/admin-input.json
```

Delete the temporary credential file after provisioning. Sign in, add stops, create both route directions, and publish appropriate notices. There are no seeded users or default credentials.

For a **portfolio demonstration only**, explicitly seed illustrative data:

```bash
docker compose -f compose.production.yaml exec -e DEMO_DATA=true app node dist/server/db/seed.js
```

The seed records a persistent demo flag. Do not seed a real operator database: sample routes would be mixed into operational data. Use separate databases for demos and real deployments.

## Managed PostgreSQL

You can run the image without Compose, behind your existing HTTPS ingress. Configure:

| Variable                         | Purpose                                      |
| -------------------------------- | -------------------------------------------- |
| `NODE_ENV=production`            | Enforce external PostgreSQL and HTTPS origin |
| `APP_ORIGIN=https://your-domain` | Exact browser origin; no trailing slash      |
| `DATABASE_URL`                   | PostgreSQL connection URL                    |
| `DATABASE_SSL=true`              | Enable certificate-verified database TLS     |
| `DATABASE_CA`                    | Optional PEM root CA for private providers   |
| `DEMO_DATA=false`                | No automatic demo seed                       |
| `TRUST_PROXY`                    | True only behind a controlled proxy chain    |
| `PORT` / `HOST`                  | Default 3001 / 0.0.0.0                       |

Do not combine contradictory SSL options in the connection URL and environment. Test the provider’s CA settings; certificate verification is never intentionally disabled.

Run `node dist/server/db/migrate.js` as a release job before starting `node dist/server/index.js`. Run only one migration release job at a time; database locking also guards against accidental overlap. Keep the previous image for application rollback; schema changes must remain backward-compatible. Restore a backup for destructive schema rollback, not an invented down migration.

## Capacity and scaling

Each API replica uses at most 15 PostgreSQL connections. Budget total connections across replicas and leave room for migrations and administration. Sessions and authentication limits are shared, but general request limits are process-local: apply a shared edge limiter for public multi-replica service.

The catalogue and timetable algorithm target a small city. Before expanding, benchmark your actual route graph, replace exhaustive route-pair searches with an indexed transit algorithm, partition catalogues by region, and add cache invalidation. No traffic capacity or latency SLA has been established by this repository.

Use a managed PostgreSQL service or a replication/backup plan for availability. The sample single-host Compose deployment is not high availability. It does not include automatic failover, autoscaling or distributed tracing.

## Monitoring and backup

- `/api/health`: process liveness; `/api/ready`: database query readiness.
- Inspect structured stdout logs and the `X-Request-Id` response header.
- Collect error rates, p95/p99 latency, database saturation, restart count, and auth throttles.
- Page on sustained readiness failures and test the incident response path.
- Configure encrypted database backups, retention and off-host storage.

Example logical backup (adapt paths and retention to your system):

```bash
docker compose -f compose.production.yaml exec -T db pg_dump -U transit -d transit -Fc > transit.backup
```

Restore to an isolated database and verify row counts and application workflows before trusting backups. Saved journeys and emails are personal data; restrict backup access and choose a retention policy. Audit logs currently have no automatic retention job.

## Before a public launch

Replace illustrative data, load-test the expected workload, validate accessibility manually, add email verification/recovery and MFA if needed, define account deletion/retention procedures, and perform an independent security review. Container builds and CI configuration are included; inspect a successful pipeline in your own GitHub repository before deployment.
