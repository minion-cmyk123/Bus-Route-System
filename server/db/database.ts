import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import type { Config } from '../config.js';
export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<{ rows: T[] }>;
}
export interface Database extends Queryable {
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export async function createDatabase(
  config: Pick<Config, 'DATABASE_URL' | 'DATABASE_SSL' | 'DATABASE_CA' | 'PGLITE_PATH'>,
): Promise<Database> {
  if (config.DATABASE_URL) {
    const pool = new pg.Pool({
      connectionString: config.DATABASE_URL,
      max: 15,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      statement_timeout: 10000,
      ssl:
        config.DATABASE_SSL === 'true'
          ? { rejectUnauthorized: true, ...(config.DATABASE_CA ? { ca: config.DATABASE_CA } : {}) }
          : undefined,
    });
    pool.on('error', (err) => {
      console.error('Idle database connection failed:', err.message);
    });
    return {
      async query<T>(sql: string, values?: unknown[]) {
        const result = await pool.query(sql, values);
        return { rows: result.rows as T[] };
      },
      async transaction<T>(fn: (tx: Queryable) => Promise<T>) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const value = await fn({
            async query<R>(sql: string, values?: unknown[]) {
              const result = await client.query(sql, values);
              return { rows: result.rows as R[] };
            },
          });
          await client.query('COMMIT');
          return value;
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      },
      close: () => pool.end(),
    };
  }
  const db = new PGlite(config.PGLITE_PATH === ':memory:' ? undefined : config.PGLITE_PATH);
  await db.waitReady;
  return {
    query: (sql, values) => db.query(sql, values),
    transaction: (fn) => db.transaction((tx) => fn(tx)),
    close: () => db.close(),
  };
}
