import { z } from 'zod';
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.string().default('0.0.0.0'),
  APP_ORIGIN: z.url().default('http://localhost:5173'),
  DATABASE_URL: z.string().optional(),
  DATABASE_SSL: z.enum(['true', 'false']).default('false'),
  DATABASE_CA: z.string().optional(),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  DEMO_DATA: z.enum(['true', 'false']).default('true'),
  PGLITE_PATH: z.string().default('.data/transit'),
});
export function readConfig(env = process.env) {
  const config = schema.parse(env);
  if (config.NODE_ENV === 'production') {
    if (!config.DATABASE_URL) throw new Error('Production requires DATABASE_URL');
    if (!config.APP_ORIGIN.startsWith('https://'))
      throw new Error('Production requires an HTTPS APP_ORIGIN');
  }
  if (new URL(config.APP_ORIGIN).origin !== config.APP_ORIGIN)
    throw new Error('APP_ORIGIN must be an origin without a path or trailing slash');
  return config;
}
export type Config = ReturnType<typeof readConfig>;
