// Isolated fixture server: never connects to a user's database.
import { createDatabase } from '../server/db/database.js';
import { migrate } from '../server/db/schema.js';
import { seedDemo } from '../server/db/fixtures.js';
import { createUser } from '../server/auth.js';
import { buildApp } from '../server/app.js';
import { readConfig } from '../server/config.js';
const config = readConfig({
  NODE_ENV: 'test',
  PGLITE_PATH: ':memory:',
  APP_ORIGIN: 'http://127.0.0.1:4173',
  PORT: '4173',
});
const db = await createDatabase(config);
await migrate(db);
await seedDemo(db);
await createUser(db, 'Demo Operator', 'operator@example.test', 'operator-test-password', 'admin');
const app = await buildApp(db, config);
await app.listen({ host: '127.0.0.1', port: 4173 });
async function stop() {
  await app.close();
  await db.close();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
