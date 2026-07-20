import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type {
  NodeRow,
  TableColumnRow,
  TreeNode
} from '../../app/types/data'
import { seedDatabaseIfNeeded } from '../../scripts/db-seed'
import {
  collectSubtreeIds,
  createFolder,
  updateNode
} from './tree'

const DATABASE_PATH = 'data/file-explorer.sqlite'

let database: DatabaseSync | null = null
let databaseInitialized = false

function _getDatabase(): DatabaseSync {
  if (database !== null) {
    return database
  }

  mkdirSync(dirname(DATABASE_PATH), { recursive: true })
  database = new DatabaseSync(DATABASE_PATH)
  database.exec('PRAGMA foreign_keys = ON')

  return database
}

function _mapRowToTreeNode(row: NodeRow): TreeNode {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    parentId: row.parent_id,
    content: row.content,
    sortOrder: row.sort_order,
    children: []
  }
}

function _insertNode(node: TreeNode): void {
  _getDatabase().prepare(`
    INSERT INTO nodes (id, type, name, parent_id, content, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    node.id,
    node.type,
    node.name,
    node.parentId,
    node.content,
    node.sortOrder
  )
}

function _findNewNode(beforeNodes: TreeNode[], afterNodes: TreeNode[]): TreeNode {
  const beforeIds = new Set(beforeNodes.map((node) => node.id))
  const newNode = afterNodes.find((node) => !beforeIds.has(node.id))

  if (!newNode) {
    throw new Error('No new node was created')
  }

  return newNode
}

/** Creates the schema and migrates databases created before content storage. */
export function ensureDatabase(): void {
  const db = _getDatabase()

  db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('folder', 'file')),
      name TEXT NOT NULL,
      parent_id TEXT,
      content TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL,
      FOREIGN KEY (parent_id) REFERENCES nodes(id)
    );

    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  const columns = db.prepare('PRAGMA table_info(nodes)').all() as TableColumnRow[]

  if (!columns.some((column) => column.name === 'content')) {
    db.exec("ALTER TABLE nodes ADD COLUMN content TEXT NOT NULL DEFAULT ''")
  }
}

/** Initializes and seeds SQLite once per server process. */
export function initializeDatabase(): void {
  if (databaseInitialized) {
    return
  }

  ensureDatabase()
  seedDatabaseIfNeeded(_getDatabase())
  databaseInitialized = true
}

/** Loads flat nodes for tree operations without sending Markdown bodies. */
export function loadNodes(): TreeNode[] {
  initializeDatabase()

  const rows = _getDatabase().prepare(`
    SELECT id, type, name, parent_id, '' AS content, sort_order
    FROM nodes
    ORDER BY parent_id IS NOT NULL, parent_id, sort_order, name
  `).all() as NodeRow[]

  return rows.map(_mapRowToTreeNode)
}

/** Loads one complete node, including its SQLite-backed Markdown content. */
export function getNodeById(nodeId: string): TreeNode | null {
  initializeDatabase()

  const row = _getDatabase().prepare(`
    SELECT id, type, name, parent_id, content, sort_order
    FROM nodes
    WHERE id = ?
  `).get(nodeId) as NodeRow | undefined

  return row ? _mapRowToTreeNode(row) : null
}

/** Creates a folder under the requested parent and returns updated flat rows. */
export function insertFolder(parentId: string | null, name: string): TreeNode[] {
  const beforeNodes = loadNodes()
  const afterNodes = createFolder(beforeNodes, parentId, name)
  const folder = _findNewNode(beforeNodes, afterNodes)

  _insertNode(folder)
  return loadNodes()
}

/** Renames and/or moves one node, then returns updated flat rows. */
export function patchNode(
  nodeId: string,
  updates: { name?: string; parentId?: string | null }
): TreeNode[] {
  const beforeNodes = loadNodes()
  const afterNodes = updateNode(beforeNodes, nodeId, updates)
  const updatedNode = afterNodes.find((node) => node.id === nodeId)

  if (!updatedNode) {
    throw new Error(`Node not found after update: ${nodeId}`)
  }

  _getDatabase().prepare(`
    UPDATE nodes
    SET name = ?, parent_id = ?, sort_order = ?
    WHERE id = ?
  `).run(
    updatedNode.name,
    updatedNode.parentId,
    updatedNode.sortOrder,
    updatedNode.id
  )

  return loadNodes()
}

/** Deletes a node and all descendants, then returns updated flat rows. */
export function deleteNode(nodeId: string): TreeNode[] {
  const nodes = loadNodes()
  const subtreeIds = collectSubtreeIds(nodes, nodeId)
  const db = _getDatabase()
  const deleteStatement = db.prepare('DELETE FROM nodes WHERE id = ?')

  db.exec('BEGIN IMMEDIATE')

  try {
    for (const id of subtreeIds) {
      deleteStatement.run(id)
    }

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return loadNodes()
}
