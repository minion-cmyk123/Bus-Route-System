import type { Database } from './database.js';
const migrations = [
  `CREATE TABLE stops (
 id text PRIMARY KEY, name text NOT NULL, area text NOT NULL,
 lat double precision NOT NULL CHECK(lat BETWEEN -90 AND 90),
 lng double precision NOT NULL CHECK(lng BETWEEN -180 AND 180), accessible boolean NOT NULL DEFAULT true
);
CREATE TABLE routes (
 id text PRIMARY KEY, code text NOT NULL UNIQUE, name text NOT NULL, color text NOT NULL,
 fare integer NOT NULL CHECK(fare >= 0), status text NOT NULL CHECK(status IN ('active','delayed','suspended')),
 frequency integer NOT NULL CHECK(frequency BETWEEN 1 AND 180),
 start_minute integer NOT NULL CHECK(start_minute BETWEEN 0 AND 1439),
 end_minute integer NOT NULL CHECK(end_minute BETWEEN 0 AND 1439 AND end_minute >= start_minute),
 days jsonb NOT NULL DEFAULT '[0,1,2,3,4,5,6]', accessible boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE route_stops (
 route_id text REFERENCES routes(id) ON DELETE CASCADE,
 stop_id text REFERENCES stops(id), sequence integer NOT NULL CHECK(sequence >= 0),
 offset_minutes integer NOT NULL CHECK(offset_minutes BETWEEN 0 AND 1439),
 PRIMARY KEY(route_id, sequence), UNIQUE(route_id, stop_id)
);
CREATE INDEX route_stops_stop_idx ON route_stops(stop_id);
CREATE TABLE users (
 id text PRIMARY KEY, email text NOT NULL UNIQUE, name text NOT NULL, password_hash text NOT NULL,
 role text NOT NULL DEFAULT 'passenger' CHECK(role IN ('passenger','admin')), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
 token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
CREATE TABLE auth_attempts (key text PRIMARY KEY, attempts integer NOT NULL, reset_at timestamptz NOT NULL);
CREATE TABLE saved_journeys (
 id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 from_id text NOT NULL REFERENCES stops(id), to_id text NOT NULL REFERENCES stops(id),
 label text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id, from_id, to_id), CHECK(from_id <> to_id)
);
CREATE INDEX saved_journeys_user_idx ON saved_journeys(user_id);
CREATE TABLE alerts (
 id text PRIMARY KEY, title text NOT NULL, message text NOT NULL,
 severity text NOT NULL CHECK(severity IN ('info','warning','critical')),
 route_id text REFERENCES routes(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL
);
CREATE INDEX alerts_expiry_idx ON alerts(expires_at);
CREATE TABLE audit_logs (
 id text PRIMARY KEY, actor_id text REFERENCES users(id) ON DELETE SET NULL,
 action text NOT NULL, entity_id text NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created_idx ON audit_logs(created_at DESC);
CREATE TABLE settings (key text PRIMARY KEY, value text NOT NULL);`,
];
export async function migrate(db: Database) {
  // Single migration runner; table lock serializes concurrent deployment jobs.
  await db.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  await db.transaction(async (tx) => {
    await tx.query('LOCK TABLE schema_migrations IN EXCLUSIVE MODE');
    const applied = new Set(
      (await tx.query<{ version: number }>('SELECT version FROM schema_migrations')).rows.map(
        (x) => x.version,
      ),
    );
    for (let i = 0; i < migrations.length; i++) {
      if (applied.has(i + 1)) continue;
      // Statements are authored migrations, never user input.
      for (const statement of migrations[i].split(';').filter((s) => s.trim()))
        await tx.query(statement);
      await tx.query('INSERT INTO schema_migrations(version) VALUES($1)', [i + 1]);
    }
  });
}
