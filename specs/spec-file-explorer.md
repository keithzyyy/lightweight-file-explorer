# File Explorer Spec

## Purpose
The app organizes a flat set of Markdown files into a virtual folder tree, displays it in a web UI, and lets users create/move folders/files.

## MVP Scope
The app must support the following as a minimum viable requirement:
- seed initial useful hierarchy from files/
- display tree
- preview selected Markdown
- create folder
- move file/folder
- persist changes

## Non-Goals
Good non-goals for now:
- no file upload
- no physical moving of files in `files/`
- no editing Markdown contents in `files/`
- no drag-and-drop in MVP
- no authentication
- no multi-user support


## Data Model
Define the flat node shape for an object (file or folder). Prefer TypeScript-style names (JavaScript + typing) since implementation is likely TypeScript
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

## Initial File Organization
Document the seed hierarchy and the rule behind it. This is important because “organise them into a useful structure” is a requirement.

## Core Operations

This is the heart of the feature branch. For each function, define:
- purpose
- input
- output
- side effects or no side effects
- error cases


For the first tree-model branch, prefer to make the pure operations in-memory and side-effect-free where possible:

```ts
buildTree(nodes): TreeNode[]
createFolder(nodes, parentId, name): ExplorerNode[]
moveNode(nodes, nodeId, newParentId): ExplorerNode[]
```

### `buildTree(nodes)`

### `createFolder(nodes, parentId, name)`

### `moveNode(nodes, nodeId, newParentId)`

### `getMarkdownFile(fileId)`

### `loadTree()`

### `saveTree(tree)`

## Validation Rules

Examples:
- folder name cannot be empty
- parentId must be null or an existing folder
- files cannot contain children
- cannot move a node into itself
- cannot move a folder into its descendant
- unknown node IDs should fail clearly

## UI Behavior
Keep this behavior-level for now:
- left panel tree
- right panel preview
- create folder button
- move using “Move to...” control
- selected folder is default create destination
- no selected folder means root

## Persistence Behavior
For now, this section can state the intended later behavior:
- current feature may operate in memory
- final app uses SQLite
- original Markdown files remain flat
- persisted user changes should not be overwritten by re-seeding

## Development Plan
1. Start in memory: use plain in-memory data inside the Node.js runtime. Define an array such as
    ```ts
    const nodes = [
    { id: '300-product', type: 'folder', name: '300-product', parentId: null },
    { id: '310-product-a', type: 'folder', name: '310-product-a', parentId: '300-product' },
    { id: '310-architecture', type: 'file', name: '310-ARCHITECTURE.md', parentId: '310-governance', filePath: 'files/310-ARCHITECTURE.md' }
    ]
    ```
    Then test the following:
    ```ts
    buildTree(nodes)
    createFolder(nodes, parentId, name)
    moveNode(nodes, nodeId, newParentId)
    ```

2. Logic to read existing `files/` list into initial node rows: Create logic that knows how to turn the existing files/ list into initial node rows.
That can still return in-memory rows first:
    ```ts
    const nodes = seedInitialNodes(markdownFiles)
    ```

3. Add SQLite for persistence: You only need SQLite once you want changes to survive after the app stops.
    - Without SQLite:
        ```
        run app
        create folder
        move file
        stop app
        changes disappear
        ```
    - With SQLite:
      ```
      run app
      create folder
      move file
      stop app
      restart app
      changes remain
      ```
   - I.e. So SQLite is for persistence, not for proving the tree logic.

**Rough plan**

1. Define the node data shape.
2. Implement `buildTree()` from flat nodes.
3. Implement `createFolder()` in memory.
4. Implement `moveNode()` in memory, including invalid move prevention.
5. Add tests.
6. Add seeding from the known Markdown files.
7. Add SQLite storage.
8. Connect to Nuxt API routes.
9. Connect to UI.

## Test Plan
This should be concrete:
- `buildTree` creates nested tree from flat rows
- root nodes have `parentId = null`
- `createFolder` adds folder under root
- `createFolder` adds folder under folder
- `createFolde`r rejects file parent
- `moveNode` moves file
- `moveNode` moves folder
- `moveNode` rejects self move
- `moveNode` rejects descendant move
- unknown IDs fail clearly

## Manual Acceptance Checklist

- [ ] App starts locally
- [ ] Initial tree matches expected hierarchy
- [ ] Clicking a file shows Markdown preview
- [ ] Creating a root folder persists
- [ ] Creating a folder inside another folder persists
- [ ] Moving a file persists
- [ ] Invalid moves are prevented

## Open Questions