/*
NOTE: In JavaScript/TypeScript, a file must export a function before another file can import it.
*/


import { readdirSync } from 'node:fs'

export type ExplorerNode = {
  id: string
  type: 'folder' | 'file'
  name: string
  parentId: string | null
  filePath: string | null
  sortOrder: number // order they appear when several nodes have the same parent. 
}

export type TreeNode = ExplorerNode & {
  children: TreeNode[]
}


/**
 * Creates a folder ExplorerNode for the initial seeded structure.
 */
function _createFolderNode(id: string, name: string, parentId: string | null, sortOrder: number): ExplorerNode {
  return {
    id,
    type: 'folder',
    name,
    parentId,
    filePath: null,
    sortOrder
  }
}

/**
 * Applies the deterministic grouping rule from the spec.
 */
function _getInitialParentId(fileName: string): string {
  // Governance files are the 310 architecture/specification documents.
  if (fileName === '310-ARCHITECTURE.md' || fileName.startsWith('310-gov-')) {
    return '310-governance'
  }

  // 311 files are grouped under Epic A.
  if (fileName.startsWith('311-')) {
    return '311-epic-a'
  }

  // 312 files are grouped under Epic B.
  if (fileName.startsWith('312-')) {
    return '312-epic-b'
  }

  // Stage 2 should make unexpected filenames obvious while prototyping.
  throw new Error(`No initial organization rule for file: ${fileName}`)
}

/**
 * Converts a Markdown filename into a stable id.
 */
function _createFileId(fileName: string): string {
  return fileName
    .replace(/\.md$/i, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Sorts each sibling group so tree rendering is deterministic.
 */
function _sortTreeNodes(tree: TreeNode[]) {
  tree.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))

  for (const node of tree) {
    _sortTreeNodes(node.children)
  }
}

/**
 * Reads the real Markdown filenames from the provided files/ directory.
 *
 * Stage 3 differs from Stage 2 only at the input boundary: instead of using a
 * hardcoded filename list, it discovers the actual .md files on disk.
 */
export function readMarkdownFileNames(directoryPath: string): string[] {
  return readdirSync(directoryPath)
    // Keep only Markdown files; other files in files/ should not become file nodes.
    .filter((fileName) => fileName.toLowerCase().endsWith('.md'))
    // Sort so Stage 3 produces deterministic output regardless of filesystem order.
    .sort((a, b) => a.localeCompare(b))
}

/**
 * Converts the given flat Markdown filenames into flat ExplorerNode rows.
 *
 * Stage 2 keeps the filenames hardcoded, but this function is shaped like
 * the later Stage 3/4 organizer that will receive real filenames from files/.
 */
export function organizeInitialFiles(fileNames: string[]): ExplorerNode[] {

  // 1. Deterministic folder creation procedure.
  const nodes: ExplorerNode[] = [
    // Root folder for the virtual explorer.
    _createFolderNode('300-product', '300-product', null, 0),

    // Product A lives inside the product root.
    _createFolderNode('310-product-a', '310-product-a', '300-product', 0),

    // Deterministic folders from the spec's Initial File Organization rule.
    _createFolderNode('310-governance', '310-governance', '310-product-a', 0),
    _createFolderNode('311-epic-a', '311-epic-a', '310-product-a', 1),
    _createFolderNode('312-epic-b', '312-epic-b', '310-product-a', 2)
  ]

  // 2. Track each file's order within its parent folder.
  const groupCounts = new Map<string, number>()

  for (const fileName of fileNames) {
    const parentId = _getInitialParentId(fileName)
    const sortOrder = groupCounts.get(parentId) ?? 0

    nodes.push({
      id: _createFileId(fileName),
      type: 'file',
      name: fileName,
      parentId,
      filePath: `files/${fileName}`,
      sortOrder
    })

    // The next file in the same folder should come after this one.
    groupCounts.set(parentId, sortOrder + 1)
  }

  return nodes
}

/**
 * Creates a folder id from a display name and avoids collisions.
 */
function _createUniqueId(nodes: ExplorerNode[], name: string) {
  const baseId = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  let candidateId = baseId || 'folder'
  let suffix = 2

  // Keep adding a suffix until the id does not collide with an existing node.
  while (nodes.some((node) => node.id === candidateId)) {
    candidateId = `${baseId || 'folder'}-${suffix}`
    suffix += 1
  }

  return candidateId
}

/**
 * Checks whether possibleDescendantId is inside ancestorId's subtree.
 */
function _isDescendant(nodes: ExplorerNode[], possibleDescendantId: string | null, ancestorId: string) {
  let currentId = possibleDescendantId

  // Walk upward from possibleDescendantId through parent links.
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

export function buildTree(nodes: ExplorerNode[]): TreeNode[] {
  /*
  Builds a directory tree (or forest, if there are multiple
  objects in the root directory) from a set of flat
  nodes with known parent relationships.
  */

  const nodeById = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  // Pass 1: create a 'tree node' for each node
  // tree node = cloned node with its own children array.
  for (const node of nodes) {
    const treeNode: TreeNode = {
      ...node,
      children: []
    }

    nodeById.set(node.id, treeNode)
  }

  // Pass 2: attach each tree node to its parent, or to roots if parentId is null.
  for (const node of nodes) {
    const treeNode = nodeById.get(node.id)

    if (!treeNode) {
      throw new Error(`Tree node was not created for: ${node.id}`)
    }

    if (node.parentId === null) {
      roots.push(treeNode)
    } else {
      const parent = nodeById.get(node.parentId)

      if (!parent) {
        throw new Error(`Parent not found for ${node.id}: ${node.parentId}`)
      }

      parent.children.push(treeNode)
    }
  }

  _sortTreeNodes(roots)
  return roots
}

export function createFolder(
  nodes: ExplorerNode[],
  parentId: string | null,
  name: string
): ExplorerNode[] {
  /*
  Returns updated flat rows with a new folder node.
  */

  // Folder names should contain visible text.
  if (name.trim() === '') {
    throw new Error('Folder name cannot be empty')
  }

  // parentId can be null, which means "create this folder at the virtual root".
  if (parentId !== null) {
    const parent = nodes.find((node) => node.id === parentId)

    if (!parent) {
      throw new Error(`Parent not found: ${parentId}`)
    }

    // A file cannot contain children, so it cannot be a folder's parent.
    if (parent.type !== 'folder') {
      throw new Error(`Parent must be a folder: ${parentId}`)
    }
  }

  const siblingCount = nodes.filter((node) => node.parentId === parentId).length
  const id = _createUniqueId(nodes, name)

  const folder: ExplorerNode = {
    id,
    type: 'folder',
    name,
    parentId,
    filePath: null,
    sortOrder: siblingCount
  }

  // Return a new array so the old array remains available for comparison.
  return [...nodes, folder]
}

export function moveNode(nodes: ExplorerNode[], nodeId: string, newParentId: string | null): ExplorerNode[] {
  /*
  Returns updated flat rows with one changed parent relationship.
  */

  const nodeToMove = nodes.find((node) => node.id === nodeId)

  if (!nodeToMove) {
    throw new Error(`Node not found: ${nodeId}`)
  }

  // newParentId can be null, which means "move this node to the virtual root".
  if (newParentId !== null) {
    const newParent = nodes.find((node) => node.id === newParentId)

    if (!newParent) {
      throw new Error(`New parent not found: ${newParentId}`)
    }

    // Files cannot contain children, so they cannot be move destinations.
    if (newParent.type !== 'folder') {
      throw new Error(`New parent must be a folder: ${newParentId}`)
    }
  }

  if (nodeId === newParentId) {
    throw new Error('A node cannot be moved into itself')
  }

  // Prevent making a folder a child of one of its own descendants.
  if (nodeToMove.type === 'folder' && _isDescendant(nodes, newParentId, nodeId)) {
    throw new Error('A folder cannot be moved into one of its descendants')
  }

  const newSiblingCount = nodes.filter((node) => node.parentId === newParentId && node.id !== nodeId).length

  // Return a new array with only the moved node changed.
  return nodes.map((node) => {
    if (node.id !== nodeId) {
      return node
    }

    return {
      ...node,
      parentId: newParentId,
      sortOrder: newSiblingCount
    }
  })
}
