# File Explorer Spec

## 1. Purpose

The app reads the provided flat Markdown files from `files/`, organizes them into a useful virtual folder tree, displays that tree in a web UI, lets users create folders and move files or folders, previews Markdown content, and persists the virtual structure in SQLite without physically moving or rewriting the original Markdown files.

## 2. High-Level MVP Program Flow

The current MVP app is database-backed. Earlier in-memory stages were useful for learning and prototyping, but the active app flow persists user changes with SQLite through `server/utils/db.ts`.

Expected current MVP flow:

1. The user starts the Nuxt app and opens it in the browser.
2. The Nuxt server uses `server/utils/db.ts` as the active storage layer.
3. The DB layer opens `data/file-explorer.sqlite` with Node's built-in `node:sqlite` `DatabaseSync`.
4. The DB layer ensures the SQLite database and `nodes` table exist.
5. The DB layer checks whether node rows already exist.
6. If the database has node rows, the server loads the existing flat nodes from SQLite.
7. If the database is empty, the server reads Markdown filenames from `files/`, organizes them into initial flat `ExplorerNode` rows, inserts those rows into SQLite, and then loads the rows.
8. `GET /api/tree` calls `loadNodes()`, calls `buildTree(nodes)`, and returns `TreeNode[]` to the UI.
9. The UI renders the tree in the left file explorer panel.
10. When the user creates a folder, the UI sends `POST /api/folders`.
11. When the user moves a file or folder, the UI sends `POST /api/move`.
12. Mutation routes validate the operation, update SQLite, reload flat rows, rebuild the tree, and return updated `TreeNode[]` to the UI.
13. When the user selects a Markdown file, the UI sends `GET /api/markdown?fileId=<node-id>`.
14. The Markdown route looks up the virtual file node, reads Markdown content from the real `filePath`, and returns raw Markdown text for preview.
15. Folder collapse/expand is frontend-only UI state. It changes which rows are visible, but it is not saved to SQLite.

`buildTree(nodes)` does not decide where files belong. It only converts rows with existing parent relationships into nested data for rendering. Initial file organization is a separate seeding step.

## 3. Non-Goals

- No file upload for the MVP.
- No physical moving, renaming, or rewriting files in `files/`.
- No editing Markdown file contents.
- No drag-and-drop movement for the MVP.
- No authentication.
- No multi-user or concurrent editing support.
- No persisted folder collapse/expand state.

## 4. Development Plan

This section is both historical and current. Stages 1-3 describe the learning/prototype path. Stage 4 and later describe the current MVP direction.

### Stage 1: Toy Known-Parent Nodes In Memory

Use a hardcoded flat array of `ExplorerNode` objects where `parentId` values are already known.

Goals:

- define the node shape
- implement `buildTree(nodes)`
- implement `formatTree(tree)` for terminal inspection
- implement `createFolder(nodes, parentId, name)`
- implement `moveNode(nodes, nodeId, newParentId)`
- manually inspect operation sequences by calling `formatTree(buildTree(nodes))`

### Stage 2: Toy Filename Organization In Memory

Use a hardcoded list of Markdown filenames and convert them into initial flat `ExplorerNode` rows.

Goals:

- implement `organizeInitialFiles(fileNames)`
- confirm generated rows represent the expected hierarchy
- reuse `buildTree(nodes)` and `formatTree(tree)` to inspect the result

### Stage 3: Real Markdown Files In Memory

Read the real Markdown filenames from `files/` and organize them into initial flat `ExplorerNode` rows in memory.

Goals:

- implement `readMarkdownFileNames(dir)`
- confirm the program can discover the provided files
- keep original files flat and unchanged
- verify the real file list produces the expected starting hierarchy

### Stage 3.1: Render Tree Using Vue

Read real Markdown filenames from `files/`, organize them with the deterministic rule, convert them into a tree, and render the initial tree in the browser.

Prototype shape:

```text
files/
  real Markdown docs

server/utils/tree.ts
  readMarkdownFileNames
  organizeInitialFiles
  buildTree

server/api/tree.get.ts
  returns buildTree(...)

app/app.vue
  calls /api/tree
  renders a basic left-side tree
```

### Stage 3.2: Temporary In-Memory Store

Use `server/utils/node-store.ts` as a prototype storage boundary before SQLite.

The temporary store mimics future database operations:

```ts
loadNodes(): ExplorerNode[]
insertFolder(parentId: string | null, name: string): ExplorerNode[]
updateNodeParent(nodeId: string, newParentId: string | null): ExplorerNode[]
```

This layer stores rows in a module-level `ExplorerNode[]`. State is lost when the server process restarts. This file is now prototype/reference code; the active storage layer is `server/utils/db.ts`.

### Stage 3.3: Create Folder UI

Add UI and API behavior for folder creation.

Goals:

- select folders in the tree
- expose a `+ Folder` button
- call `POST /api/folders`
- update `tree.value` with the returned tree
- create at root if no folder is selected
- create at root if a file is selected

### Stage 3.4: Move Nodes UI

Add UI and API behavior for moving files or folders.

Goals:

- select a file or folder
- choose a destination from a simple dropdown
- include root as a destination
- include valid folders as destinations
- disable the current location
- exclude invalid folder destinations such as self and descendants
- call `POST /api/move`
- update `tree.value` with the returned tree

### Stage 3.5: Markdown Preview

Add Markdown file preview behavior.

Goals:

- clicking a file calls `GET /api/markdown?fileId=<node-id>`
- the server reads the Markdown content from the file node's `filePath`
- the preview panel shows raw Markdown text
- selecting a folder or clearing selection clears the preview
- stale async preview responses are ignored if the user has already selected a different file

### Stage 4: SQLite Persistence

Persist the virtual folder/file structure in SQLite.

Current implementation direction:

- use `server/utils/db.ts` as the active storage layer
- use built-in `node:sqlite`
- use `DatabaseSync`
- store the local DB file at `data/file-explorer.sqlite`
- keep `data/` ignored by Git
- create the `nodes` table if needed
- seed the database only when it is empty
- load existing rows on later app starts
- persist folder creation with operation-based `INSERT`
- persist node movement with operation-based `UPDATE`
- reuse pure `createFolder(...)` and `moveNode(...)` for validation before writing to SQLite

### Stage 5: UI Interaction Polish

Improve usability while keeping the app simple.

Current UI behavior:

- group upper-left controls as `Actions` and `Move selected item`
- label the move dropdown as `Destination`
- use `Confirm Move` as the explicit move command
- show collapse/expand toggles for folders with children
- keep collapse/expand as frontend-only state
- keep move destinations based on the full tree, not only visible rows

## 5. Expected Behavior

### Data Model

Use a flat adjacency-list model as the source shape for both SQLite persistence and in-memory development.

Application-level node shape:

```ts
type ExplorerNode = {
  id: string
  type: 'folder' | 'file'
  name: string
  parentId: string | null
  filePath: string | null
  sortOrder: number
}
```

Tree rendering shape:

```ts
type TreeNode = ExplorerNode & {
  children: TreeNode[]
}
```

Frontend display-row shape:

```ts
type DisplayNode = TreeNode & {
  depth: number
  ancestorIds: string[]
}
```

SQLite uses snake_case column names while the app uses camelCase fields:

```text
id         -> id
type       -> type
name       -> name
parent_id  -> parentId
file_path  -> filePath
sort_order -> sortOrder
```

Rules:

- `parentId = null` means the node is at the virtual root.
- Folder nodes may contain folder nodes or file nodes.
- File nodes point to real Markdown files through `filePath`.
- Folder nodes should have `filePath = null`.
- The frontend renders a flattened `DisplayNode[]` derived from nested `TreeNode[]`.

### SQLite Persistence

SQLite is the current source of truth for the virtual folder/file structure.

Current implementation details:

- Storage module: `server/utils/db.ts`
- SQLite API: built-in `node:sqlite`
- SQLite connection: `DatabaseSync`
- Database path: `data/file-explorer.sqlite`
- Database table: `nodes`
- Prototype storage module: `server/utils/node-store.ts`

`node-store.ts` remains useful as historical/prototype reference code, but active API routes import from `db.ts`.

Current table shape:

```sql
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('folder', 'file')),
  name TEXT NOT NULL,
  parent_id TEXT,
  file_path TEXT,
  sort_order INTEGER NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES nodes(id)
)
```

Persistence rules:

- `ensureDatabase()` creates the database file and table if needed.
- `seedDatabaseIfEmpty()` inserts the initial hierarchy only when no node rows exist.
- `loadNodes()` returns flat `ExplorerNode[]` from SQLite.
- `insertFolder(parentId, name)` loads rows, calls pure `createFolder(...)`, inserts only the newly created folder row, and returns reloaded rows.
- `updateNodeParent(nodeId, newParentId)` loads rows, calls pure `moveNode(...)`, updates only the moved node's `parent_id` and `sort_order`, and returns reloaded rows.
- Seeding must not overwrite persisted user changes.

### Initial File Organization

The initial seed should represent this hierarchy:

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

Deterministic grouping rule:

- Create root folder `300-product`.
- Create child folder `310-product-a` under `300-product`.
- Put `310-ARCHITECTURE.md` and files matching `310-gov-*` under `310-governance`.
- Put files beginning with `311-` under `311-epic-a`.
- Put files beginning with `312-` under `312-epic-b`.
- Put `310-governance`, `311-epic-a`, and `312-epic-b` under `310-product-a`.

### UI Behavior

The app should prioritize usability over visual polish.

Layout:

- Show the file/folder tree in a left panel.
- Show selected Markdown file preview in a right panel.
- Render raw Markdown text in the preview panel for now.

Upper-left controls:

```text
File Explorer

Actions
[ + Folder ]

Move selected item
Destination
[ root                         v ]
[ Confirm Move ]
```

Create folder behavior:

- `+ Folder` prompts for a folder name.
- If a folder is selected, the new folder is created inside that folder.
- If no folder is selected, the new folder is created at the virtual root.
- If a file is selected, the new folder is created at the virtual root.
- Creating inside a collapsed folder expands that folder so the new item is visible.

Move behavior:

- The user selects a file or folder, chooses a destination, and clicks `Confirm Move`.
- Root is represented in the frontend dropdown with a sentinel string and converted to `null` before calling the API.
- Only folders can be non-root move destinations.
- The current location is shown but disabled.
- A selected folder and its descendants are excluded as destinations.
- Moving into a collapsed folder expands that folder so the moved item is visible.

Preview behavior:

- Selecting a file loads Markdown preview through `GET /api/markdown?fileId=<node-id>`.
- Selecting a folder clears the preview.
- Clicking the empty tree panel clears selection and preview.
- The frontend only displays a preview response if the selected file still matches the requested file id.

Collapse/expand behavior:

- Folders with children show a `>` / `v` toggle.
- Files do not show a collapse toggle.
- Collapsing a folder hides its descendants but keeps the folder row visible.
- Expanding a folder restores its descendants.
- Collapsing a folder that contains the selected node clears the hidden selection and preview.
- Collapse state is frontend-only and is not persisted in SQLite.
- Move destinations are generated from the full tree, not only the visible collapsed tree.

### Persistence Behavior

- SQLite stores the virtual folder/file structure.
- The original Markdown files remain flat in `files/`.
- The app seeds the database only when it is empty.
- User-created folders persist after app restart.
- Moved nodes persist after app restart.
- Collapse/expand state does not persist after reload or restart.

## 6. Core Operations / Function Interfaces

This section separates functions by where they run and what kind of state they touch. Function names listed here are the intended contracts for the project modules and UI flow.

### Implementation Convention

- Functions listed in this section are the intended module contracts.
- Internal helper functions should be prefixed with `_`.
- App code should prefer calling public contract functions.
- Frontend event handlers should be named by the UI event they handle, such as `handleCreateFolderClick()`.

### Function Flow: SQLite-Backed Current App

SQLite is the active source of truth.

```text
Nuxt app starts
        |
        v
GET /api/tree
        |
        v
loadNodes()
        |
        v
seedDatabaseIfEmpty()
        |
        +-- if DB empty -----------------------------+
        |                                            |
        v                                            |
readMarkdownFileNames('files')                       |
        |                                            |
        v                                            |
organizeInitialFiles(fileNames)                      |
        |                                            |
        v                                            |
insert initial ExplorerNode rows into SQLite         |
        |                                            |
        +--------------------+-----------------------+
                             |
                             v
                       ExplorerNode[]
                             |
                             v
                        buildTree(nodes)
                             |
                             v
                          TreeNode[]
                             |
                             v
                    return tree to Vue UI
```

Mutation flow:

```text
Vue UI action
        |
        v
POST /api/folders OR POST /api/move
        |
        v
loadNodes()
        |
        v
createFolder(...) OR moveNode(...)
        |
        v
INSERT one folder row OR UPDATE one node row
        |
        v
loadNodes()
        |
        v
buildTree(nodes)
        |
        v
return updated TreeNode[] to UI
```

### Function Flow: In-Memory Prototype

This flow was used in stages 1-3. It remains useful for understanding the design, but it is not the active persistence path.

```text
files/ or hardcoded filenames
        |
        v
readMarkdownFileNames(dir)
        |
        v
organizeInitialFiles(fileNames)
        |
        v
ExplorerNode[]
        |
        +-----------------------------+
        |                             |
        v                             v
createFolder(nodes, parentId, name)  moveNode(nodes, nodeId, newParentId)
        |                             |
        +-------------+---------------+
                      |
                      v
              updated ExplorerNode[]
                      |
                      v
              buildTree(nodes)
                      |
                      v
              TreeNode[]
```

### Frontend Rendering Flow

Initial tree render:

```text
app/app.vue loads
        |
        v
useFetch('/api/tree')
        |
        v
tree.value receives TreeNode[]
        |
        +------------------------------+
        |                              |
        v                              v
allDisplayNodes                  visibleDisplayNodes
full flattened tree              collapsed-aware flattened tree
        |                              |
        |                              v
        |                        template renders <li> rows
        |
        v
selection lookup and move destinations
```

Important distinction:

- `allDisplayNodes` ignores collapse state and represents the full tree.
- `visibleDisplayNodes` respects `collapsedFolderIds` and represents only visible rows.
- The move dropdown uses `allDisplayNodes` so collapsed folders remain valid destinations.
- The template uses `visibleDisplayNodes` so collapsed descendants are hidden.

Selecting a tree row:

```text
User clicks tree row
        |
        v
selectNode(node)
        |
        v
selectedNodeId = node.id
selectedNodeType = node.type
        |
        +-- if file -----> loadMarkdownPreview(node.id)
        |
        +-- if folder ---> clearMarkdownPreview()
```

Clearing selection:

```text
User clicks empty tree panel background
        |
        v
clearSelection()
        |
        v
selectedNodeId = null
selectedNodeType = null
moveDestinationValue = root sentinel
clearMarkdownPreview()
```

### User Action Flow: Create Folder

```text
User clicks + Folder
        |
        v
handleCreateFolderClick()
        |
        v
prompt for folder name
        |
        v
getCreateFolderParentId()
        |
        +-- selected folder ----> parentId = folder id
        |
        +-- selected file ------> parentId = null
        |
        +-- no selection -------> parentId = null
        |
        v
POST /api/folders
        |
        v
insertFolder(parentId, name)
        |
        v
return updated TreeNode[] to UI
        |
        v
tree.value = updatedTree
        |
        v
expand parent folder if parentId is not null
```

### User Action Flow: Move File/Folder

```text
User selects file/folder
        |
        v
moveDestinations computed from allDisplayNodes
        |
        v
User chooses destination
        |
        v
Confirm Move
        |
        v
POST /api/move with { nodeId, newParentId }
        |
        v
updateNodeParent(nodeId, newParentId)
        |
        v
return updated TreeNode[] to UI
        |
        v
tree.value = updatedTree
        |
        v
expand destination folder if newParentId is not null
```

### User Action Flow: Preview Markdown File

```text
User selects Markdown file
        |
        v
loadMarkdownPreview(fileId)
        |
        v
GET /api/markdown?fileId=<node-id>
        |
        v
look up file node to identify filePath
        |
        v
read Markdown content from filePath
        |
        v
return Markdown text to preview panel
```

The frontend should only display the response if the selected node still matches the requested file id. This prevents slower responses from earlier file selections from overwriting the preview for the currently selected file.

### User Action Flow: Collapse / Expand Folder

```text
User clicks folder toggle
        |
        v
toggleFolderCollapsed(node)
        |
        v
copy collapsedFolderIds Set
        |
        +-- if expanded ----> add folder id to Set
        |
        +-- if collapsed ---> remove folder id from Set
        |
        v
assign copied Set back to collapsedFolderIds
        |
        v
visibleDisplayNodes recomputes
```

If collapsing the folder hides the selected descendant, `clearSelection()` runs so the UI does not keep a hidden selected row or stale preview.

### In-Memory Tree Operations

These pure operations are used by both prototype stages and the SQLite DB layer.

```ts
buildTree(nodes: ExplorerNode[]): TreeNode[]
formatTree(tree: TreeNode[]): string
createFolder(nodes: ExplorerNode[], parentId: string | null, name: string): ExplorerNode[]
moveNode(nodes: ExplorerNode[], nodeId: string, newParentId: string | null): ExplorerNode[]
```

Expected behavior:

- `buildTree(nodes)` returns nested `TreeNode[]` from flat rows with existing `parentId` values.
- `formatTree(tree)` returns printable text for manual inspection.
- `createFolder(nodes, parentId, name)` returns updated flat rows with a new folder node.
- `moveNode(nodes, nodeId, newParentId)` returns updated flat rows with one changed parent relationship.
- These pure functions should not read or write SQLite directly.

### Initial File Organization

```ts
readMarkdownFileNames(directoryPath: string): string[]
organizeInitialFiles(fileNames: string[]): ExplorerNode[]
```

Expected behavior:

- `readMarkdownFileNames(directoryPath)` returns sorted Markdown filenames from the provided directory.
- `organizeInitialFiles(fileNames)` returns flat `ExplorerNode` rows representing the initial virtual hierarchy.
- The returned rows include folder nodes and file nodes.
- File nodes set `filePath` so previews can read from `files/`.

### Temporary In-Memory Store Operations

These operations are prototype/reference operations from Stage 3.2.

```ts
loadNodes(): ExplorerNode[]
insertFolder(parentId: string | null, name: string): ExplorerNode[]
updateNodeParent(nodeId: string, newParentId: string | null): ExplorerNode[]
```

Expected behavior:

- `loadNodes()` initializes from `files/` once if needed and returns copied flat rows.
- `insertFolder(parentId, name)` calls pure `createFolder(...)`, updates the in-memory array, and returns copied flat rows.
- `updateNodeParent(nodeId, newParentId)` calls pure `moveNode(...)`, updates the in-memory array, and returns copied flat rows.
- State is lost when the server process restarts.
- This layer is replaceable by SQLite operations without changing frontend code.

### Server API / UI-Facing Backend Operations

Server operations callable by the UI are exposed through `server/api` routes.

```ts
loadTree(): TreeNode[]
createFolderForUi(parentId: string | null, name: string): TreeNode[]
moveNodeForUi(nodeId: string, newParentId: string | null): TreeNode[]
getMarkdownFile(fileId: string): string
```

Expected behavior:

- `loadTree()` corresponds to `GET /api/tree`.
- `createFolderForUi(parentId, name)` corresponds to `POST /api/folders`.
- `moveNodeForUi(nodeId, newParentId)` corresponds to `POST /api/move`.
- `getMarkdownFile(fileId)` corresponds to `GET /api/markdown?fileId=<node-id>`.
- Current API routes use `db.ts` as their storage layer.

### Frontend Rendering Helpers And State

These helpers and reactive values live in `app/app.vue` during early prototyping. Later, they may move into Vue components or composables.

Reactive state:

- `tree`: latest `TreeNode[]` returned from `/api/tree` or a mutation route.
- `pending`: whether the initial tree request is loading.
- `error`: whether the initial tree request failed.
- `allDisplayNodes`: full flattened display rows derived from `tree.value`.
- `visibleDisplayNodes`: collapsed-aware display rows used by the template.
- `collapsedFolderIds`: UI-only `Set<string>` of collapsed folder ids.
- `selectedNodeId`: currently selected node id, or `null`.
- `selectedNodeType`: currently selected node type, or `null`.
- `moveDestinationValue`: current move dropdown value.
- `markdownPreview`: current loaded Markdown preview, or `null`.
- `previewPending`: whether preview content is loading.
- `previewError`: preview-specific error state.

Helpers / event handlers:

```ts
flattenTree(
  nodes: TreeNode[],
  depth: number,
  ancestorIds: string[],
  collapsedIds: Set<string> | null
): DisplayNode[]
selectNode(node: DisplayNode): void
clearSelection(): void
getCreateFolderParentId(): string | null
handleCreateFolderClick(): Promise<void>
handleMoveNodeClick(): Promise<void>
loadMarkdownPreview(fileId: string): Promise<void>
clearMarkdownPreview(): void
isFolderCollapsed(nodeId: string): boolean
expandFolder(folderId: string): void
toggleFolderCollapsed(node: DisplayNode): void
```

Expected behavior:

- `flattenTree(...)` converts nested `TreeNode[]` into flat display rows with `depth` and `ancestorIds`.
- `allDisplayNodes` recomputes whenever `tree.value` changes.
- `visibleDisplayNodes` recomputes whenever `tree.value` or `collapsedFolderIds` changes.
- `selectNode(node)` updates selected row state and loads/clears preview depending on node type.
- `clearSelection()` resets selection so creating a folder targets the virtual root.
- `getCreateFolderParentId()` returns the selected folder id, or `null` if no folder is selected or a file is selected.
- `handleCreateFolderClick()` gathers the folder name, calls the create-folder API route, assigns the returned tree to `tree.value`, and expands the parent folder when relevant.
- `handleMoveNodeClick()` calls the move API route, assigns the returned tree to `tree.value`, and expands the destination folder when relevant.
- `toggleFolderCollapsed(node)` toggles folder visibility and clears hidden selection/preview when needed.

### Persistence / DB Operations

These operations are used in Stage 4 and the current MVP.

```ts
ensureDatabase(): void
seedDatabaseIfEmpty(): void
loadNodes(): ExplorerNode[]
insertFolder(parentId: string | null, name: string): ExplorerNode[]
updateNodeParent(nodeId: string, newParentId: string | null): ExplorerNode[]
```

Expected behavior:

- `ensureDatabase()` creates the SQLite database/table if needed.
- `seedDatabaseIfEmpty()` inserts the initial virtual hierarchy only when no node rows exist.
- `loadNodes()` returns flat `ExplorerNode` rows from SQLite.
- `insertFolder(parentId, name)` inserts one folder row after pure validation.
- `updateNodeParent(nodeId, newParentId)` updates one node's parent and sort order after pure validation.

### Deferred Operations

`saveTree()` is deferred. The preferred MVP persistence model is operation-based updates: creating a folder inserts one row, and moving a node updates one row.

## 7. Validation Rules

- Folder names cannot be empty.
- `parentId` must be `null` or an existing folder node.
- Files cannot contain children.
- If a file is selected and the user clicks `+ Folder`, the UI sends `parentId = null` and creates at root.
- A node cannot be moved into itself.
- A folder cannot be moved into one of its descendants.
- Unknown node IDs should fail clearly.
- Unknown parent IDs should fail clearly.
- File preview should fail clearly if the file node does not exist or its file path cannot be read.
- Move-to-root is represented in the frontend with a sentinel string and converted to `null` before calling the API.
- The current move location should be shown but disabled.
- The move dropdown should use the full tree, not only visible collapsed rows.
- The app should not allow operations that require physically moving or rewriting files in `files/`.

## 8. Test Plan

Tree operation tests:

- `buildTree` creates a nested tree from flat rows.
- `buildTree` places `parentId = null` nodes at the virtual root.
- `buildTree` orders siblings by `sortOrder`.
- `formatTree` prints a readable tree.

Initial organization tests:

- `organizeInitialFiles` creates the expected root and product folders.
- `organizeInitialFiles` places governance files under `310-governance`.
- `organizeInitialFiles` places `311-` files under `311-epic-a`.
- `organizeInitialFiles` places `312-` files under `312-epic-b`.

Mutation tests:

- `createFolder` adds a folder at the root.
- `createFolder` adds a folder under another folder.
- `createFolder` rejects a file parent.
- `moveNode` moves a file.
- `moveNode` moves a folder.
- `moveNode` rejects moving a node into itself.
- `moveNode` rejects moving a folder into a descendant.
- Unknown IDs fail clearly.

Persistence tests:

- SQLite database is created under `data/`.
- Empty database is seeded once.
- Existing database rows are loaded without reseeding.
- Creating a folder persists after reload.
- Moving a node persists after reload.

Preview tests:

- `getMarkdownFile` returns content for a valid file node.
- `getMarkdownFile` fails clearly for an unknown file node.
- Selecting a folder clears preview.
- Stale preview responses are ignored when the user selects another file first.

Frontend interaction tests:

- `allDisplayNodes` includes the full tree regardless of collapsed state.
- `visibleDisplayNodes` hides descendants of collapsed folders.
- Collapse hides descendants but leaves the folder row visible.
- Expand restores descendants.
- Files do not show a collapse toggle.
- Move dropdown still includes valid collapsed folders as destinations.
- Collapsing a parent of the selected file clears selection and preview.
- Creating into a collapsed folder expands that folder.
- Moving into a collapsed folder expands that folder.

## 9. Manual Acceptance Checklist

- [ ] App starts locally.
- [ ] Initial tree matches the expected hierarchy.
- [ ] SQLite database is created under `data/`.
- [ ] Initial database seed happens once.
- [ ] Original files remain flat in `files/`.
- [ ] Clicking a file shows Markdown preview.
- [ ] Clicking a folder clears Markdown preview.
- [ ] Creating a root folder updates the tree.
- [ ] Creating a folder inside another folder updates the tree.
- [ ] If a file is selected, creating a folder places it at root.
- [ ] Moving a file updates the tree.
- [ ] Moving a folder updates the tree.
- [ ] Invalid moves are prevented.
- [ ] User-created folders persist after app restart.
- [ ] Moved nodes persist after app restart.
- [ ] Folder collapse hides descendants.
- [ ] Folder expand restores descendants.
- [ ] Collapsed folders still appear as valid move destinations.
- [ ] Collapsing the parent of a selected file clears preview.
- [ ] Creating into a collapsed folder expands that folder.
- [ ] Moving into a collapsed folder expands that folder.

## 10. Open Questions/Concerns

- Should IDs remain deterministic slugs, switch to generated UUIDs, or eventually use database-generated values?
- Should unknown filename patterns be placed in the root, placed in an `unclassified` folder, or rejected during seeding?
- Should duplicate folder names be allowed under the same parent?
- Should `sortOrder` be assigned by seed order, alphabetical order, user action order, or explicit manual ordering later?
- Should collapse/expand state stay ephemeral, or should it eventually persist as a user preference?
