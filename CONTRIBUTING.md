# Contributing

1. Use Node.js 24, install with `npm ci`, and create a branch.
2. Keep UI copy honest about scheduled versus live data.
3. Run `npm run check`; use browser tests for changed user workflows.
4. For schema changes, append a new migration in `server/db/schema.ts`; never rewrite an applied migration.
5. Preserve API authorization and origin checks, parameterize SQL, and keep mutations transactional.
6. Include the reason for the change, resulting behaviour, and verification in the pull request.

Do not commit `.env`, passenger data, local databases, tokens or generated dependency folders. Keep `package-lock.json` in sync. All contributed code is under the repository’s MIT license.
