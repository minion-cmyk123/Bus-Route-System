import { createDatabase } from './database.js';
import { migrate } from './schema.js';
import { readConfig } from '../config.js';
const db = await createDatabase(readConfig());
try {
  await migrate(db);
  console.log('Database migrations applied.');
} finally {
  await db.close();
}
