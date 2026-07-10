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


const nodes = [
  {
    id: '300-product',
    type: 'folder',
    name: '300-product',
    parentId: null,
    filePath: null,
    sortOrder: 0
  },
  {
    id: '310-governance',
    type: 'folder',
    name: '310-governance',
    parentId: '310-product-a',
    filePath: null,
    sortOrder: 0
  },
  {
    id: '310-epic-a',
    type: 'folder',
    name: '310-epic-a',
    parentId: '310-product-a',
    filePath: null,
    sortOrder: 1
  },
  {
    id: '310-product-a',
    type: 'folder',
    name: '310-product-a',
    parentId: '300-product',
    filePath: null,
    sortOrder: 0
  },
  {
    id: '310-architecture',
    type: 'file',
    name: '310-ARCHITECTURE.md',
    parentId: '310-governance',
    filePath: 'files/310-ARCHITECTURE.md',
    sortOrder: 0
  }
]




function buildTree(nodes: ExplorerNode[]): TreeNode[]  {
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

    return roots
}

function formatTree(tree: TreeNode[]) {

  /*
  Format tree nodes as a textual directory tree.
  */

  function formatNode(node, prefix, isLast) {
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

function createFolder(nodes: ExplorerNode[], parentId: string, name: string) {

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

  const folder = {
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

function moveNode(nodes: ExplorerNode[], nodeId: string, newParentId: string) {
  
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

  // Return a new array with only the moved node changed.
  return nodes.map((node) => {
    if (node.id !== nodeId) {
      return node
    }

    return {
      ...node,
      parentId: newParentId
    }
  })
}

function isDescendant(nodes: ExplorerNode[], possibleDescendantId, ancestorId) {

  /*
  Checks whether the node `possibleDescendantId` is a descendant of `ancestorId`.

  For example: given this

  300-product/
    310-product-a/
      310-governance/

  isDescendant(nodes, '310-governance', '310-product-a') returns true
  isDescendant(nodes, '310-governance', '300-product') returns true
  */

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

function createUniqueId(nodes: ExplorerNode[], name) {

  /*
  Creates a unique identifier for a folder with name `name`.
  For now identifier has the form `name + suffix` or `folder + suffix`
  */ 

  const baseId = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  // provide a fallback value for baseId. If it is empty, name it as `folder`
  let candidateId = baseId || 'folder'
  let suffix = 2

  // Keep adding a suffix until the id does not collide with an existing node.
  while (nodes.some((node) => node.id === candidateId)) {
    candidateId = `${baseId || 'folder'}-${suffix}`
    suffix += 1
  }

  return candidateId

}

function printScenario(title: string, nodes: ExplorerNode[]) {
  console.log(`\n${title}`)
  console.log(formatTree(buildTree(nodes)))
}

let currentNodes = nodes
printScenario('Initial tree', currentNodes)

currentNodes = createFolder(currentNodes, null, 'scratch')
printScenario('After creating a root folder', currentNodes)

currentNodes = createFolder(currentNodes, '310-product-a', 'product-notes')
printScenario('After creating a folder under 310-product-a', currentNodes)

currentNodes = moveNode(currentNodes, '310-architecture', 'scratch')
printScenario('After moving 310-ARCHITECTURE.md into scratch', currentNodes)

currentNodes = moveNode(currentNodes, '310-architecture', null)
printScenario('After moving 310-ARCHITECTURE.md into root directory', currentNodes)
