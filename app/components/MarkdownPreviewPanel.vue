<script setup lang="ts">
import type { TreeNode } from '../types/data'

/**
 * Presentational panel for Markdown preview state.
 *
 * The current page owns loading the selected node. This component only
 * renders the state it receives.
 */
const props = defineProps<{
  markdownPreview: TreeNode | null
  previewPending: boolean
  previewError: string | null
}>()
</script>

<template>
  <section class="preview-panel">
    <h2>Preview</h2>

    <p v-if="props.previewPending">Loading preview...</p>
    <p v-else-if="props.previewError">{{ props.previewError }}</p>

    <article v-else-if="props.markdownPreview" class="preview-document">
      <h3>{{ props.markdownPreview.name }}</h3>
      <pre
        v-if="props.markdownPreview.type === 'file'"
        class="preview-content"
      >{{ props.markdownPreview.content }}</pre>
      <p v-else>This folder is selected in the file explorer.</p>
    </article>

    <p v-else>Select a Markdown file to preview its contents here.</p>
  </section>
</template>

<style scoped>
.preview-panel {
  padding: 24px;
}

.preview-document h3 {
  margin-top: 0;
}

.preview-content {
  padding: 16px;
  border: 1px solid #d9dee8;
  border-radius: 4px;
  overflow: auto;
  white-space: pre-wrap;
  font-family: Consolas, "Courier New", monospace;
  line-height: 1.5;
  background: #fbfcfe;
}
</style>
