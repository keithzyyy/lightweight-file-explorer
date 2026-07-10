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
function createFolderNode(id: string, name: string, parentId: string | null, sortOrder: number): ExplorerNode {
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
function getInitialParentId(fileName: string): string {
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
function createFileId(fileName: string): string {
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
function sortTreeNodes(tree: TreeNode[]) {
  tree.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))

  for (const node of tree) {
    sortTreeNodes(node.children)
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
    createFolderNode('300-product', '300-product', null, 0),

    // Product A lives inside the product root.
    createFolderNode('310-product-a', '310-product-a', '300-product', 0),

    // Deterministic folders from the spec's Initial File Organization rule.
    createFolderNode('310-governance', '310-governance', '310-product-a', 0),
    createFolderNode('311-epic-a', '311-epic-a', '310-product-a', 1),
    createFolderNode('312-epic-b', '312-epic-b', '310-product-a', 2)
  ]

  // 2. Track each file's order within its parent folder.
  const groupCounts = new Map<string, number>()

  for (const fileName of fileNames) {
    const parentId = getInitialParentId(fileName)
    const sortOrder = groupCounts.get(parentId) ?? 0

    nodes.push({
      id: createFileId(fileName),
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

  sortTreeNodes(roots)
  return roots
}
