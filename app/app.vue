
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
  ancestorIds: string[]
}

type MoveDestination = {
  value: string
  parentId: string | null
  label: string
  disabled: boolean
}


/*
call the /api/tree endpoint to retrieve the markdown tree
*/
const { data: tree, pending, error } = await useFetch<TreeNode[]>('/api/tree')

/*
HTML <select> option values are strings, so root cannot be represented as
the real null value inside the dropdown. This sentinel is converted back to
null before calling POST /api/move.
*/
const ROOT_DESTINATION_VALUE = '__root__'

function flattenTree(nodes: TreeNode[], depth = 0, ancestorIds: string[] = []): DisplayNode[] {
  /*
  Flattens the nested TreeNode[] into display rows with a `depth`
  and `ancestorIds`.

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
    { name: '300-product', depth: 0, ancestorIds: [] },
    { name: '310-product-a', depth: 1, ancestorIds: ['300-product'] },
    { name: '310-governance', depth: 2, ancestorIds: ['300-product', '310-product-a'] },
    { name: '310-ARCHITECTURE.md', depth: 3, ancestorIds: ['300-product', '310-product-a', '310-governance'] }
  ]
  ```
  The template block will use the depth to render guide columns, e.g.
  ```
  v-for="level in node.depth"
  ```

  The move dropdown uses ancestorIds to avoid offering a folder's own
  descendants as destinations.

  */
  return nodes.flatMap((node) => [
    { ...node, depth, ancestorIds },
    ...flattenTree(node.children, depth + 1, [...ancestorIds, node.id])
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

// Tracks the selected destination in the "Move to..." dropdown.
const moveDestinationValue = ref<string>(ROOT_DESTINATION_VALUE)

const selectedNode = computed(() => {
  /*
  Finds the full DisplayNode object for the currently selected row.

  This keeps selectedNodeId as the small source-of-truth value, while letting
  later helpers access parentId, type, depth, and ancestorIds when needed.
  */
  if (selectedNodeId.value === null) {
    return null
  }

  return displayNodes.value.find((node) => node.id === selectedNodeId.value) ?? null
})

const moveDestinations = computed<MoveDestination[]>(() => {
  /*
  Builds the dropdown options for moving the selected file/folder.

  The server still validates all move rules. This frontend list is defensive:
  it hides destinations that are definitely invalid and disables the current
  location so the user can see where the node already lives.
  */
  const selected = selectedNode.value
  const rootIsCurrentLocation = selected?.parentId === null

  const destinations: MoveDestination[] = [
    {
      value: ROOT_DESTINATION_VALUE,
      parentId: null,
      label: rootIsCurrentLocation ? 'root (current location)' : 'root',
      disabled: selected === null || rootIsCurrentLocation
    }
  ]

  if (selected === null) {
    return destinations
  }

  for (const node of displayNodes.value) {
    // Only folders can contain moved nodes, so files are not destinations.
    if (node.type !== 'folder') {
      continue
    }

    // A folder cannot be moved into itself.
    if (node.id === selected.id) {
      continue
    }

    // A folder cannot be moved into one of its own descendants.
    if (selected.type === 'folder' && node.ancestorIds.includes(selected.id)) {
      continue
    }

    const isCurrentLocation = node.id === selected.parentId

    destinations.push({
      value: node.id,
      parentId: node.id,
      label: `${'  '.repeat(node.depth)}${node.name}${isCurrentLocation ? ' (current location)' : ''}`,
      disabled: isCurrentLocation
    })
  }

  return destinations
})

const selectedMoveDestination = computed(() => {
  /*
  Converts the dropdown's string value into the full destination object.

  This is where the root sentinel becomes associated with parentId = null.
  */
  return moveDestinations.value.find((destination) => {
    return destination.value === moveDestinationValue.value
  }) ?? null
})

const canMoveSelectedNode = computed(() => {
  /*
  The Move button should only be enabled when:
  - a node is selected
  - the dropdown value maps to a known destination
  - that destination is not the current location
  */
  return (
    selectedNode.value !== null &&
    selectedMoveDestination.value !== null &&
    !selectedMoveDestination.value.disabled
  )
})

/**
 * Selects a tree row.
 *
 * Side effect: updates reactive selection state, which lets the template
 * apply the selected CSS class to the clicked row.
 */
function selectNode(node: DisplayNode) {
  selectedNodeId.value = node.id
  selectedNodeType.value = node.type
  moveDestinationValue.value = ROOT_DESTINATION_VALUE
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
 * Handles the "Move" button click.
 *
 * Side effects:
 * - checks that a node and a valid destination are selected
 * - calls the move API route
 * - replaces tree.value with the updated tree returned by the server
 * - resets the move dropdown back to root after a successful move
 */
async function handleMoveNodeClick() {
  const nodeId = selectedNodeId.value
  const destination = selectedMoveDestination.value

  // There is nothing to move if the user has not selected a tree row.
  if (nodeId === null) {
    return
  }

  // Avoid sending a request for an unknown or disabled destination.
  if (destination === null || destination.disabled) {
    return
  }

  try {
    const updatedTree = await $fetch<TreeNode[]>('/api/move', {
      method: 'POST',
      body: {
        nodeId,
        newParentId: destination.parentId
      }
    })

    tree.value = updatedTree
    moveDestinationValue.value = ROOT_DESTINATION_VALUE
  } catch (error) {
    // Keep MVP error handling simple while the backend validation evolves.
    alert(error instanceof Error ? error.message : 'Could not move file/folder.')
  }
}

/**
 * Clears the current tree selection.
 *
 * Side effect: no tree row remains selected, so creating a folder targets root.
 */
function clearSelection() {
  selectedNodeId.value = null
  selectedNodeType.value = null
  moveDestinationValue.value = ROOT_DESTINATION_VALUE
}

</script>

<template>
  <main class="app-shell">
    <aside class="tree-panel" @click="clearSelection">
      <div class="tree-header" @click.stop>
        <h1>File Explorer</h1>

        <div class="tree-actions">
          <button type="button" @click.stop="handleCreateFolderClick">
            + Folder
          </button>

          <select
            v-model="moveDestinationValue"
            class="move-select"
            :disabled="selectedNodeId === null"
          >
            <option
              v-for="destination in moveDestinations"
              :key="destination.value"
              :value="destination.value"
              :disabled="destination.disabled"
            >
              {{ destination.label }}
            </option>
          </select>

          <button
            type="button"
            :disabled="!canMoveSelectedNode"
            @click.stop="handleMoveNodeClick"
          >
            Move
          </button>
        </div>
      </div>

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
            {{ node.type === 'folder' ? '📂' : '📄' }}
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
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

.tree-header h1 {
  margin: 0;
  font-size: 20px;
}

.tree-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
}

.tree-actions button,
.move-select {
  font: inherit;
  padding: 6px 8px;
  border: 1px solid #c8d0dc;
  border-radius: 4px;
  background: #fff;
}

.tree-actions button {
  cursor: pointer;
  white-space: nowrap;
}

.move-select {
  flex: 1;
  min-width: 140px;
}

.tree-actions button:disabled,
.move-select:disabled {
  color: #7a8493;
  background: #eef1f5;
  cursor: not-allowed;
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
