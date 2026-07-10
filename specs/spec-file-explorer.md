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

#### Stage 3.1: Real Markdown Files In Memory & render using Vue 

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
- 

### Stage 4: Real Markdown Files With SQLite Persistence

Persist the virtual folder/file structure in SQLite.

Goals:

- create the database and `nodes` table
- seed the database only when it is empty
- load existing rows on later app starts
- persist `createFolder` and `moveNode` changes through operation-based database updates

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

### In-Memory Tree Operations

These operations are used for stages 1-3 and tests.

```ts
buildTree(nodes): TreeNode[]
formatTree(tree): string
createFolder(nodes, parentId, name): ExplorerNode[]
moveNode(nodes, nodeId, newParentId): ExplorerNode[]
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
organizeInitialFiles(fileNames): ExplorerNode[]
```

Expected behavior:

- Accept a list of Markdown filenames.
- Return flat `ExplorerNode` rows representing the initial virtual hierarchy.
- Include folder nodes and file nodes.
- Set `filePath` for file nodes so previews can later read from `files/`.

### UI-Facing Operations

These operations are used when connecting Nuxt UI/API behavior.

```ts
loadTree(): TreeNode[]
createFolderForUi(parentId, name): TreeNode[]
moveNodeForUi(nodeId, newParentId): TreeNode[]
getMarkdownFile(fileId): string
```

Expected behavior:

- `loadTree()` returns the current nested tree for the UI.
- `createFolderForUi(parentId, name)` persists the folder creation and returns the updated tree.
- `moveNodeForUi(nodeId, newParentId)` persists the move and returns the updated tree.
- `getMarkdownFile(fileId)` returns Markdown content for preview.

### Persistence / DB Operations

These operations are used in stage 4.

```ts
ensureDatabase()
seedDatabaseIfEmpty()
loadNodes()
insertFolder(parentId, name)
updateNodeParent(nodeId, newParentId)
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

## 10. Open Questions

- Should IDs be deterministic slugs, generated UUIDs, or database-generated values?
- Should unknown filename patterns be placed in the root, in an `unclassified` folder, or rejected during seeding?
- Should duplicate folder names be allowed under the same parent?
- Should `sortOrder` be assigned alphabetically, by seed order, or by explicit grouping order?
- Should `node:sqlite` be used directly, or should the project switch to another SQLite package if Nuxt compatibility becomes awkward?
