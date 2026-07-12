import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import {
  type ExplorerNode,
  createFolder,
  moveNode,
  organizeInitialFiles,
  readMarkdownFileNames
} from './tree'

const DATABASE_PATH = 'data/file-explorer.sqlite'

let database: DatabaseSync | null = null

type NodeRow = {
  id: string
  type: 'folder' | 'file'
  name: string
  parent_id: string | null
  file_path: string | null
  sort_order: number
}

type CountRow = {
  node_count: number
}

/**
 * Returns the shared SQLite connection for this server process.
 *
 * Opening the database is separated from creating tables so the public
 * ensureDatabase() function can make the setup step explicit.
 */
function _getDatabase(): DatabaseSync {
  if (database !== null) {
    return database
  }

  // data/ is gitignored, so the app can create local persistence safely.
  mkdirSync(dirname(DATABASE_PATH), { recursive: true })

  database = new DatabaseSync(DATABASE_PATH)

  // Keep parent_id constraints active for this connection.
  database.exec('PRAGMA foreign_keys = ON')

  return database
}

/**
 * Converts a SQLite row shape into the app's ExplorerNode shape.
 *
 * SQLite uses snake_case column names. The rest of the app uses camelCase
 * fields so tree logic and UI code do not need to know about SQL naming.
 */
function _mapRowToExplorerNode(row: NodeRow): ExplorerNode {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    parentId: row.parent_id,
    filePath: row.file_path,
    sortOrder: row.sort_order
  }
}

/**
 * Inserts one ExplorerNode row into SQLite.
 *
 * This helper is used both for initial seeding and for inserting one new
 * folder after createFolder(...) has produced the validated node.
 */
function _insertNode(node: ExplorerNode): void {
  const db = _getDatabase()

  db.prepare(`
    INSERT INTO nodes (id, type, name, parent_id, file_path, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    node.id,
    node.type,
    node.name,
    node.parentId,
    node.filePath,
    node.sortOrder
  )
}

/**
 * Finds the node that exists after a pure operation but not before it.
 *
 * createFolder(...) returns a full updated ExplorerNode[] array. SQLite only
 * needs to insert the one new folder row, so this helper identifies it.
 */
function _findNewNode(beforeNodes: ExplorerNode[], afterNodes: ExplorerNode[]): ExplorerNode {
  const beforeIds = new Set(beforeNodes.map((node) => node.id))
  const newNode = afterNodes.find((node) => !beforeIds.has(node.id))

  if (!newNode) {
    throw new Error('No new node was created')
  }

  return newNode
}

/**
 * Creates the SQLite database file and nodes table if they do not exist.
 *
 * This function is safe to call repeatedly.
 */
export function ensureDatabase(): void {
  const db = _getDatabase()

  db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('folder', 'file')),
      name TEXT NOT NULL,
      parent_id TEXT,
      file_path TEXT,
      sort_order INTEGER NOT NULL,
      FOREIGN KEY (parent_id) REFERENCES nodes(id)
    )
  `)
}

/**
 * Seeds the database from files/ only when the nodes table is empty.
 *
 * After the first seed, SQLite is the source of truth. This prevents app
 * restarts from overwriting user-created folders or moved nodes.
 */
export function seedDatabaseIfEmpty(): void {
  ensureDatabase()

  const db = _getDatabase()
  const row = db.prepare(`
    SELECT COUNT(*) AS node_count
    FROM nodes
  `).get() as CountRow

  if (row.node_count > 0) {
    return
  }

  const fileNames = readMarkdownFileNames('files')
  const initialNodes = organizeInitialFiles(fileNames)

  for (const node of initialNodes) {
    _insertNode(node)
  }
}

/**
 * Loads flat ExplorerNode rows from SQLite.
 *
 * This is the database-backed equivalent of node-store.ts loadNodes().
 */
export function loadNodes(): ExplorerNode[] {
  seedDatabaseIfEmpty()

  const db = _getDatabase()
  const rows = db.prepare(`
    SELECT id, type, name, parent_id, file_path, sort_order
    FROM nodes
    ORDER BY parent_id IS NOT NULL, parent_id, sort_order, name
  `).all() as NodeRow[]

  return rows.map(_mapRowToExplorerNode)
}

/**
 * Creates one folder in SQLite, then returns the updated flat rows.
 *
 * The pure createFolder(...) function still owns validation, id generation,
 * and sort_order assignment. This function only persists the resulting row.
 */
export function insertFolder(
  parentId: string | null,
  name: string
): ExplorerNode[] {
  const beforeNodes = loadNodes()
  const afterNodes = createFolder(beforeNodes, parentId, name)
  const folder = _findNewNode(beforeNodes, afterNodes)

  _insertNode(folder)

  return loadNodes()
}

/**
 * Moves one file/folder in SQLite, then returns the updated flat rows.
 *
 * The pure moveNode(...) function still owns validation, including preventing
 * a folder from being moved into itself or one of its descendants.
 */
export function updateNodeParent(
  nodeId: string,
  newParentId: string | null
): ExplorerNode[] {
  const beforeNodes = loadNodes()
  const afterNodes = moveNode(beforeNodes, nodeId, newParentId)
  const movedNode = afterNodes.find((node) => node.id === nodeId)

  if (!movedNode) {
    throw new Error(`Node not found after move: ${nodeId}`)
  }

  const db = _getDatabase()

  db.prepare(`
    UPDATE nodes
    SET parent_id = ?, sort_order = ?
    WHERE id = ?
  `).run(movedNode.parentId, movedNode.sortOrder, movedNode.id)

  return loadNodes()
}
