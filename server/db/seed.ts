import { readConfig } from '../config.js';
import { createDatabase } from './database.js';
import { migrate } from './schema.js';
import { seedDemo } from './fixtures.js';
const config = readConfig();
if (config.DEMO_DATA !== 'true')
  throw new Error('Set DEMO_DATA=true explicitly to seed the demonstration network.');
const db = await createDatabase(config);
try {
  await migrate(db);
  await seedDemo(db);
  console.log('Demo network seeded (idempotent). No users or default passwords created.');
} finally {
  await db.close();
}
