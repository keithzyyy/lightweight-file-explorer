
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

type MarkdownPreview = {
  id: string
  name: string
  content: string
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

// Tracks folder ids that are currently collapsed in the UI.
const collapsedFolderIds = ref<Set<string>>(new Set())

function flattenTree(
  nodes: TreeNode[],
  depth = 0,
  ancestorIds: string[] = [],
  collapsedIds: Set<string> | null = null
): DisplayNode[] {
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

  When collapsedIds is provided, folder rows still appear, but their children
  are not included in the returned display rows.

  */
  return nodes.flatMap((node) => {
    const displayNode: DisplayNode = { ...node, depth, ancestorIds }

    if (node.type === 'folder' && collapsedIds?.has(node.id)) {
      return [displayNode]
    }

    return [
      displayNode,
      ...flattenTree(node.children, depth + 1, [...ancestorIds, node.id], collapsedIds)
    ]
  })
}

const allDisplayNodes = computed(() => {
  /*
  `computed(..)`: Vue helper for creating a value that is automatically
  derived from other reactive values.
  - I.e. whenever tree.value changes, recalculate allDisplayNodes.

  allDisplayNodes ignores collapsed folders so non-rendering logic can still
  find selected nodes and valid move destinations anywhere in the tree.
  */

  // ?? returns right operand when LHS is null or undefined
  return flattenTree(tree.value ?? [])
})

const visibleDisplayNodes = computed(() => {
  /*
  visibleDisplayNodes is the flattened list used by the template.
  It respects collapsedFolderIds, so collapsed descendants are hidden
  from the left-side tree without changing the underlying TreeNode[].
  */
  return flattenTree(tree.value ?? [], 0, [], collapsedFolderIds.value)
})

// Tracks which tree row is currently selected for highlighting and actions.
const selectedNodeId = ref<string | null>(null)

// Tracks whether the selected row can be used as a create-folder destination.
const selectedNodeType = ref<'folder' | 'file' | null>(null)

// Tracks the selected destination in the "Move to..." dropdown.
const moveDestinationValue = ref<string>(ROOT_DESTINATION_VALUE)

// Tracks the loaded Markdown preview for the selected file.
const markdownPreview = ref<MarkdownPreview | null>(null)

// Tracks whether the preview panel is waiting for Markdown content.
const previewPending = ref(false)

// Tracks preview-loading errors separately from the initial tree-loading error.
const previewError = ref<string | null>(null)

const selectedNode = computed(() => {
  /*
  Finds the full DisplayNode object for the currently selected row.

  This keeps selectedNodeId as the small source-of-truth value, while letting
  later helpers access parentId, type, depth, and ancestorIds when needed.
  */
  if (selectedNodeId.value === null) {
    return null
  }

  return allDisplayNodes.value.find((node) => node.id === selectedNodeId.value) ?? null
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

  for (const node of allDisplayNodes.value) {
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
 * Returns whether a folder row is currently collapsed in the UI.
 */
function isFolderCollapsed(nodeId: string): boolean {
  return collapsedFolderIds.value.has(nodeId)
}

/**
 * Expands a folder if it is currently collapsed.
 *
 * Side effect: replaces the Set with a copied Set so Vue can detect the
 * reactive update reliably.
 */
function expandFolder(folderId: string): void {
  if (!collapsedFolderIds.value.has(folderId)) {
    return
  }

  const nextCollapsedFolderIds = new Set(collapsedFolderIds.value)
  nextCollapsedFolderIds.delete(folderId)
  collapsedFolderIds.value = nextCollapsedFolderIds
}

/**
 * Toggles whether a folder's children are visible in the tree.
 *
 * Side effects:
 * - copies and reassigns collapsedFolderIds so Vue sees the Set update
 * - clears selection/preview if collapsing hides the selected descendant
 */
function toggleFolderCollapsed(node: DisplayNode): void {
  if (node.type !== 'folder') {
    return
  }

  const nextCollapsedFolderIds = new Set(collapsedFolderIds.value)
  const shouldCollapse = !nextCollapsedFolderIds.has(node.id)

  if (shouldCollapse) {
    nextCollapsedFolderIds.add(node.id)
  } else {
    nextCollapsedFolderIds.delete(node.id)
  }

  collapsedFolderIds.value = nextCollapsedFolderIds

  // If the current selection is inside the collapsed folder, it is no longer visible.
  if (shouldCollapse && selectedNode.value?.ancestorIds.includes(node.id)) {
    clearSelection()
  }
}

/**
 * Clears the Markdown preview panel.
 *
 * Side effect: resets preview content, loading state, and preview-specific
 * error state. This is used when a folder is selected or selection is cleared.
 */
function clearMarkdownPreview(): void {
  markdownPreview.value = null
  previewPending.value = false
  previewError.value = null
}

/**
 * Loads Markdown content for a selected file node.
 *
 * Side effects:
 * - clears the old preview
 * - shows preview loading state
 * - calls the Markdown preview API route
 * - stores the returned Markdown content if the same file is still selected
 */
async function loadMarkdownPreview(fileId: string): Promise<void> {
  markdownPreview.value = null
  previewError.value = null
  previewPending.value = true

  try {
    const preview = await $fetch<MarkdownPreview>('/api/markdown', {
      query: { fileId }
    })

    // Race guard: only apply this response if the same file is still selected.
    if (selectedNodeId.value === fileId && selectedNodeType.value === 'file') {
      markdownPreview.value = preview
      previewError.value = null
    }
  } catch (error) {
    // Race guard: do not show an old error after the user selects another node.
    if (selectedNodeId.value === fileId && selectedNodeType.value === 'file') {
      markdownPreview.value = null
      previewError.value = error instanceof Error ? error.message : 'Could not load Markdown preview.'
    }
  } finally {
    // Race guard: do not hide the loading state for a newer preview request.
    if (selectedNodeId.value === fileId && selectedNodeType.value === 'file') {
      previewPending.value = false
    }
  }
}

/**
 * Selects a tree row.
 *
 * Side effect: updates reactive selection state, which lets the template
 * apply the selected CSS class to the clicked row. File selections also load
 * the Markdown preview; folder selections clear the preview.
 */
function selectNode(node: DisplayNode) {
  selectedNodeId.value = node.id
  selectedNodeType.value = node.type
  moveDestinationValue.value = ROOT_DESTINATION_VALUE

  if (node.type === 'file') {
    loadMarkdownPreview(node.id)
  } else {
    clearMarkdownPreview()
  }
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

  const parentId = getCreateFolderParentId()

  const updatedTree = await $fetch<TreeNode[]>('/api/folders', {
    method: 'POST',
    body: {
      parentId,
      name: folderName
    }
  })

  tree.value = updatedTree

  if (parentId !== null) {
    expandFolder(parentId)
  }
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

    if (destination.parentId !== null) {
      expandFolder(destination.parentId)
    }

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
  clearMarkdownPreview()
}

/**
 * Updates the move destination selected inside TreePanel.
 *
 * TreePanel renders the dropdown, but app.vue owns this state because it is
 * reset by selection and move actions.
 */
function updateMoveDestinationValue(value: string): void {
  moveDestinationValue.value = value
}

</script>

<template>
  <main class="app-shell">
    <TreePanel
      :pending="pending"
      :error="error"
      :visible-display-nodes="visibleDisplayNodes"
      :selected-node-id="selectedNodeId"
      :move-destination-value="moveDestinationValue"
      :move-destinations="moveDestinations"
      :can-move-selected-node="canMoveSelectedNode"
      :is-folder-collapsed="isFolderCollapsed"
      @create-folder="handleCreateFolderClick"
      @move-node="handleMoveNodeClick"
      @select-node="selectNode"
      @clear-selection="clearSelection"
      @toggle-folder="toggleFolderCollapsed"
      @update-move-destination-value="updateMoveDestinationValue"
    />
    <MarkdownPreviewPanel
      :markdown-preview="markdownPreview"
      :preview-pending="previewPending"
      :preview-error="previewError"
    />
  </main>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-columns: 320px 1fr;
  min-height: 100vh;
  font-family: Arial, sans-serif;
}
</style>
