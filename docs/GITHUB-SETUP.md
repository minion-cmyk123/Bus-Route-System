# Add this rebuild to your repository

The source ZIP contains the full application, documentation, tests, screenshots and GitHub workflows. It does not include a local database, credentials or `node_modules`.

1. Install Node.js 24 and Git.
2. Clone your repository using GitHub Desktop or Git:

   ```bash
   git clone https://github.com/minion-cmyk123/Bus-Route-System.git
   cd Bus-Route-System
   git switch -c feat/routewise-rebuild
   ```

3. Extract the ZIP elsewhere. Copy **the contents** of its `Bus-Route-System` folder into your cloned repository. Include dotfiles such as `.github`, `.gitignore`, and `.env.example`. Keep the clone’s `.git` directory.
4. Run:

   ```bash
   npm ci
   npm run check
   npm run dev
   ```

5. Visit `http://localhost:5173`. The README explains how to create your own administrator account.
6. Stop the app, review the files, then commit and push:

   ```bash
   git add .
   git commit -m "Build Routewise journey planner and network operations"
   git push -u origin feat/routewise-rebuild
   ```

7. Open a pull request into `main`. Wait for GitHub Actions, inspect the browser report, and merge when satisfied. Pin the repository on your profile.

Suggested repository description:

> Full-stack bus journey planner with timed transfers, saved trips, secure accounts and network operations. React, TypeScript, Fastify and PostgreSQL.

Suggested topics: `typescript`, `react`, `fastify`, `postgresql`, `public-transit`, `route-planning`, `full-stack`, `playwright`.
