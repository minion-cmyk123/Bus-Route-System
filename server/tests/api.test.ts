import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase, type Database } from '../db/database.js';
import { migrate } from '../db/schema.js';
import { seedDemo } from '../db/fixtures.js';
import { buildApp } from '../app.js';
import { readConfig } from '../config.js';
import { createUser, digest } from '../auth.js';
import type { Network } from '../../shared/types.js';
let db: Database;
let app: Awaited<ReturnType<typeof buildApp>>;
let passengerCookie: string;
let otherCookie: string;
let adminCookie: string;
let network: Network;
const headers = { 'x-requested-with': 'transit-client', origin: 'http://localhost:5173' };
function session(res: { cookies: { name: string; value: string }[] }) {
  return res.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}
before(async () => {
  const config = readConfig({
    NODE_ENV: 'test',
    PGLITE_PATH: ':memory:',
    ...(process.env.TEST_DATABASE_URL ? { DATABASE_URL: process.env.TEST_DATABASE_URL } : {}),
  });
  db = await createDatabase(config);
  await migrate(db);
  await seedDemo(db);
  app = await buildApp(db, config);
  await createUser(db, 'Operator', 'admin@example.test', 'test-admin-password', 'admin');
  const admin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers,
    payload: { email: 'admin@example.test', password: 'test-admin-password' },
  });
  adminCookie = session(admin);
  for (const email of ['rider@example.test', 'other@example.test']) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers,
      payload: { name: 'Rider', email, password: 'correct-horse-route' },
    });
    assert.equal(res.statusCode, 201);
    if (email.startsWith('rider')) passengerCookie = session(res);
    else otherCookie = session(res);
  }
  network = (await app.inject('/api/network')).json();
});
after(async () => {
  await app.close();
  await db.close();
});
test('health, ready and network return real database-backed data', async () => {
  assert.equal((await app.inject('/api/health')).statusCode, 200);
  assert.equal((await app.inject('/api/ready')).statusCode, 200);
  assert.equal(network.stops.length, 12);
  assert.equal(network.routes.length, 8);
  assert.equal(network.demo, true);
});
test('migrations and seed can be safely rerun without duplicating data', async () => {
  await migrate(db);
  await seedDemo(db);
  assert.equal((await app.inject('/api/network')).json().routes.length, 8);
});
test('journey API validates dates and returns the correct timed journey', async () => {
  const good = await app.inject(
    '/api/journeys?from=saddar&to=secretariat&date=2026-09-26&time=08:00',
  );
  assert.equal(good.statusCode, 200);
  assert.equal(good.json().journeys[0].arrival, 536);
  for (const url of [
    '/api/journeys?from=saddar&to=secretariat&date=2026-02-30&time=08:00',
    '/api/journeys?from=saddar&to=saddar&date=2026-09-26&time=08:00',
    '/api/journeys?from=missing&to=saddar&date=2026-09-26&time=08:00',
  ])
    assert.equal((await app.inject(url)).statusCode, 400);
});
test('CSRF check blocks missing headers and foreign origins', async () => {
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/logout' })).statusCode, 403);
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: { ...headers, origin: 'https://attacker.test', cookie: passengerCookie },
      })
    ).statusCode,
    403,
  );
});
test('session cookies are HttpOnly and SameSite; password hashes are never returned', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers,
    payload: { email: 'rider@example.test', password: 'correct-horse-route' },
  });
  passengerCookie = session(res);
  assert.match(String(res.headers['set-cookie']), /HttpOnly/);
  assert.match(String(res.headers['set-cookie']), /SameSite=Lax/);
  assert.equal(res.json().user.password_hash, undefined);
  const me = await app.inject({ url: '/api/auth/me', headers: { cookie: passengerCookie } });
  assert.equal(me.json().user.email, 'rider@example.test');
});
test('bad credentials use generic errors and registration cannot grant admin', async () => {
  const bad = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers,
    payload: { email: 'noone@example.test', password: 'bad' },
  });
  assert.equal(bad.statusCode, 401);
  assert.equal(bad.json().error, 'Email or password is incorrect.');
  const escalation = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    headers,
    payload: {
      name: 'Bad',
      email: 'bad@example.test',
      password: 'correct-horse-route',
      role: 'admin',
    },
  });
  assert.equal(escalation.statusCode, 400);
});
test('private data requires authentication and operations requires admin', async () => {
  assert.equal((await app.inject('/api/saved')).statusCode, 401);
  assert.equal((await app.inject('/api/admin/overview')).statusCode, 401);
  assert.equal(
    (await app.inject({ url: '/api/admin/overview', headers: { cookie: passengerCookie } }))
      .statusCode,
    403,
  );
});
test('saved journeys persist, are unique, and cannot be read or deleted by another rider', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/saved',
    headers: { ...headers, cookie: passengerCookie },
    payload: { fromId: 'saddar', toId: 'secretariat', label: 'My commute' },
  });
  assert.equal(res.statusCode, 201);
  const id = res.json().id;
  const duplicate = await app.inject({
    method: 'POST',
    url: '/api/saved',
    headers: { ...headers, cookie: passengerCookie },
    payload: { fromId: 'saddar', toId: 'secretariat', label: 'Duplicate' },
  });
  assert.equal(duplicate.statusCode, 409);
  assert.equal(
    (await app.inject({ url: '/api/saved', headers: { cookie: otherCookie } })).json().journeys
      .length,
    0,
  );
  assert.equal(
    (
      await app.inject({
        method: 'DELETE',
        url: `/api/saved/${id}`,
        headers: { ...headers, cookie: otherCookie },
      })
    ).statusCode,
    404,
  );
  assert.equal(
    (
      await app.inject({
        method: 'DELETE',
        url: `/api/saved/${id}`,
        headers: { ...headers, cookie: passengerCookie },
      })
    ).statusCode,
    204,
  );
});
test('admin changes are atomic, versioned, audited and change planner availability', async () => {
  const r = network.routes.find((r) => r.id === 'metro-red')!;
  const { id, stops, ...fields } = r;
  const input = {
    ...fields,
    stops: stops.map((s) => ({ id: s.id, offset: s.offset })),
    status: 'suspended',
  };
  const res = await app.inject({
    method: 'PUT',
    url: `/api/admin/routes/${id}`,
    headers: { ...headers, cookie: adminCookie },
    payload: input,
  });
  assert.equal(res.statusCode, 200);
  assert.equal(
    (
      await app.inject({
        method: 'PUT',
        url: `/api/admin/routes/${id}`,
        headers: { ...headers, cookie: adminCookie },
        payload: input,
      })
    ).statusCode,
    409,
  );
  const bad = {
    ...input,
    version: 2,
    stops: [
      { id: 'saddar', offset: 0 },
      { id: 'missing-stop', offset: 10 },
    ],
  };
  assert.equal(
    (
      await app.inject({
        method: 'PUT',
        url: `/api/admin/routes/${id}`,
        headers: { ...headers, cookie: adminCookie },
        payload: bad,
      })
    ).statusCode,
    400,
  );
  const current = (await app.inject('/api/network'))
    .json()
    .routes.find((r: { id: string }) => r.id === id);
  assert.equal(current.version, 2);
  assert.equal(current.stops.length, 8);
  const plans = (
    await app.inject('/api/journeys?from=saddar&to=secretariat&date=2026-09-26&time=08:00')
  ).json().journeys;
  assert.equal(plans.length, 0);
  const audit = (
    await app.inject({ url: '/api/admin/overview', headers: { cookie: adminCookie } })
  ).json().auditLogs;
  assert.equal(audit[0].action, 'route.updated');
});
test('admin can create stops, routes, and notices; expired notices stay out of public data', async () => {
  const stop = await app.inject({
    method: 'POST',
    url: '/api/admin/stops',
    headers: { ...headers, cookie: adminCookie },
    payload: { name: 'Test stop', area: 'Test area', lat: 33.7, lng: 73.1, accessible: true },
  });
  assert.equal(stop.statusCode, 201);
  const created = await app.inject({
    method: 'POST',
    url: '/api/admin/routes',
    headers: { ...headers, cookie: adminCookie },
    payload: {
      code: 'T1',
      name: 'Test line',
      color: '#336633',
      fare: 20,
      status: 'active',
      frequency: 15,
      startMinute: 360,
      endMinute: 1200,
      days: [0, 1, 2, 3, 4, 5, 6],
      accessible: true,
      stops: [
        { id: 'saddar', offset: 0 },
        { id: stop.json().id, offset: 10 },
      ],
    },
  });
  assert.equal(created.statusCode, 201);
  const notice = await app.inject({
    method: 'POST',
    url: '/api/admin/alerts',
    headers: { ...headers, cookie: adminCookie },
    payload: {
      title: 'Test notice',
      message: 'New timetable.',
      severity: 'info',
      routeId: created.json().id,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    },
  });
  assert.equal(notice.statusCode, 201);
  await db.query("UPDATE alerts SET expires_at=now()-interval '1 minute' WHERE id=$1", [
    notice.json().id,
  ]);
  assert.ok(
    !(await app.inject('/api/network'))
      .json()
      .alerts.some((a: { id: string }) => a.id === notice.json().id),
  );
});
test('expired sessions cannot access user data', async () => {
  const token = otherCookie.split('=')[1];
  await db.query("UPDATE sessions SET expires_at=now()-interval '1 minute' WHERE token_hash=$1", [
    digest(token),
  ]);
  assert.equal(
    (await app.inject({ url: '/api/saved', headers: { cookie: otherCookie } })).statusCode,
    401,
  );
});
test('logout invalidates the server session', async () => {
  await app.inject({
    method: 'POST',
    url: '/api/auth/logout',
    headers: { ...headers, cookie: passengerCookie },
  });
  assert.equal(
    (await app.inject({ url: '/api/saved', headers: { cookie: passengerCookie } })).statusCode,
    401,
  );
});
test('authentication throttling is backed by shared database counters', async () => {
  for (let i = 0; i < 15; i++)
    await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers,
      payload: { email: 'locked@example.test', password: 'wrong' },
    });
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers,
        payload: { email: 'locked@example.test', password: 'wrong' },
      })
    ).statusCode,
    429,
  );
});
test('production configuration rejects embedded database and insecure origins', () => {
  assert.throws(() => readConfig({ NODE_ENV: 'production' }), /DATABASE_URL/);
  assert.throws(
    () => readConfig({ NODE_ENV: 'production', DATABASE_URL: 'postgres://db' }),
    /HTTPS/,
  );
});
