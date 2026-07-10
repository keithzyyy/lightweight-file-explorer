
<script setup lang="ts">

/**
 * It flattens the nested TreeNode[] into display
 * rows with a depth, then uses indentation to
 * visually show hierarchy
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

const { data: tree, pending, error } = await useFetch<TreeNode[]>('/api/tree')

function flattenTree(nodes: TreeNode[], depth = 0): DisplayNode[] {
  return nodes.flatMap((node) => [
    { ...node, depth },
    ...flattenTree(node.children, depth + 1)
  ])
}

const displayNodes = computed(() => {
  return flattenTree(tree.value ?? [])
})
</script>

<template>
  <main class="app-shell">
    <aside class="tree-panel">
      <h1>File Explorer</h1>

      <p v-if="pending">Loading tree...</p>
      <p v-else-if="error">Could not load file tree.</p>

      <ul v-else class="tree-list">
        <li
          v-for="node in displayNodes"
          :key="node.id"
          class="tree-row"
          :style="{ paddingLeft: `${node.depth * 20}px` }"
        >
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
</style>