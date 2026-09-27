import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
  randomUUID,
} from 'node:crypto';
import { promisify } from 'node:util';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Database } from './db/database.js';
import type { User } from '../shared/types.js';
const scrypt = promisify(scryptCallback);
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}
export async function verifyPassword(password: string, hash: string) {
  const [salt, stored] = hash.split(':');
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(stored, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
export function createAuth(db: Database, production: boolean) {
  const cookieName = production ? '__Host-transit_session' : 'transit_session';
  const cookieOptions = { path: '/', httpOnly: true, secure: production, sameSite: 'lax' as const };
  return {
    async user(request: FastifyRequest): Promise<User | null> {
      const token = request.cookies[cookieName];
      if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
      const { rows } = await db.query<User>(
        `SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at > now()`,
        [digest(token)],
      );
      return rows[0] ?? null;
    },
    async require(request: FastifyRequest, admin = false) {
      const user = await this.user(request);
      if (!user) throw new HttpError(401, 'Sign in to continue.');
      if (admin && user.role !== 'admin')
        throw new HttpError(403, 'An administrator account is required.');
      return user;
    },
    async start(user: User, request: FastifyRequest, reply: FastifyReply) {
      const token = randomBytes(32).toString('hex');
      await db.transaction(async (tx) => {
        const old = request.cookies[cookieName];
        if (old) await tx.query('DELETE FROM sessions WHERE token_hash=$1', [digest(old)]);
        await tx.query('DELETE FROM sessions WHERE expires_at < now()');
        await tx.query(
          "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now() + interval '7 days')",
          [digest(token), user.id],
        );
      });
      reply.setCookie(cookieName, token, { ...cookieOptions, maxAge: 604800 });
    },
    async logout(request: FastifyRequest, reply: FastifyReply) {
      const token = request.cookies[cookieName];
      if (token) await db.query('DELETE FROM sessions WHERE token_hash=$1', [digest(token)]);
      reply.clearCookie(cookieName, cookieOptions);
    },
    async throttle(request: FastifyRequest, email: string) {
      // Shared database counters protect authentication across API replicas.
      for (const [key, limit] of [
        [`email:${email}`, 15],
        [`ip:${request.ip}`, 60],
      ] as const) {
        const result = await db.query<{ attempts: number }>(
          `INSERT INTO auth_attempts(key,attempts,reset_at) VALUES($1,1,now()+interval '15 minutes')
          ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN auth_attempts.reset_at < now() THEN 1 ELSE auth_attempts.attempts+1 END,
          reset_at=CASE WHEN auth_attempts.reset_at < now() THEN now()+interval '15 minutes' ELSE auth_attempts.reset_at END RETURNING attempts`,
          [digest(key)],
        );
        if (result.rows[0].attempts > limit)
          throw new HttpError(429, 'Too many sign-in attempts. Try again in 15 minutes.');
      }
      await db.query('DELETE FROM auth_attempts WHERE reset_at < now()');
    },
  };
}
export async function createUser(
  db: Database,
  name: string,
  email: string,
  password: string,
  role: User['role'] = 'passenger',
) {
  const user: User = { id: randomUUID(), name, email, role };
  const passwordHash = await hashPassword(password);
  await db.query('INSERT INTO users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5)', [
    user.id,
    name,
    email,
    passwordHash,
    role,
  ]);
  return user;
}
