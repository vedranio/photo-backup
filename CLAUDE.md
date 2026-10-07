# photobackup

Desktop app that backs up photos from a local folder and Google Drive to AWS S3.

## Stack

- Electron desktop app built with electron-vite (Electron + Vite + React + TypeScript).
- SQLite via better-sqlite3 + Drizzle ORM, with Drizzle Kit migrations. Lives in the **main process** only.
- All backup work (local filesystem, Google Drive, AWS S3) runs in the **main process**.
- The renderer talks to main **only** through the typed preload IPC bridge (`window.api`, typed in `src/shared/api.ts`).
- The renderer also runs in a plain browser (for modelwright's UI preview). When `window.api` is undefined, a
  dev-only mock bridge with plausible data is used instead. The mock must never ship in production builds.

## Commands

- `npm run dev`: Electron app with hot reload (renderer dev server on http://localhost:5173)
- `npm run dev:web`: renderer only, in a plain browser at http://localhost:5173 (mock bridge). modelwright's preview uses this
- `npm run build`: typecheck + production build
- `npm run typecheck`: TypeScript for main/preload (`node`) and renderer (`web`)
- `npm run lint`: ESLint
- `npm test`: Vitest
- `npm run db:generate`: generate a Drizzle migration after changing `src/main/db/schema.ts`

Migrations live in `drizzle/` and are applied at startup. The database is `photobackup.db` in Electron's
`userData` folder (on macOS, `~/Library/Application Support/photobackup/`).

Native and binary dependencies (electron, esbuild, better-sqlite3) need their install scripts, which are
allowed in `package.json` → `allowScripts`. better-sqlite3's prebuilt binary loads under both Electron and
plain Node, so Vitest can use a real SQLite database.

Ports 4300 and 4301 belong to modelwright; don't use them. The renderer dev server must stay frameable by
`http://localhost:4300` and `http://127.0.0.1:4300` (no `X-Frame-Options`, no restrictive `frame-ancestors`).

## Google Drive sign-in

Google sign-in is an OAuth desktop flow (system browser, loopback redirect on `127.0.0.1`, PKCE), run in the
main process. It needs a Google Cloud OAuth client of type **Desktop app**, passed in the environment:

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET` (Google requires it for desktop clients, even with PKCE)

Put them in a git-ignored `.env` at the project root (copy `.env.example`); the main process loads it at startup
in development. A packaged app reads `<userData>/.env`. Variables set in the shell take precedence, e.g.
`GOOGLE_OAUTH_CLIENT_ID=… GOOGLE_OAUTH_CLIENT_SECRET=… npm run dev`. Until both are set, the app
shows "Google Drive not configured" rather than failing. Credentials (the Google refresh token and the AWS
keys) are encrypted with Electron `safeStorage` and never sent to the renderer.

## Design (modelwright)

This app is designed in modelwright.

- `.design/spec.md` describes the app (generated; never edit it).
- `.design/*.json` is the source of truth. Don't edit it by hand.
- Design changes are made in modelwright, then applied with `/modelwright:build-from-design`.
- `.design/build.json` records what the code was built from; commit it with the code.

### `?state=<stateId>` (dev only)

In development builds, every screen state answers to `?state=<stateId>`, using the state's id from
`.design/flows.json` exactly (e.g. `?state=st_vublspne` forces Home › Backup failed with placeholder data).
Both `/?state=<id>` and `/#/<route>?state=<id>` work. Any user action clears the override, so the real state
takes over. The override does nothing in production builds (gated on `import.meta.env.DEV`).

State ids and routes are in `src/renderer/src/design.ts`. Placeholder data is in `src/renderer/src/dev/`.
