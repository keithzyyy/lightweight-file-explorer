# AGENTS.md

## Project Context

This project is an internship take-home task: build a Node.js web app that works as a lightweight file explorer for Markdown documents.

Before making implementation changes, read:

1. `internship-file-explorer-take-home-task.md`
2. `spec-file-explorer.md` if it exists
3. `README.md`
4. `AI_USAGE.md`

The product spec is the source of truth for behavior. This file is the source of truth for agent working conventions and agreed implementation assumptions.

## Core MVP

The MVP should:

- run locally with clear setup instructions
- read the provided Markdown files from `files/`
- apply a clear initial rule for organizing the flat files into a useful hierarchy
- display folders and files in a web-based file explorer
- allow users to create folders
- allow users to move files or folders
- persist the changed virtual structure
- include `README.md` and `AI_USAGE.md`

## Architecture Decisions

- Use a Node.js web app.
- Use Nuxt as the intended app framework unless the product spec is explicitly revised.
- Use SQLite as the persistent source of truth for folder/file organization.
- Keep the original Markdown files in `files/` flat.
- Do not physically move, rename, or rewrite the original Markdown files as part of normal app behavior.
- Treat folders as virtual metadata stored in the database.
- Treat file nodes as database records whose Markdown body is stored in `content`.
- Use `scripts/db-seed.ts` to copy the original Markdown into SQLite once during database initialization.
- No file upload is required for the MVP.

## Data Model Decisions

Use a flat relational adjacency-list model for the explorer structure.

A node represents either a folder or a file.

Expected node fields:

- `id`
- `type`: `folder` or `file`
- `name`
- `parent_id`
- `content`
- `sort_order`

Rules:

- `parent_id = NULL` means the node is at the root of the virtual explorer.
- Folder nodes may contain folder nodes or file nodes.
- File nodes store Markdown text using `content`.
- Folder nodes should use an empty `content` string.
- The server should transform flat database rows into `Tree[]` display rows for the frontend.
- The tree transform can be implemented with a standard parent-id lookup map; no special tree database is required for the MVP.

## Initial Organization Rule

On first run or first import, seed the virtual explorer with the expected hierarchy from the task.

The initial hierarchy should represent:

```text
300-product/
  310-product-a/
    310-governance/
      310-ARCHITECTURE.md
      310-gov-high-level-spec.md
    311-epic-a/
      311-100-epic-epic-a.md
      311-110-feature-feature-a.md
      311-111-story-story-a.md
      311-112-story-story-b.md
    312-epic-b/
      312-100-epic-epic-b.md
      312-110-feature-feature-a.md
      312-111-story-story-a.md
      312-120-feature-feature-b.md
```

After seeding, user changes should be loaded from persisted SQLite state rather than re-seeding over user changes.

## Core Operations

Design the app around these operations:

- `loadNodes()`
- `getNodeById(nodeId)`
- `insertFolder(parentId, name)`
- `patchNode(nodeId, updates)`
- `deleteNode(nodeId)`

Behavior expectations:

- Creating a folder with `parentId = NULL` creates it at the root.
- Creating a folder with a folder `parentId` creates it inside that folder.
- Patching a node can update its `name` and/or `parent_id`.
- Moving a folder into itself or one of its descendants must be prevented.
- Deleting a folder removes its descendants.
- File preview should read Markdown content from SQLite.

## UI/UX Decisions

Build for usability before visual polish.

MVP layout:

- file/folder tree on the left
- selected Markdown file preview on the right
- `app/layouts/default.vue` owns the persistent `AppSidebar`
- `app/pages/index.vue` is the homepage
- `app/pages/[id].vue` fetches and previews the selected node
- create-folder action exposed as a button
- move action exposed through a simple "Move to..." control
- drag-and-drop is optional and not required for the MVP

Interaction assumptions:

- Selecting a folder makes it the default destination for creating a child folder.
- If no folder is selected, creating a folder should place it at the root.
- Selecting a file should show its Markdown contents in the preview pane.

## Testing Expectations

Prioritize correctness of the data model and operations.

Expected coverage:

- unit tests for tree transformation and core node operations
- unit tests for invalid moves, especially moving a folder into itself or a descendant
- integration tests for SQLite persistence
- at least one UI or end-to-end smoke test for creating a folder and moving a node if the chosen tooling supports it cleanly

Documentation expectations:

- Put detailed product acceptance criteria and manual test checklist in `spec-file-explorer.md`.
- Keep `README.md` focused on project overview, setup, run, and test instructions.

## Git And Change Discipline

Use small, focused changes.

Recommended branch names:

- `feature/tree-model`
- `feature/initial-import`
- `feature/create-folder`
- `feature/move-node`
- `docs/project-spec`

Recommended commit style:

- `feat: add persisted tree model`
- `feat: seed initial file hierarchy`
- `test: cover move node behavior`
- `docs: add local setup instructions`

Do not mix unrelated refactors into feature commits.

## AI Usage

Maintain `AI_USAGE.md` as the project evolves.

Record:

- which AI tools were used
- what they were used for
- which parts were reviewed, tested, or corrected manually
- important prompts or conversation summaries that are useful and comfortable to share

## Safety And Repo Rules

- Do not inspect files hidden by `.gitignore`.
- Do not modify generated, cache, dependency, or build-output files unless explicitly required.
- Do not overwrite user changes.
- Do not move or rewrite files in `files/` unless the product spec is explicitly changed.
- Prefer reading the existing spec and tests before making implementation decisions.
- When behavior is ambiguous, update the spec before implementing.
