# Project Overview: Web-Based File Explorer
This project aims to build a **Node.js web app** that works as a lightweight interactive file explorer for a given set of `.md` documents.

# Local Setup

## Requirements
- Git
- Node.js 24.x recommended because the app uses built-in `node:sqlite`
- npm 11.16.0 or compatible version (but `npm` comes with installation of Node)

## Steps to run the app locally
On cmd
```
git clone <your-repo-url>
cd <your-repo-folder>
npm install
npm run dev
```
Note: `npm install` uses `package.json` / `package-lock.json`.

On PowerShell, use `npm.cmd` if `npm` is blocked by execution policy:
```
npm.cmd install
npm.cmd run dev
```

Optional: verify the production build:
```
npm.cmd run build
```

Then open the URL printed in the terminal, usually http://localhost:3000.

The homepage is `/`. Selecting a tree node navigates to `/:id`, where the
dynamic Nuxt page fetches that node from the tree API.

NOTE: The SQLite DB is created automatically
- `data/file-explorer.sqlite` is generated on first run.
- `data/` is intentionally ignored by Git so that persistence stays local on your machine.
- The first `GET /api/tree` request runs `scripts/db-seed.ts` once.
- The seed copies the provided Markdown bodies into SQLite's `content` column.
- Preview requests read content from SQLite; the original files remain unchanged seed inputs.

## Tree API

- `GET /api/tree` returns the flattened explorer display.
- `POST /api/tree/node/:id` creates a child folder (`__root__` creates at root).
- `GET /api/tree/node/:id` returns one node with its stored content.
- `PATCH /api/tree/node/:id` renames and/or moves a node.
- `DELETE /api/tree/node/:id` deletes a node and its descendants.


# AI Usage Pointer
Please see `AI_USAGE.md`.
