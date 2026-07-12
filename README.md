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

On PowerShell, use `npm.cmd` if `npm` is blocked by execution policy:
```
npm.cmd install
npm.cmd run dev
```

Add optional verification by running to ensure build check
```
npm.cmd run build
```

Then open the URL printed in the terminal, usually http://localhost:3000.

NOTE: The SQLite DB is created automatically
- `data/file-explorer.sqlite` is generated on first run.
- `data/` is intentionally ignored by Git so that persistence stays local on your machine.
- The app seeds from `files/` when the DB is empty.


# AI Usage Pointer
Please see `AI_USAGE.md`.