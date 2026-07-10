import { readdirSync } from 'node:fs'

type ExplorerNode = {
  id: string
  type: 'folder' | 'file'
  name: string
  parentId: string | null
  filePath: string | null
  sortOrder: number // order they appear when several nodes have the same parent. 
}

type TreeNode = ExplorerNode & {
  children: TreeNode[]
}

/**
 * Reads the real Markdown filenames from the provided files/ directory.
 *
 * Stage 3 differs from Stage 2 only at the input boundary: instead of using a
 * hardcoded filename list, it discovers the actual .md files on disk.
 */
function readMarkdownFileNames(directoryPath: string): string[] {
  return readdirSync(directoryPath)
    // Keep only Markdown files; other files in files/ should not become file nodes.
    .filter((fileName) => fileName.toLowerCase().endsWith('.md'))
    // Sort so Stage 3 produces deterministic output regardless of filesystem order.
    .sort((a, b) => a.localeCompare(b))
}

const markdownFileNames = readMarkdownFileNames('files')

/**
 * Converts the given flat Markdown filenames into flat ExplorerNode rows.
 *
 * Stage 2 keeps the filenames hardcoded, but this function is shaped like
 * the later Stage 3/4 organizer that will receive real filenames from files/.
 */
function organizeInitialFiles(fileNames: string[]): ExplorerNode[] {

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

function buildTree(nodes: ExplorerNode[]): TreeNode[] {
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

/**
 * Sorts each sibling group so tree rendering is deterministic.
 */
function sortTreeNodes(tree: TreeNode[]) {
  tree.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))

  for (const node of tree) {
    sortTreeNodes(node.children)
  }
}

function formatTree(tree: TreeNode[]) {
  /*
  Format tree nodes as a textual directory tree.
  */

  function formatNode(node: TreeNode, prefix: string, isLast: boolean) {
    // ASCII connectors avoid terminal encoding issues while prototyping.
    const connector = isLast ? '`-- ' : '|-- '
    const line = `${prefix}${connector}${node.name}`
    const childPrefix = prefix + (isLast ? '    ' : '|   ')

    const childLines = node.children.map((child, index) => {
      const childIsLast = index === node.children.length - 1
      return formatNode(child, childPrefix, childIsLast)
    })

    return [line, ...childLines].join('\n')
  }

  return tree
    .map((node, index) => formatNode(node, '', index === tree.length - 1))
    .join('\n')
}

function createFolder(nodes: ExplorerNode[], parentId: string | null, name: string): ExplorerNode[] {
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
  const id = createUniqueId(nodes, name)

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

function moveNode(nodes: ExplorerNode[], nodeId: string, newParentId: string | null): ExplorerNode[] {
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
  if (nodeToMove.type === 'folder' && isDescendant(nodes, newParentId, nodeId)) {
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

/**
 * Checks whether possibleDescendantId is inside ancestorId's subtree.
 */
function isDescendant(nodes: ExplorerNode[], possibleDescendantId: string | null, ancestorId: string) {
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

/**
 * Creates a folder id from a display name and avoids collisions.
 */
function createUniqueId(nodes: ExplorerNode[], name: string) {
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
 * Prints one scenario so Stage 2 can be run repeatedly from the terminal.
 */
function printScenario(title: string, nodes: ExplorerNode[]) {
  console.log(`\n${title}`)
  console.log(formatTree(buildTree(nodes)))
}

let currentNodes = organizeInitialFiles(markdownFileNames)

printScenario('Initial organized files', currentNodes)

currentNodes = createFolder(currentNodes, '310-product-a', 'research-notes')
printScenario('After creating research-notes under 310-product-a', currentNodes)

currentNodes = moveNode(currentNodes, '310-architecture', 'research-notes')
printScenario('After moving 310-ARCHITECTURE.md into research-notes', currentNodes)
