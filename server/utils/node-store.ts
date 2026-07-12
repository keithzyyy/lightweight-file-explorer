import {
  type ExplorerNode,
  createFolder,
  moveNode,
  organizeInitialFiles,
  readMarkdownFileNames
} from './tree'

let nodes: ExplorerNode[] | null = null

/**
 * Initializes the in-memory node store once.
 *
 * This is acting like a temporary database table:
 * - first request seeds nodes from files/
 * - later requests reuse the same array
 * - server restart resets everything
 */
function _ensureNodesInitialized(): void {

  if (nodes !== null) {
    return
  }

  const fileNames = readMarkdownFileNames('files')
  nodes = organizeInitialFiles(fileNames)
}

/**
 * Returns a copy of the current flat ExplorerNode rows.
 *
 * Returning copies prevents callers from accidentally mutating
 * the store directly.
 */
export function loadNodes(): ExplorerNode[] {
  _ensureNodesInitialized()

  return nodes!.map((node) => ({ ...node }))
}

/**
 * Creates a folder in the in-memory store, mimicking a INSERT INTO
 * operation into the SQLite database.
 *
 * parentId = null means create at the virtual root.
 * parentId must point to an existing folder if provided.
 */
export function insertFolder(
  parentId: string | null,
  name: string
): ExplorerNode[] {
  _ensureNodesInitialized()

  // Delegate validation and array transformation to the pure tree operation.
  // This keeps business rules in one place while this module owns storage state.
  nodes = createFolder(nodes!, parentId, name)

  return loadNodes()
}

/**
 * Moves a node in the in-memory store, mimicking an UPDATE nodes
 * operation in the future SQLite database.
 *
 * newParentId = null means move the node to the virtual root.
 * newParentId must point to an existing folder if provided.
 */
export function updateNodeParent(
  nodeId: string,
  newParentId: string | null
): ExplorerNode[] {
  _ensureNodesInitialized()

  // Delegate move validation, including descendant checks, to the pure operation.
  nodes = moveNode(nodes!, nodeId, newParentId)

  return loadNodes()
}
