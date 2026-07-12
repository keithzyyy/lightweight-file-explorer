# File Explorer Spec

## 1. Purpose

The app reads the provided flat Markdown files from `files/`, organizes them into a useful virtual folder tree, displays that tree in a web UI, allows users to create folders and move files or folders, and persists the virtual structure without physically moving or rewriting the original Markdown files.

## 2. High-Level MVP Program Flow

The MVP app is database-backed. In-memory operations are still useful during development, but the finished MVP should persist user changes with SQLite.

Expected MVP flow:

1. The user starts the Nuxt app and opens it in the browser.
2. The Nuxt server ensures the SQLite database and `nodes` table exist.
3. The server checks whether node rows already exist.
4. If the database has node rows, the server loads the existing flat nodes from SQLite.
5. If the database is empty, the server reads Markdown filenames from `files/`, organizes them into initial flat `ExplorerNode` rows, inserts those rows into SQLite, and then loads the rows.
6. The server calls `buildTree(nodes)` to convert flat rows into a nested tree.
7. The UI renders the nested tree in the left file explorer panel.
8. When the user creates a folder or moves a node, the UI sends the request to the server.
9. The server validates the operation and updates SQLite.
10. The server reloads flat nodes, rebuilds the tree, and returns the updated tree to the UI.
11. When the user selects a Markdown file, the server reads the file content from `files/` and returns it for preview.

`buildTree(nodes)` does not decide where files belong. It only converts rows with existing parent relationships into nested data for rendering. Initial file organization is a separate step.

## 3. Non-Goals

- No file upload for the MVP.
- No physical moving, renaming, or rewriting files in `files/`.
- No editing Markdown file contents.
- No drag-and-drop movement for the MVP.
- No authentication.
- No multi-user or concurrent editing support.

## 4. Development Plan

The implementation should progress in stages so the tree logic can be understood before SQLite and UI wiring add complexity.

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
- confirm the generated rows represent the expected hierarchy
- reuse `buildTree(nodes)` and `formatTree(tree)` to inspect the result

### Stage 3: Real Markdown Files In Memory

Read the real Markdown filenames from `files/` and organize them into initial flat `ExplorerNode` rows in memory.

Goals:
- construct a `readMarkdownFileNames(dir)` function to read files in `dir`
- confirm the program can discover the provided files
- keep original files flat and unchanged
- verify the real file list produces the expected starting hierarchy

#### Stage 3.1: Render tree using Vue 

Read the real Markdown filenames from `files/`, organize them into initial flat `ExplorerNode` rows in memory, **and render the initial tree using Vue**.
- The real Markdown files are read by the Nuxt server, organized using our deterministic rule, converted into a tree, and displayed in the browser.

Goals:
- First, confirm that the tree can be rendered; the expected starting hierarchy of the files are present in the app, something like:
   ```
   files/
      real Markdown docs

   server/utils/tree.ts
      readMarkdownFileNames
      organizeInitialFiles
      buildTree

   server/api/tree.get.ts
      returns buildTree(organizeInitialFiles(readMarkdownFileNames('files')))

   app/app.vue
      calls /api/tree
      renders a basic left-side tree
      right side can be placeholder for now
   ```

#### Stage 3.2: Design storage layer code 

The goal is to familiarize UI operations without touching database yet, but where exactly do we store the in-memory directory tree? 

Goal of this stage is to design a storage layer to store the most recent updated `ExplorerNode[]`, **but designed in a way that matches DB operations so that Stage 4 won't require massive overhaul.** 

```
UI
  calls server API

server API
  calls storage operations

storage layer
  returns ExplorerNode[]

tree logic
  buildTree(nodes)

server API
  returns TreeNode[] to UI
```

Store most recent `ExplorerNode[]` in a server-side `.ts` module, namely 
```
server/utils/node-store.ts
```
where it exposes operations shaped like future DB operations
```ts
function loadNodes(): ExplorerNode[]

/*
For now, `nodes = [...nodes, newFolder]`
Which is analogous to `INSERT INTO nodes ...`
*/
function createFolderNode(
      parentId: string | null,
      name: string): ExplorerNode[]

function updateNodeParent(
   nodeId: string,
   newParentId: string | null): ExplorerNode[]
```
So here "persistence" is substituted with an in memory prototype: `let nodes: ExplorerNode[]` as opposed to a `nodes` table in SQLite.


#### Stage 3.3: UI operations for `createFolder`  
1. Create server in-memory node store
2. Change GET /api/tree to load from that store
3. Add POST /api/folders
4. In app.vue, add selected folder state
5. Add "+ Folder" button
6. On create, update `tree.value` with returned tree

#### Stage 3.4: UI operations for `moveNodes`

#### Stage 3.5: Preview `.md` file contents in the app


### Stage 4: Real Markdown Files With SQLite Persistence

Persist the virtual folder/file structure in SQLite.

Goals:

- create the database and `nodes` table
- seed the database only when it is empty
- load existing rows on later app starts
- persist `createFolder` and `moveNode` changes through operation-based database updates.
  - For example, the equivalent database-insert SQL shape code to insert a folder node to the in-memory structure could be
      ```sql
      INSERT INTO nodes (id, type, name, parent_id, file_path, sort_order)
      VALUES (?, 'folder', ?, ?, NULL, ?)
      ```
   - And the equivalent SQL operation to move a node could be:
      ```sql
      UPDATE nodes
      SET parent_id = ?
      WHERE id = ?
      ```

## 5. Expected Behavior

### Data Model

Use a flat adjacency-list model as the source shape for both in-memory development and SQLite persistence.

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

SQLite can use snake_case column names while the application uses camelCase fields:

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
- The frontend should render a nested `TreeNode[]`, not raw database rows.

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

- Show the file/folder tree in a left panel.
- Show the selected Markdown file preview in a right panel.
- Provide a create-folder button.
- Provide a simple "Move to..." control for moving files or folders.
- Selecting a folder makes it the default destination for creating a child folder.
- If no folder is selected, creating a folder should place it at the virtual root.
- Selecting a file should show its Markdown contents in the preview pane.

### Persistence Behavior

- SQLite stores the virtual folder/file structure.
- The original Markdown files remain flat in `files/`.
- The app seeds the database only when it is empty.
- User-created folders and moved nodes must persist after app restart.
- Seeding must not overwrite persisted user changes.

## 6. Core Operations / Function Interfaces

This section separates functions by where they run and what kind of state they touch. Function names listed here are the intended contracts for the project modules and UI flow.

### Implementation Convention

- Functions listed in this section are the intended module contracts.
- Internal helper functions should be prefixed with `_`.
- Helper functions may still be tested directly later if useful, but app code should prefer calling the public contract functions.
- Frontend event handlers should be named by the UI event they handle, such as `handleCreateFolderClick()`, so they are not confused with pure data operations such as `createFolder(...)`.

### Function Flow: In-Memory Prototype

Used in stages 1-3. Data lives only in memory while the script or dev server is running.

```text
files/ or hardcoded filenames
        |
        v
readMarkdownFileNames(dir)          # stage 3 only
        |
        v
organizeInitialFiles(fileNames)     # creates flat ExplorerNode[]
        |
        v
ExplorerNode[]                      # flat rows with parentId links
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
                      |
                      v
              formatTree(tree)       # terminal inspection
              OR
              flattenTree(tree)      # frontend display helper
                      |
                      v
              displayed tree
```

### Function Flow: SQLite-Backed MVP

Used in stage 4 and the final MVP. SQLite is the source of truth.

```text
Nuxt app starts
        |
        v
ensureDatabase()
        |
        v
seedDatabaseIfEmpty()
        |
        +-- if DB empty -----------------------------+
        |                                            |
        v                                            |
readMarkdownFileNames('files/')                      |
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
                         loadNodes()
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
GET /api/tree returns tree to Vue UI
                             |
                             v
frontend renders tree
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
        v
displayNodes recomputes from tree.value
        |
        v
template renders one <li> per DisplayNode
```

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
        v
template applies selected class to the matching row
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
        |
        v
no tree row has the selected class
```

### User Actions Flow
#### Create folder
```text
User creates folder in UI
        |
        v
handleCreateFolderClick() // "+Folder", call folder api, update tree 
        |
        v
getCreateFolderParentId()
        |
        v
frontend sends POST /api/folders
        |
        v
createFolderForUi(parentId, name) // function coresponding to above API
        |
        v
validate parentId and folder name
        |
        v
insertFolder(parentId, name)
        |
        v
loadNodes()
        |
        v
buildTree(nodes) // response to the frontend's call
        |
        v
return updated TreeNode[] to UI
        |
        v
tree.value = updatedTree
        |
        v
displayNodes recomputes and the tree UI rerenders
```
#### Move file/folder in UI
```text
User clicks a node (file/folder)
--> selectedNodeId = node.id
        |
        v
Click a [Move to...] button
        |
        v
Trigger a dropdown below button: root + valid folder destinations
--> Probably need selectedNodeType to inform valid destinations
        |
        v
User chooses a destination from the dropdown
--> moveDestinationParentId = selected value
        |
        v
frontend sends POST /api/move
        |
        v
moveNodeForUi(nodeId, newParentId) // function coresponding to above API
        |
        v
validate nodeId, newParentId, and descendant rules
        |
        v
updateNodeParent(nodeId, newParentId)
        |
        v
loadNodes()
        |
        v
buildTree(nodes) // response to the frontend's call
        |
        v
return updated TreeNode[] to UI
```
#### Preview markdown file
```text
User selects Markdown file
        |
        v
GET /api/markdown?fileId=<node-id>
        |
        v
getMarkdownFile(fileId)
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

When loading Markdown preview content, the frontend should only display the response if the selected node still matches the requested file id. This prevents slower responses from earlier file selections from overwriting the preview for the currently selected file.
- E.g. if I click file A then quickly click file B, request B might finish first (preview shows file B) but request A finishes later (if no guard is applied, preview gets overwritten with file A),then the preview gets overwritten with file A
- if File A’s response comes back after the user has already selected File B, the app ignores File A’s stale response.

### In-Memory Tree Operations

These operations are used for stages 1-3 and tests.

```ts
buildTree(nodes: ExplorerNode[]): TreeNode[]
formatTree(tree: TreeNode[]): string
createFolder(nodes: ExplorerNode[], parentId: string | null, name: string): ExplorerNode[]
moveNode(nodes: ExplorerNode[], nodeId: string, newParentId: string | null): ExplorerNode[]
```

Expected behavior:

- `buildTree(nodes)` returns nested `TreeNode[]` from flat rows with existing `parentId` values.
  - For example, this flat set of nodes
   ```ts
   const nodes = [
   { id: '300-product',
      type: 'folder',
      name: '300-product',
      parentId: null },

   { id: '310-governance',
      type: 'folder',
      name: '310-governance',
      parentId: '310-product-a'},

   { id: '310-epic-a',
      type: 'folder',
      name: '310-epic-a',
      parentId: '310-product-a'},

   { id: '310-product-a',
      type: 'folder',
      name: '310-product-a',
      parentId: '300-product' },
   { id: '310-architecture',
      type: 'file',
      name: '310-ARCHITECTURE.md',
      parentId: '310-governance',
      filePath: 'files/310-ARCHITECTURE.md' },
   ]
   ```
   should return
   ```ts
   [
      {
         id: '300-product',
         type: 'folder',
         name: '300-product',
         children: [
            {
               id: '310-product-a',
               type: 'folder',
               name: '310-product-a',
               children: [
                  {
                     id: '310-governance',
                     type: 'folder',
                     name: '310-governance',
                     children: [
                           { id: '310-architecture',
                           type: 'file',
                           name: '310-ARCHITECTURE.md',
                           filePath: 'files/310-ARCHITECTURE.md'

                           }
                     ]
                  },

                  {
                     id: '310-epic-a',
                     type: 'folder',
                     name: '310-epic-a',
                     children: []
                  }
               ]
            }
         ]
      }
   ]
   ```
- `formatTree(tree)` returns printable text for manual inspection.
- `createFolder(nodes, parentId, name)` returns updated flat rows with a new folder node.
- `moveNode(nodes, nodeId, newParentId)` returns updated flat rows with one changed parent relationship.
- These functions should not read or write SQLite.

### Initial File Organization

This operation is used in stages 2-4.

```ts
readMarkdownFileNames(directoryPath: string): string[]
organizeInitialFiles(fileNames: string[]): ExplorerNode[]
```

Expected behavior:

- `readMarkdownFileNames(directoryPath)` returns sorted Markdown filenames from the provided directory.
- Accept a list of Markdown filenames.
- Return flat `ExplorerNode` rows representing the initial virtual hierarchy.
- Include folder nodes and file nodes.
- Set `filePath` for file nodes so previews can later read from `files/`.

### Temporary In-Memory Store Operations

These operations are used during Stage 3.2 before SQLite is introduced. They mimic the future persistence boundary while storing rows in a module-level `ExplorerNode[]`.

```ts
loadNodes(): ExplorerNode[]
insertFolder(parentId: string | null, name: string): ExplorerNode[]
updateNodeParent(nodeId: string, newParentId: string | null): ExplorerNode[]
```

Expected behavior:

- `loadNodes()` initializes from `files/` once if needed and returns copied flat rows.
- `insertFolder(parentId, name)` calls the pure `createFolder(...)`, updates the in-memory array, and returns copied flat rows.
- `updateNodeParent(nodeId, newParentId)` calls the pure `moveNode(...)`, updates the in-memory array, and returns copied flat rows.
- State is lost when the server process restarts.
- This layer should be replaceable by SQLite operations without changing frontend code.

### Server API / UI-Facing Backend Operations

Server operations callable by the UI.
- Namely, in Nuxt app, these are backend operations exposed through `server/api` routes so the frontend can call them.

```ts
loadTree(): TreeNode[]
createFolderForUi(parentId: string | null, name: string): TreeNode[]
moveNodeForUi(nodeId: string, newParentId: string | null): TreeNode[]
getMarkdownFile(fileId: string): string
```

Expected behavior:

- `loadTree()` corresponds to `GET /api/tree`, implemented by `server/api/tree.get.ts`.
- `createFolderForUi(parentId, name)` persists the folder creation and returns the updated tree. Corresponds to `POST /api/folder`, implemented by `server/api/folders.post.ts`.
- `moveNodeForUi(nodeId, newParentId)` persists the move and returns the updated tree. Corresponds to `POST /api/move`.
- `getMarkdownFile(fileId)` returns Markdown content for preview. Corresponds to `GET /api/markdown?fileId=<node-id>`.

### Frontend Rendering Helpers And State

These helpers and reactive values live in `app/app.vue` during early prototyping. Later, they may move into Vue components or composables.

Reactive state:

- `tree`: latest `TreeNode[]` returned from `/api/tree` or a mutation route.
- `pending`: whether the initial tree request is loading.
- `error`: whether the initial tree request failed.
- `displayNodes`: computed flat display rows derived from `tree.value`.
- `selectedNodeId`: currently selected node id, or `null`.
- `selectedNodeType`: currently selected node type, or `null`.

Helpers / event handlers:

```ts
flattenTree(tree: TreeNode[]): DisplayNode[]
selectNode(node: DisplayNode): void
clearSelection(): void
getCreateFolderParentId(): string | null
handleCreateFolderClick(): Promise<void>
```

Expected behavior:

- `flattenTree(tree)` converts nested `TreeNode[]` into flat display rows with `depth`.
- `displayNodes` recomputes whenever `tree.value` changes.
- `selectNode(node)` updates selection state so the clicked row can be highlighted.
- `clearSelection()` resets selection so creating a folder targets the virtual root.
- `getCreateFolderParentId()` returns the selected folder id, or `null` if no folder is selected.
- `handleCreateFolderClick()` gathers the folder name, calls the create-folder API route, assigns the returned tree to `tree.value`, and lets `displayNodes` recompute.

### Persistence / DB Operations

These operations are used in stage 4.

```ts
ensureDatabase()
seedDatabaseIfEmpty()
loadNodes()
insertFolder(parentId: string | null, name: string)
updateNodeParent(nodeId: string, newParentId: string | null)
```

Expected behavior:

- `ensureDatabase()` creates the SQLite database/table if needed.
- `seedDatabaseIfEmpty()` inserts the initial virtual hierarchy only when no node rows exist.
- `loadNodes()` returns flat `ExplorerNode` rows from SQLite.
- `insertFolder(parentId, name)` inserts one folder row.
- `updateNodeParent(nodeId, newParentId)` updates one node's parent.

### Deferred Operations

`saveTree()` is deferred. The preferred MVP persistence model is operation-based updates: creating a folder inserts one row, and moving a node updates one row.

## 7. Validation Rules

- Folder names cannot be empty.
- `parentId` must be `null` or an existing folder node.
- Files cannot contain children.
- A node cannot be moved into itself.
- A folder cannot be moved into one of its descendants.
- Unknown node IDs should fail clearly.
- Unknown parent IDs should fail clearly.
- File preview should fail clearly if the file node does not exist or its file path cannot be read.
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

- Empty database is seeded once.
- Existing database rows are loaded without reseeding.
- Creating a folder persists after reload.
- Moving a node persists after reload.

Preview tests:

- `getMarkdownFile` returns content for a valid file node.
- `getMarkdownFile` fails clearly for an unknown file node.

## 9. Manual Acceptance Checklist

- [ ] App starts locally.
- [ ] Initial tree matches the expected hierarchy.
- [ ] Original files remain flat in `files/`.
- [ ] Clicking a file shows Markdown preview.
- [ ] Creating a root folder updates the tree.
- [ ] Creating a folder inside another folder updates the tree.
- [ ] Moving a file updates the tree.
- [ ] Moving a folder updates the tree.
- [ ] Invalid moves are prevented.
- [ ] User-created folders persist after app restart.
- [ ] Moved nodes persist after app restart.

## 10. Open Questions/Concerns

- ⚠️ creating a folder beneath a file **should** throw an error. Currently this operation creates the folder at the root directory.
- ⚠️ explicit deselect option?
- Should IDs be deterministic slugs, generated UUIDs, or database-generated values?
- Should unknown filename patterns be placed in the root, in an `unclassified` folder, or rejected during seeding?
- Should duplicate folder names be allowed under the same parent?
- Should `sortOrder` be assigned alphabetically, by seed order, or by explicit grouping order?
- Should `node:sqlite` be used directly, or should the project switch to another SQLite package if Nuxt compatibility becomes awkward?
