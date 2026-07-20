# File Explorer Spec

## 1. Purpose

The app imports the provided flat Markdown files into a virtual file tree, displays that tree in a Nuxt UI, lets users create folders and move nodes, previews Markdown content, and persists the virtual structure in SQLite.

The original files under `files/` are seed inputs only. Normal runtime reads, moves, renames, and deletes operate on SQLite and do not rewrite or move those source files.

## 2. Current Program Flow

1. `app/app.vue` renders `NuxtLayout` and `NuxtPage`.
2. `app/layouts/default.vue` requests `GET /api/tree` and renders the persistent `AppSidebar`.
3. The route calls `loadNodes()` in `server/utils/db.ts`.
4. The database layer creates `data/file-explorer.sqlite`, the `nodes` table, and the `app_metadata` table when needed.
5. If the initial seed marker does not exist, `scripts/db-seed.ts` populates the required hierarchy and copies each Markdown file body into `nodes.content`.
6. The seed script records `initial_seed_completed = true`, so an intentionally emptied tree is not seeded again.
7. The database returns flat `TreeNode[]` rows with empty `content` for the tree-list response.
8. The server builds the hierarchy, flattens it into display `Tree[]`, and returns it to the layout.
9. Selecting a sidebar node navigates to `/:id`.
10. `app/pages/[id].vue` requests `GET /api/tree/node/:id`, which loads the node and its Markdown content from SQLite.
11. Create, patch, and delete requests mutate SQLite and return the updated display `Tree[]`.

## 3. Data Model

### Application types

```ts
type TreeNode = {
  id: string
  type: 'folder' | 'file'
  name: string
  parentId: string | null
  content: string
  sortOrder: number
  children: TreeNode[]
}

type Tree = TreeNode & {
  depth: number
  ancestorIds: string[]
}
```

Rules:

- `parentId = null` places a node at the virtual root.
- Folder nodes can contain folders and files.
- Folder `content` is an empty string.
- File `content` contains the imported Markdown source.
- Flat persistence rows have `children: []`.
- `buildTree()` populates nested `children` arrays.
- `flattenTree()` adds `depth` and `ancestorIds` for display.
- `GET /api/tree` returns display nodes with `content: ''`; full content is fetched only from the individual node endpoint.

### SQLite schema

```sql
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('folder', 'file')),
  name TEXT NOT NULL,
  parent_id TEXT,
  content TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES nodes(id)
);

CREATE TABLE IF NOT EXISTS app_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

SQLite/application mapping:

```text
id         -> id
type       -> type
name       -> name
parent_id  -> parentId
content    -> content
sort_order -> sortOrder
```

Databases created by the earlier `file_path` schema are migrated by adding `content`, importing missing Markdown bodies once, and recording the initial seed marker. Runtime code does not read `file_path`.

## 4. Initial Database Seed

`scripts/` contains one script: `scripts/db-seed.ts`.

The script is called by the database initializer during the first `GET /api/tree` request. It populates:

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

Seeding rules:

- Seed only when `initial_seed_completed` is absent.
- Insert folders before their children.
- Read each provided Markdown file once and store its body in `content`.
- Use one SQLite transaction for a new seed.
- Mark seeding complete after successful insertion.
- Do not reseed merely because the user deleted every node.
- Preserve existing node organization while migrating an older populated database.

## 5. HTTP API

All explorer operations live under `/api/tree`.

### `GET /api/tree`

Implemented by `server/api/tree/index.get.ts`.

- Initializes and seeds SQLite when required.
- Loads flat nodes without Markdown bodies.
- Builds and flattens the hierarchy.
- Returns `Tree[]` for the file explorer display.

### `POST /api/tree/node/:id`

Implemented by `server/api/tree/node/[id].post.ts`.

Creates a folder under the parent identified by `:id`.

- Use `__root__` as `:id` to create at the virtual root.
- Body: `{ "name": string }`.
- The parent must exist and be a folder unless root is requested.
- Returns the updated `Tree[]`.

### `GET /api/tree/node/:id`

Implemented by `server/api/tree/node/[id].get.ts`.

- Returns the complete `TreeNode` stored for `:id`.
- File nodes include Markdown in `content`.
- Folder nodes have empty `content`.
- Returns 404 for an unknown id.

### `PATCH /api/tree/node/:id`

Implemented by `server/api/tree/node/[id].patch.ts`.

Renames and/or moves the selected node.

Body fields:

```ts
{
  name?: string
  parentId?: string | null
}
```

Rules:

- At least one field is required.
- Names cannot be empty.
- `parentId = null` moves the node to root.
- A non-null parent must exist and be a folder.
- A node cannot be moved into itself.
- A folder cannot be moved into one of its descendants.
- Renaming does not change the stable node id.
- Returns the updated `Tree[]`.

### `DELETE /api/tree/node/:id`

Implemented by `server/api/tree/node/[id].delete.ts`.

- Deletes the selected node and all descendants.
- Deletes children before parents to satisfy foreign keys.
- Uses one SQLite transaction.
- Returns the updated `Tree[]`.

## 6. Core Operations

### Tree utilities

```ts
buildTree(nodes: TreeNode[]): TreeNode[]
flattenTree(nodes: TreeNode[]): Tree[]
buildTreeDisplay(nodes: TreeNode[]): Tree[]
createFolder(nodes, parentId, name): TreeNode[]
updateNode(nodes, nodeId, updates): TreeNode[]
collectSubtreeIds(nodes, nodeId): string[]
```

Tree utilities are pure. They validate and transform in-memory rows without reading or writing SQLite.

### Database operations

```ts
ensureDatabase(): void
initializeDatabase(): void
loadNodes(): TreeNode[]
getNodeById(nodeId): TreeNode | null
insertFolder(parentId, name): TreeNode[]
patchNode(nodeId, updates): TreeNode[]
deleteNode(nodeId): TreeNode[]
```

The database layer owns schema creation, migration, initialization, and persistence.

## 7. UI Behavior

Layout:

- File/folder tree on the left.
- Selected Markdown preview on the right.
- `+ Folder` action.
- Destination selector and `Confirm Move` action.

Tree display:

- `app.vue` only renders `NuxtLayout` and `NuxtPage`.
- `app/layouts/default.vue` stores the full `Tree[]` returned by the API and keeps the sidebar visible across page navigation.
- `app/components/AppSidebar.vue` renders explorer controls and tree rows.
- `app/pages/index.vue` renders the unselected homepage.
- `app/pages/[id].vue` fetches and renders the selected node.
- `Tree.depth` renders hierarchy guides.
- `Tree.ancestorIds` validates move destinations and filters collapsed descendants.
- Collapse state remains frontend-only.
- The full API tree remains available for move destinations even when rows are collapsed.

Create folder:

- A selected folder becomes the parent.
- A selected file or no selection creates at root through `__root__`.
- Creating inside a collapsed folder expands it.

Move:

- The UI sends `PATCH` with `parentId`.
- Root maps to `parentId = null`.
- Current location is visible but disabled.
- Self and descendant destinations are omitted.
- Moving into a collapsed destination expands it.

Preview:

- Selecting a node navigates to `/:id`.
- The dynamic page calls `GET /api/tree/node/:id`.
- Preview renders the returned `content` from SQLite.
- Selecting a folder renders its name and folder state without Markdown content.
- Clearing selection navigates to the homepage.
- Nuxt refetches when the dynamic route id changes.

## 8. Non-Goals

- No file upload.
- No Markdown editing UI.
- No physical moving, renaming, or rewriting files under `files/`.
- No drag-and-drop requirement.
- No authentication or multi-user concurrency.
- No persisted collapse state.

## 9. Test Plan

Tree utilities:

- Build nested children from flat parent ids.
- Sort siblings by `sortOrder`, then name.
- Flatten nodes with correct `depth` and `ancestorIds`.
- Create root and child folders.
- Reject file parents.
- Rename a node.
- Move a file or folder.
- Reject self and descendant moves.
- Collect subtree ids in child-first order.

Persistence:

- Create schema on a new database.
- Seed the required 15 nodes once.
- Store Markdown bodies in `content`.
- Mark the initial seed complete.
- Load an existing database without reseeding.
- Migrate and backfill an older `file_path` database.
- Persist create, patch, and recursive delete operations.
- Do not reseed after deleting every node.

API/UI:

- `GET /api/tree` returns 15 flattened rows initially.
- Tree-list rows omit Markdown bodies.
- Individual file GET returns non-empty Markdown content.
- POST creates a root or child folder.
- PATCH renames and moves a node.
- PATCH rejects invalid cycles.
- DELETE removes a subtree.
- Preview displays content returned by the node GET route.
- Homepage renders through `pages/index.vue`.
- Dynamic node routes fetch through `pages/[id].vue`.
- The default layout keeps `AppSidebar` visible during navigation.
- Collapse and move-destination behavior continues to work with `Tree[]`.

## 10. Manual Acceptance Checklist

- [ ] App starts locally with Node.js 24.x.
- [ ] First page load creates and seeds SQLite.
- [ ] Initial tree contains the expected 15 nodes.
- [ ] `scripts/` contains only `db-seed.ts`.
- [ ] `nodes.content` stores the Markdown file bodies.
- [ ] Runtime preview does not read `filePath` or source files.
- [ ] Clicking a file displays its SQLite-backed Markdown content.
- [ ] Clicking a tree node navigates to `/:id`.
- [ ] Returning to `/` clears the selected node view.
- [ ] `AppSidebar` remains visible on both routes.
- [ ] Creating a folder at root updates and persists the tree.
- [ ] Creating inside a folder updates and persists the tree.
- [ ] Moving a node updates and persists `parentId`.
- [ ] Renaming through PATCH persists the new name.
- [ ] Self and descendant moves are rejected.
- [ ] Deleting a folder deletes its descendants.
- [ ] Deleting all nodes does not trigger another seed.
- [ ] Original Markdown files remain unchanged and flat.
- [ ] Folder collapse and expand work.
- [ ] Collapsed folders remain available as move destinations.

## 11. Open Questions

- Should the UI expose rename and delete controls, or keep those operations API-only for the MVP?
- Should delete require confirmation or soft-delete support before it is exposed in the UI?
- Should duplicate sibling names be rejected?
- Should node ids eventually use UUIDs instead of stable slugs?
