<script setup lang="ts">
import type { TreeNode } from '../types/data'

const route = useRoute()

const nodeId = computed(() => {
  const routeId = route.params.id

  if (Array.isArray(routeId)) {
    return routeId[0] ?? ''
  }

  return typeof routeId === 'string' ? routeId : ''
})

const nodeUrl = computed(() => {
  return `/api/tree/node/${encodeURIComponent(nodeId.value)}`
})

const { data: node, pending, error } = await useFetch<TreeNode>(nodeUrl)

const previewError = computed(() => {
  return error.value ? 'Could not load the selected tree node.' : null
})
</script>

<template>
  <MarkdownPreviewPanel
    :markdown-preview="node"
    :preview-pending="pending"
    :preview-error="previewError"
  />
</template>
