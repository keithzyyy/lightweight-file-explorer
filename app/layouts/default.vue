<script setup lang="ts">
import { ROOT_NODE_ID } from '../types/data'
import type { MoveDestination, Tree } from '../types/data'

const route = useRoute()
const { data: tree, pending, error } = await useFetch<Tree[]>('/api/tree')

const collapsedFolderIds = ref<Set<string>>(new Set())
const moveDestinationValue = ref(ROOT_NODE_ID)

const selectedNodeId = computed(() => {
  const routeId = route.params.id
  return typeof routeId === 'string' ? routeId : null
})

const allDisplayNodes = computed(() => tree.value ?? [])

const visibleDisplayNodes = computed(() => {
  return allDisplayNodes.value.filter((node) => {
    return !node.ancestorIds.some((ancestorId) => {
      return collapsedFolderIds.value.has(ancestorId)
    })
  })
})

const selectedNode = computed(() => {
  if (selectedNodeId.value === null) {
    return null
  }

  return allDisplayNodes.value.find((node) => {
    return node.id === selectedNodeId.value
  }) ?? null
})

const moveDestinations = computed<MoveDestination[]>(() => {
  const selected = selectedNode.value
  const rootIsCurrentLocation = selected?.parentId === null
  const destinations: MoveDestination[] = [
    {
      value: ROOT_NODE_ID,
      parentId: null,
      label: rootIsCurrentLocation ? 'root (current location)' : 'root',
      disabled: selected === null || rootIsCurrentLocation
    }
  ]

  if (selected === null) {
    return destinations
  }

  for (const node of allDisplayNodes.value) {
    if (node.type !== 'folder' || node.id === selected.id) {
      continue
    }

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
  return moveDestinations.value.find((destination) => {
    return destination.value === moveDestinationValue.value
  }) ?? null
})

const canMoveSelectedNode = computed(() => {
  return (
    selectedNode.value !== null &&
    selectedMoveDestination.value !== null &&
    !selectedMoveDestination.value.disabled
  )
})

watch(selectedNodeId, () => {
  moveDestinationValue.value = ROOT_NODE_ID
})

function isFolderCollapsed(nodeId: string): boolean {
  return collapsedFolderIds.value.has(nodeId)
}

function expandFolder(folderId: string): void {
  if (!collapsedFolderIds.value.has(folderId)) {
    return
  }

  const nextCollapsedFolderIds = new Set(collapsedFolderIds.value)
  nextCollapsedFolderIds.delete(folderId)
  collapsedFolderIds.value = nextCollapsedFolderIds
}

async function toggleFolderCollapsed(node: Tree): Promise<void> {
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

  if (shouldCollapse && selectedNode.value?.ancestorIds.includes(node.id)) {
    await clearSelection()
  }
}

async function selectNode(node: Tree): Promise<void> {
  await navigateTo(`/${encodeURIComponent(node.id)}`)
}

async function clearSelection(): Promise<void> {
  if (selectedNodeId.value !== null) {
    await navigateTo('/')
  }
}

function getCreateFolderParentId(): string | null {
  return selectedNode.value?.type === 'folder' ? selectedNode.value.id : null
}

async function handleCreateFolderClick(): Promise<void> {
  const folderName = prompt('Folder name')

  if (!folderName) {
    return
  }

  const parentId = getCreateFolderParentId()
  const parentRouteId = parentId ?? ROOT_NODE_ID
  const updatedTree = await $fetch<Tree[]>(
    `/api/tree/node/${encodeURIComponent(parentRouteId)}`,
    {
      method: 'POST',
      body: { name: folderName }
    }
  )

  tree.value = updatedTree

  if (parentId !== null) {
    expandFolder(parentId)
  }
}

async function handleMoveNodeClick(): Promise<void> {
  const nodeId = selectedNodeId.value
  const destination = selectedMoveDestination.value

  if (nodeId === null || destination === null || destination.disabled) {
    return
  }

  try {
    tree.value = await $fetch<Tree[]>(
      `/api/tree/node/${encodeURIComponent(nodeId)}`,
      {
        method: 'PATCH',
        body: { parentId: destination.parentId }
      }
    )

    if (destination.parentId !== null) {
      expandFolder(destination.parentId)
    }

    moveDestinationValue.value = ROOT_NODE_ID
  } catch (error) {
    alert(error instanceof Error ? error.message : 'Could not move file/folder.')
  }
}

function updateMoveDestinationValue(value: string): void {
  moveDestinationValue.value = value
}
</script>

<template>
  <main class="app-shell">
    <AppSidebar
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

    <section class="page-content">
      <slot />
    </section>
  </main>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  min-height: 100vh;
  font-family: Arial, sans-serif;
}

.page-content {
  min-width: 0;
}
</style>
