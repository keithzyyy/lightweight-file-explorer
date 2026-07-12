
<script setup lang="ts">

/**
 * It flattens the nested TreeNode[] into display
 * rows with a depth, then uses guide columns to
 * visually show hierarchy.
 */

type TreeNode = {
  id: string
  type: 'folder' | 'file'
  name: string
  parentId: string | null
  filePath: string | null
  sortOrder: number
  children: TreeNode[]
}

type DisplayNode = TreeNode & {
  depth: number
}


/*
call the /api/tree endpoint to retrieve the markdown tree
*/
const { data: tree, pending, error } = await useFetch<TreeNode[]>('/api/tree')

function flattenTree(nodes: TreeNode[], depth = 0): DisplayNode[] {
  /*
  Flattens the nested TreeNode[] into display rows with a `depth`

  For example, if nodes: TreeNode[] is the following
  ```
  [
    {
      name: '300-product',
      children: [
        {
          name: '310-product-a',
          children: [...]
        }
      ]
    }
  ]
  ```
  Then it will return a flat DisplayNode[] like
  ```
  [
    { name: '300-product', depth: 0 },
    { name: '310-product-a', depth: 1 },
    { name: '310-governance', depth: 2 },
    { name: '310-ARCHITECTURE.md', depth: 3 }
  ]
  ```
  The template block will use the depth to render guide columns, e.g.
  ```
  v-for="level in node.depth"
  ```

  */
  return nodes.flatMap((node) => [
    { ...node, depth },
    ...flattenTree(node.children, depth + 1)
  ])
}

const displayNodes = computed(() => {
  /*
  `computed(..)`: Vue helper for creating a value that is automatically
  derived from other reactive values.
  - I.e. whenever tree.value changes, recalculate displayNodes
  */

  // ?? returns right operand when LHS is null or undefined
  return flattenTree(tree.value ?? [])
})

// Tracks which tree row is currently selected for highlighting and actions.
const selectedNodeId = ref<string | null>(null)

// Tracks whether the selected row can be used as a create-folder destination.
const selectedNodeType = ref<'folder' | 'file' | null>(null)

/**
 * Selects a tree row.
 *
 * Side effect: updates reactive selection state, which lets the template
 * apply the selected CSS class to the clicked row.
 */
function selectNode(node: DisplayNode) {
  selectedNodeId.value = node.id
  selectedNodeType.value = node.type
}

/**
 * Returns the folder id that should receive a newly created child folder.
 *
 * If no folder is selected, return null so the server creates at the root.
 */
function getCreateFolderParentId(): string | null {
  if (selectedNodeType.value !== 'folder') {
    return null
  }

  return selectedNodeId.value
}

/**
 * Handles the "+ Folder" button click.
 *
 * Side effects:
 * - asks the user for a folder name
 * - calls the create-folder API route
 * - replaces tree.value with the updated tree returned by the server
 */
async function handleCreateFolderClick() {
  const folderName = prompt('Folder name')

  if (!folderName) {
    return
  }

  const updatedTree = await $fetch<TreeNode[]>('/api/folders', {
    method: 'POST',
    body: {
      parentId: getCreateFolderParentId(),
      name: folderName
    }
  })

  tree.value = updatedTree
}

/**
 * Clears the current tree selection.
 *
 * Side effect: no tree row remains selected, so creating a folder targets root.
 */
function clearSelection() {
  selectedNodeId.value = null
  selectedNodeType.value = null
}

</script>

<template>

  <div class="tree-header">
    <h1>File Explorer</h1>
    <button type="button" @click.stop="handleCreateFolderClick">
      + Folder
    </button>
  </div>


  <main class="app-shell">
    <aside class="tree-panel" @click="clearSelection">
      <h1>File Explorer</h1>

      <p v-if="pending">Loading tree...</p>
      <p v-else-if="error">Could not load file tree.</p>

      <ul v-else class="tree-list">
        <li
          v-for="node in displayNodes"
          :key="node.id"
          class="tree-row"
          :class="{ selected: node.id === selectedNodeId }"
          @click.stop="selectNode(node)"
        >
          <span class="tree-indent" aria-hidden="true">
            <span
              v-for="level in node.depth"
              :key="`${node.id}-guide-${level}`"
              class="tree-guide"
              :class="{ elbow: level === node.depth }"
            />
          </span>
          <span class="node-icon">
            {{ node.type === 'folder' ? 'folder' : 'file' }}
          </span>
          <span>{{ node.name }}</span>
        </li>
      </ul>

    </aside>

    <section class="preview-panel">
      <h2>Preview</h2>
      <p>Select a Markdown file to preview its contents here.</p>
    </section>
  </main>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-columns: 320px 1fr;
  min-height: 100vh;
  font-family: Arial, sans-serif;
}

.tree-panel {
  border-right: 1px solid #ddd;
  padding: 16px;
  background: #f8f9fb;
}

.preview-panel {
  padding: 24px;
}

.tree-list {
  list-style: none;
  padding: 0;
  margin: 16px 0 0;
}

.tree-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 4px;
  border-radius: 4px;
}

.tree-row:hover {
  background: #e9eef5;
}

.node-icon {
  width: 48px;
  color: #666;
  font-size: 12px;
}

.tree-indent {
  display: inline-flex;
  flex: 0 0 auto;
  align-self: stretch;
}

.tree-guide {
  position: relative;
  width: 18px;
  min-height: 20px;
}

.tree-guide::before {
  content: "";
  position: absolute;
  top: -6px;
  bottom: -6px;
  left: 8px;
  border-left: 1px solid #c6ced8;
}

.tree-guide.elbow::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 8px;
  width: 10px;
  border-top: 1px solid #c6ced8;
}

.tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.tree-row {
  cursor: pointer;
}

.tree-row.selected {
  background: #dbeafe;
  color: #123c69;
  font-weight: 600;
}
</style>
