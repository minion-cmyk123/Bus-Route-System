import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import staticPlugin from '@fastify/static';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ZodError } from 'zod';
import type { Database, Queryable } from './db/database.js';
import type { Config } from './config.js';
import type { User, SavedJourney } from '../shared/types.js';
import { createAuth, createUser, hashPassword, verifyPassword, HttpError } from './auth.js';
import { getNetwork } from './network.js';
import { planJourneys } from './planner.js';
import {
  signupSchema,
  loginSchema,
  idSchema,
  routeSchema,
  stopSchema,
  alertSchema,
  journeySchema,
  savedSchema,
} from './validation.js';
export async function buildApp(db: Database, config: Config) {
  const production = config.NODE_ENV === 'production';
  const app = Fastify({
    logger:
      config.NODE_ENV === 'test'
        ? false
        : { level: 'info', redact: ['req.headers.cookie', 'req.headers.authorization'] },
    bodyLimit: 32768,
    trustProxy: config.TRUST_PROXY === 'true',
    requestTimeout: 15000,
  });
  await app.register(cookie);
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        upgradeInsecureRequests: production ? [] : null,
      },
    },
    hsts: production,
  });
  await app.register(rateLimit, {
    max: 180,
    timeWindow: '1 minute',
    allowList: (request) => !request.url.startsWith('/api/'),
  });
  const auth = createAuth(db, production);
  const dummyHash = await hashPassword(randomUUID());
  app.addHook('onRequest', async (req, reply) => {
    reply.header('X-Request-Id', req.id);
    if (req.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (
        req.headers['x-requested-with'] !== 'transit-client' ||
        (req.headers.origin && req.headers.origin !== config.APP_ORIGIN) ||
        req.headers['sec-fetch-site'] === 'cross-site'
      ) {
        throw new HttpError(403, 'Request origin could not be verified.');
      }
    }
  });
  app.setErrorHandler((error, req, reply) => {
    if (error instanceof ZodError)
      return reply
        .code(400)
        .send({ error: error.issues.map((i) => i.message).join(' '), requestId: req.id });
    const err = error as Error & { code?: string; statusCode?: number };
    if (err.code === '23505')
      return reply.code(409).send({ error: 'This record already exists.', requestId: req.id });
    if (err.code === '23503')
      return reply
        .code(400)
        .send({ error: 'A referenced stop or route does not exist.', requestId: req.id });
    const status =
      err.statusCode && err.statusCode >= 400 && err.statusCode < 500 ? err.statusCode : 500;
    if (status === 500) req.log.error({ err }, 'Request failed');
    return reply.code(status).send({
      error: status === 500 ? 'Something went wrong. Please try again.' : err.message,
      requestId: req.id,
    });
  });
  app.get('/api/health', async () => ({ status: 'ok' }));
  app.get('/api/ready', async (_req, reply) => {
    try {
      await db.query('SELECT 1 FROM schema_migrations LIMIT 1');
      return { status: 'ready' };
    } catch {
      return reply.code(503).send({ status: 'unavailable' });
    }
  });
  app.get('/api/network', async () =>
    db.transaction(async (tx) => {
      await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      return getNetwork(tx);
    }),
  );
  app.get('/api/journeys', async (req) => {
    const q = journeySchema.parse(req.query);
    const date = new Date(`${q.date}T12:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== q.date)
      throw new HttpError(400, 'Choose a valid service date.');
    const network = await db.transaction(async (tx) => {
      await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      return getNetwork(tx);
    });
    if (!network.stops.some((s) => s.id === q.from) || !network.stops.some((s) => s.id === q.to))
      throw new HttpError(400, 'One of the selected stops no longer exists.');
    const [h, m] = q.time.split(':').map(Number);
    return {
      journeys: planJourneys(
        network.routes,
        q.from,
        q.to,
        h * 60 + m,
        date.getUTCDay(),
        q.accessible === 'true',
      ),
      date: q.date,
      timezone: network.timezone,
    };
  });
  app.get('/api/auth/me', async (req) => ({ user: await auth.user(req) }));
  app.post(
    '/api/auth/register',
    { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
    async (req, reply) => {
      const input = signupSchema.parse(req.body);
      await auth.throttle(req, input.email);
      const user = await createUser(db, input.name, input.email, input.password);
      await auth.start(user, req, reply);
      return reply.code(201).send({ user });
    },
  );
  app.post('/api/auth/login', async (req, reply) => {
    const input = loginSchema.parse(req.body);
    await auth.throttle(req, input.email);
    const row = (
      await db.query<User & { password_hash: string }>(
        'SELECT id,name,email,role,password_hash FROM users WHERE email=$1',
        [input.email],
      )
    ).rows[0];
    const valid = await verifyPassword(input.password, row?.password_hash ?? dummyHash);
    if (!row || !valid) throw new HttpError(401, 'Email or password is incorrect.');
    const { password_hash: _, ...user } = row;
    await auth.start(user, req, reply);
    return { user };
  });
  app.post('/api/auth/logout', async (req, reply) => {
    await auth.logout(req, reply);
    return { ok: true };
  });
  app.get('/api/saved', async (req) => {
    const user = await auth.require(req);
    return {
      journeys: (
        await db.query<SavedJourney>(
          'SELECT id,from_id AS "fromId",to_id AS "toId",label,created_at AS "createdAt" FROM saved_journeys WHERE user_id=$1 ORDER BY created_at DESC',
          [user.id],
        )
      ).rows,
    };
  });
  app.post('/api/saved', async (req, reply) => {
    const user = await auth.require(req);
    const input = savedSchema.parse(req.body);
    const id = randomUUID();
    await db.transaction(async (tx) => {
      await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [user.id]);
      const count = (
        await tx.query<{ count: string }>('SELECT count(*) FROM saved_journeys WHERE user_id=$1', [
          user.id,
        ])
      ).rows[0];
      if (Number(count.count) >= 50) throw new HttpError(400, 'You can save up to 50 journeys.');
      await tx.query(
        'INSERT INTO saved_journeys(id,user_id,from_id,to_id,label) VALUES($1,$2,$3,$4,$5)',
        [id, user.id, input.fromId, input.toId, input.label],
      );
    });
    return reply.code(201).send({ id, ...input });
  });
  app.delete('/api/saved/:id', async (req, reply) => {
    const user = await auth.require(req);
    const { id } = idSchema.parse(req.params);
    const result = await db.query(
      'DELETE FROM saved_journeys WHERE id=$1 AND user_id=$2 RETURNING id',
      [id, user.id],
    );
    if (!result.rows.length) throw new HttpError(404, 'Saved journey not found.');
    return reply.code(204).send();
  });
  const audit = (tx: Queryable, actor: string, action: string, id: string, details: unknown = {}) =>
    tx.query(
      'INSERT INTO audit_logs(id,actor_id,action,entity_id,details) VALUES($1,$2,$3,$4,$5)',
      [randomUUID(), actor, action, id, JSON.stringify(details)],
    );
  app.get('/api/admin/overview', async (req) => {
    await auth.require(req, true);
    const counts = (
      await db.query<{ users: number; routes: number; stops: number }>(
        `SELECT (SELECT count(*)::int FROM users) AS users,(SELECT count(*)::int FROM routes) AS routes,(SELECT count(*)::int FROM stops) AS stops`,
      )
    ).rows[0];
    const auditLogs = (
      await db.query(
        `SELECT a.id,a.action,a.entity_id AS "entityId",a.created_at AS "createdAt",u.name AS actor FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 30`,
      )
    ).rows;
    return { counts, auditLogs };
  });
  app.post('/api/admin/stops', async (req, reply) => {
    const user = await auth.require(req, true);
    const input = stopSchema.parse(req.body);
    const id = randomUUID();
    await db.transaction(async (tx) => {
      await tx.query(
        'INSERT INTO stops(id,name,area,lat,lng,accessible) VALUES($1,$2,$3,$4,$5,$6)',
        [id, input.name, input.area, input.lat, input.lng, input.accessible],
      );
      await audit(tx, user.id, 'stop.created', id);
    });
    return reply.code(201).send({ id, ...input });
  });
  async function writeRoute(req: Parameters<typeof auth.require>[0], update: boolean) {
    const user = await auth.require(req, true);
    const input = routeSchema.parse(req.body);
    const id = update ? idSchema.parse(req.params).id : randomUUID();
    await db.transaction(async (tx) => {
      if (update) {
        if (!input.version) throw new HttpError(400, 'The current route version is required.');
        const current = (
          await tx.query<{ version: number }>('SELECT version FROM routes WHERE id=$1 FOR UPDATE', [
            id,
          ])
        ).rows[0];
        if (!current) throw new HttpError(404, 'Route not found.');
        if (current.version !== input.version)
          throw new HttpError(
            409,
            'This route changed while you were editing. Reload it before saving.',
          );
        await tx.query(
          'UPDATE routes SET code=$2,name=$3,color=$4,fare=$5,status=$6,frequency=$7,start_minute=$8,end_minute=$9,days=$10,accessible=$11,version=version+1,updated_at=now() WHERE id=$1',
          [
            id,
            input.code,
            input.name,
            input.color,
            input.fare,
            input.status,
            input.frequency,
            input.startMinute,
            input.endMinute,
            JSON.stringify(input.days),
            input.accessible,
          ],
        );
        await tx.query('DELETE FROM route_stops WHERE route_id=$1', [id]);
      } else {
        await tx.query(
          'INSERT INTO routes(id,code,name,color,fare,status,frequency,start_minute,end_minute,days,accessible) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
          [
            id,
            input.code,
            input.name,
            input.color,
            input.fare,
            input.status,
            input.frequency,
            input.startMinute,
            input.endMinute,
            JSON.stringify(input.days),
            input.accessible,
          ],
        );
      }
      for (let i = 0; i < input.stops.length; i++)
        await tx.query(
          'INSERT INTO route_stops(route_id,stop_id,sequence,offset_minutes) VALUES($1,$2,$3,$4)',
          [id, input.stops[i].id, i, input.stops[i].offset],
        );
      await audit(tx, user.id, update ? 'route.updated' : 'route.created', id, {
        code: input.code,
        status: input.status,
      });
    });
    return { id };
  }
  app.post('/api/admin/routes', async (req, reply) =>
    reply.code(201).send(await writeRoute(req, false)),
  );
  app.put('/api/admin/routes/:id', async (req) => writeRoute(req, true));
  app.post('/api/admin/alerts', async (req, reply) => {
    const user = await auth.require(req, true);
    const input = alertSchema.parse(req.body);
    const id = randomUUID();
    if (new Date(input.expiresAt) <= new Date())
      throw new HttpError(400, 'The expiry must be in the future.');
    await db.transaction(async (tx) => {
      await tx.query(
        'INSERT INTO alerts(id,title,message,severity,route_id,expires_at) VALUES($1,$2,$3,$4,$5,$6)',
        [id, input.title, input.message, input.severity, input.routeId, input.expiresAt],
      );
      await audit(tx, user.id, 'alert.created', id);
    });
    return reply.code(201).send({ id });
  });
  app.delete('/api/admin/alerts/:id', async (req, reply) => {
    const user = await auth.require(req, true);
    const { id } = idSchema.parse(req.params);
    await db.transaction(async (tx) => {
      const r = await tx.query('DELETE FROM alerts WHERE id=$1 RETURNING id', [id]);
      if (!r.rows.length) throw new HttpError(404, 'Alert not found.');
      await audit(tx, user.id, 'alert.removed', id);
    });
    return reply.code(204).send();
  });
  const publicDir = resolve('dist/public');
  if (existsSync(publicDir)) {
    await app.register(staticPlugin, {
      root: publicDir,
      prefix: '/',
      setHeaders(res, path) {
        res.header(
          'Cache-Control',
          path.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
        );
      },
    });
  }
  app.setNotFoundHandler((req, reply) => {
    if (
      req.url.startsWith('/api/') ||
      !['GET', 'HEAD'].includes(req.method) ||
      !req.headers.accept?.includes('text/html') ||
      !existsSync(publicDir)
    )
      return reply.code(404).send({ error: 'Not found.', requestId: req.id });
    return reply.header('Cache-Control', 'no-cache').sendFile('index.html');
  });
  return app;
}
