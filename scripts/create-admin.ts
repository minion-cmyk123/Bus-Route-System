import { readConfig } from '../server/config.js';
import { createDatabase } from '../server/db/database.js';
import { createUser } from '../server/auth.js';
import { signupSchema } from '../server/validation.js';
// Read a JSON object from stdin. Never place passwords in CLI arguments or source control.
let input = '';
for await (const chunk of process.stdin) input += chunk;
const data = signupSchema.parse(JSON.parse(input));
const db = await createDatabase(readConfig());
try {
  const user = await createUser(db, data.name, data.email, data.password, 'admin');
  console.log(`Administrator created: ${user.email}`);
} finally {
  await db.close();
}
