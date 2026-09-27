import { readConfig } from './config.js';
import { createDatabase } from './db/database.js';
import { migrate } from './db/schema.js';
import { seedDemo } from './db/fixtures.js';
import { buildApp } from './app.js';
const config = readConfig();
const db = await createDatabase(config);
if (config.NODE_ENV !== 'production') {
  await migrate(db);
  if (config.DEMO_DATA === 'true') await seedDemo(db);
}
const app = await buildApp(db, config);
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  const timer = setTimeout(() => process.exit(1), 15000);
  timer.unref();
  try {
    await app.close();
    await db.close();
    clearTimeout(timer);
  } catch (err) {
    app.log.error(err);
    process.exitCode = 1;
  }
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
try {
  await app.listen({ port: config.PORT, host: config.HOST });
} catch (err) {
  app.log.error(err);
  await db.close();
  process.exitCode = 1;
}
