import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase } from '../db/database.js';
import { migrate } from '../db/schema.js';
import { seedDemo } from '../db/fixtures.js';
import { createUser } from '../auth.js';
import { getNetwork } from '../network.js';

test('local PostgreSQL storage preserves users and the network across a restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'routewise-persistence-'));
  const config = { PGLITE_PATH: join(directory, 'database'), DATABASE_SSL: 'false' as const };
  let db = await createDatabase(config);
  try {
    await migrate(db);
    await seedDemo(db);
    await createUser(
      db,
      'Persistent Rider',
      'persistent@example.test',
      'test-persistence-password',
    );
    await db.close();
    db = await createDatabase(config);
    assert.equal((await getNetwork(db)).routes.length, 8);
    const users = await db.query<{ email: string }>('SELECT email FROM users');
    assert.equal(users.rows[0].email, 'persistent@example.test');
  } finally {
    await db.close();
    await rm(directory, { recursive: true, force: true });
  }
});
