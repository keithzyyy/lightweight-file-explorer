<script setup lang="ts">
import type { MoveDestination, Tree } from '../types/data'

/**
 * Persistent file explorer sidebar used by the default layout.
 *
 * The layout owns the shared state and mutation handlers. This component
 * renders that state and emits user actions back to the layout.
 */
const props = defineProps<{
  pending: boolean
  error: unknown
  visibleDisplayNodes: Tree[]
  selectedNodeId: string | null
  moveDestinationValue: string
  moveDestinations: MoveDestination[]
  canMoveSelectedNode: boolean
  isFolderCollapsed: (nodeId: string) => boolean
}>()

const emit = defineEmits<{
  'create-folder': []
  'move-node': []
  'select-node': [node: Tree]
  'clear-selection': []
  'toggle-folder': [node: Tree]
  'update-move-destination-value': [value: string]
}>()

/**
 * Emits the selected dropdown value to the parent.
 *
 * The parent owns moveDestinationValue because it participates in the wider
 * move-node flow and is reset after selection/move actions.
 */
function handleMoveDestinationChange(event: Event): void {
  const select = event.target as HTMLSelectElement
  emit('update-move-destination-value', select.value)
}
</script>

<template>
  <aside class="tree-panel" @click="emit('clear-selection')">
    <div class="tree-header" @click.stop>
      <h1>File Explorer</h1>

      <div class="tree-actions">
        <div class="action-group">
          <p class="action-heading">Actions</p>

          <button type="button" @click.stop="emit('create-folder')">
            + Folder
          </button>
        </div>

        <div class="action-group">
          <p class="action-heading">Move selected item</p>

          <label class="control-label" for="move-destination">
            Destination
          </label>

          <select
            id="move-destination"
            class="move-select"
            :value="props.moveDestinationValue"
            :disabled="props.selectedNodeId === null"
            @change.stop="handleMoveDestinationChange"
          >
            <option
              v-for="destination in props.moveDestinations"
              :key="destination.value"
              :value="destination.value"
              :disabled="destination.disabled"
            >
              {{ destination.label }}
            </option>
          </select>

          <button
            type="button"
            :disabled="!props.canMoveSelectedNode"
            @click.stop="emit('move-node')"
          >
            Confirm Move
          </button>
        </div>
      </div>
    </div>

    <p v-if="props.pending">Loading tree...</p>
    <p v-else-if="props.error">Could not load file tree.</p>

    <ul v-else class="tree-list">
      <li
        v-for="node in props.visibleDisplayNodes"
        :key="node.id"
        class="tree-row"
        :class="{ selected: node.id === props.selectedNodeId }"
        @click.stop="emit('select-node', node)"
      >
        <span class="tree-indent" aria-hidden="true">
          <span
            v-for="level in node.depth"
            :key="`${node.id}-guide-${level}`"
            class="tree-guide"
            :class="{ elbow: level === node.depth }"
          />
        </span>
        <button
          v-if="node.type === 'folder' && node.children.length > 0"
          type="button"
          class="collapse-toggle"
          :aria-label="props.isFolderCollapsed(node.id) ? `Expand ${node.name}` : `Collapse ${node.name}`"
          :aria-expanded="!props.isFolderCollapsed(node.id)"
          @click.stop="emit('toggle-folder', node)"
        >
          {{ props.isFolderCollapsed(node.id) ? '>' : 'v' }}
        </button>
        <span v-else class="collapse-spacer" aria-hidden="true" />
        <span v-if="node.type === 'folder'" class="node-icon" aria-hidden="true">
          &#128194;
        </span>
        <span v-else class="node-icon" aria-hidden="true">
          &#128196;
        </span>
        <span>{{ node.name }}</span>
      </li>
    </ul>
  </aside>
</template>

<style scoped>
.tree-panel {
  border-right: 1px solid #ddd;
  padding: 16px;
  background: #f8f9fb;
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

.collapse-toggle,
.collapse-spacer {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 18px;
  width: 18px;
  height: 18px;
}

.collapse-toggle {
  padding: 0;
  border: 0;
  background: transparent;
  color: #4b5563;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}

.collapse-toggle:hover {
  border-radius: 3px;
  background: #dbeafe;
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
  flex-direction: column;
  gap: 14px;
  width: 100%;
}

.action-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  width: 100%;
}

.action-heading {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  color: #4b5563;
}

.control-label {
  font-size: 12px;
  font-weight: 600;
  color: #4b5563;
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
  width: 100%;
  min-width: 0;
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
