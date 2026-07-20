import type { Tree, TreeNode } from '../../app/types/data'

type TreeNodeUpdates = {
  name?: string
  parentId?: string | null
}

/** Sorts every sibling group deterministically. */
function _sortTreeNodes(nodes: TreeNode[]): void {
  nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))

  for (const node of nodes) {
    _sortTreeNodes(node.children)
  }
}

/** Creates a stable, collision-free id from a folder name. */
function _createUniqueId(nodes: TreeNode[], name: string): string {
  const baseId = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  let candidateId = baseId || 'folder'
  let suffix = 2

  while (nodes.some((node) => node.id === candidateId)) {
    candidateId = `${baseId || 'folder'}-${suffix}`
    suffix += 1
  }

  return candidateId
}

/** Returns whether an id is inside an ancestor node's subtree. */
function _isDescendant(
  nodes: TreeNode[],
  possibleDescendantId: string | null,
  ancestorId: string
): boolean {
  let currentId = possibleDescendantId

  while (currentId !== null) {
    if (currentId === ancestorId) {
      return true
    }

    const currentNode = nodes.find((node) => node.id === currentId)

    if (!currentNode) {
      return false
    }

    currentId = currentNode.parentId
  }

  return false
}

/** Validates a requested parent and prevents cyclic folder moves. */
function _validateParent(
  nodes: TreeNode[],
  node: TreeNode | null,
  parentId: string | null
): void {
  if (parentId === null) {
    return
  }

  const parent = nodes.find((candidate) => candidate.id === parentId)

  if (!parent) {
    throw new Error(`Parent not found: ${parentId}`)
  }

  if (parent.type !== 'folder') {
    throw new Error(`Parent must be a folder: ${parentId}`)
  }

  if (node?.id === parentId) {
    throw new Error('A node cannot be moved into itself')
  }

  if (node?.type === 'folder' && _isDescendant(nodes, parentId, node.id)) {
    throw new Error('A folder cannot be moved into one of its descendants')
  }
}

/** Converts flat parent-id rows into a nested tree. */
export function buildTree(nodes: TreeNode[]): TreeNode[] {
  const nodeById = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  for (const node of nodes) {
    nodeById.set(node.id, { ...node, children: [] })
  }

  for (const node of nodes) {
    const treeNode = nodeById.get(node.id)

    if (!treeNode) {
      throw new Error(`Tree node was not created for: ${node.id}`)
    }

    if (node.parentId === null) {
      roots.push(treeNode)
      continue
    }

    const parent = nodeById.get(node.parentId)

    if (!parent) {
      throw new Error(`Parent not found for ${node.id}: ${node.parentId}`)
    }

    parent.children.push(treeNode)
  }

  _sortTreeNodes(roots)
  return roots
}

/** Flattens a nested tree into display rows with depth and ancestry metadata. */
export function flattenTree(
  nodes: TreeNode[],
  depth = 0,
  ancestorIds: string[] = []
): Tree[] {
  return nodes.flatMap((node) => {
    const displayNode: Tree = { ...node, depth, ancestorIds }

    return [
      displayNode,
      ...flattenTree(node.children, depth + 1, [...ancestorIds, node.id])
    ]
  })
}

/** Builds the display representation returned by the tree API. */
export function buildTreeDisplay(nodes: TreeNode[]): Tree[] {
  return flattenTree(buildTree(nodes))
}

/** Returns updated flat rows with a newly created folder. */
export function createFolder(
  nodes: TreeNode[],
  parentId: string | null,
  name: string
): TreeNode[] {
  const trimmedName = name.trim()

  if (trimmedName === '') {
    throw new Error('Folder name cannot be empty')
  }

  _validateParent(nodes, null, parentId)

  const siblingCount = nodes.filter((node) => node.parentId === parentId).length
  const folder: TreeNode = {
    id: _createUniqueId(nodes, trimmedName),
    type: 'folder',
    name: trimmedName,
    parentId,
    content: '',
    sortOrder: siblingCount,
    children: []
  }

  return [...nodes, folder]
}

/** Returns updated flat rows after renaming and/or moving one node. */
export function updateNode(
  nodes: TreeNode[],
  nodeId: string,
  updates: TreeNodeUpdates
): TreeNode[] {
  const nodeToUpdate = nodes.find((node) => node.id === nodeId)

  if (!nodeToUpdate) {
    throw new Error(`Node not found: ${nodeId}`)
  }

  let nextName = nodeToUpdate.name

  if (updates.name !== undefined) {
    nextName = updates.name.trim()

    if (nextName === '') {
      throw new Error('Node name cannot be empty')
    }
  }

  const parentWillChange = updates.parentId !== undefined
  const nextParentId = updates.parentId === undefined
    ? nodeToUpdate.parentId
    : updates.parentId

  if (parentWillChange) {
    _validateParent(nodes, nodeToUpdate, nextParentId)
  }

  const nextSortOrder = parentWillChange && nextParentId !== nodeToUpdate.parentId
    ? nodes.filter((node) => node.parentId === nextParentId && node.id !== nodeId).length
    : nodeToUpdate.sortOrder

  return nodes.map((node) => {
    if (node.id !== nodeId) {
      return node
    }

    return {
      ...node,
      name: nextName,
      parentId: nextParentId,
      sortOrder: nextSortOrder
    }
  })
}

/** Returns subtree ids in child-first order for foreign-key-safe deletion. */
export function collectSubtreeIds(nodes: TreeNode[], nodeId: string): string[] {
  if (!nodes.some((node) => node.id === nodeId)) {
    throw new Error(`Node not found: ${nodeId}`)
  }

  const childIdsByParent = new Map<string, string[]>()

  for (const node of nodes) {
    if (node.parentId === null) {
      continue
    }

    const childIds = childIdsByParent.get(node.parentId) ?? []
    childIds.push(node.id)
    childIdsByParent.set(node.parentId, childIds)
  }

  const subtreeIds: string[] = []

  function visit(currentId: string): void {
    for (const childId of childIdsByParent.get(currentId) ?? []) {
      visit(childId)
    }

    subtreeIds.push(currentId)
  }

  visit(nodeId)
  return subtreeIds
}
