# Project Overview: Web-Based File Explorer
This project aims to build a **Node.js web app** that works as a lightweight interactive file explorer for a given set of `.md` documents.

# Local Setup

## Requirements
- Git
- Node.js 24.18.0 or compatible LTS version
- npm 11.16.0 or compatible version

## Steps (on cmd)
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

Then open the URL printed in the terminal, usually http://localhost:3000.

NOTE: There is no need to install SQLite separately, since the app should use Node’s built-in `node:sqlite` (to be confirmed later).


# AI Usage Pointer
Please see `AI_USAGE.md` (will be continually updated).