import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import type { CountRow } from '../app/types/data'

type SeedNode = {
  id: string
  type: 'folder' | 'file'
  name: string
  parentId: string | null
  content: string
  sortOrder: number
}

type StoredFileRow = {
  id: string
  name: string
}

type MetadataRow = {
  value: string
}

const FILES_DIRECTORY = join(process.cwd(), 'files')

const FOLDERS: SeedNode[] = [
  { id: '300-product', type: 'folder', name: '300-product', parentId: null, content: '', sortOrder: 0 },
  { id: '310-product-a', type: 'folder', name: '310-product-a', parentId: '300-product', content: '', sortOrder: 0 },
  { id: '310-governance', type: 'folder', name: '310-governance', parentId: '310-product-a', content: '', sortOrder: 0 },
  { id: '311-epic-a', type: 'folder', name: '311-epic-a', parentId: '310-product-a', content: '', sortOrder: 1 },
  { id: '312-epic-b', type: 'folder', name: '312-epic-b', parentId: '310-product-a', content: '', sortOrder: 2 }
]

const FILE_LAYOUT = [
  { name: '310-ARCHITECTURE.md', parentId: '310-governance', sortOrder: 0 },
  { name: '310-gov-high-level-spec.md', parentId: '310-governance', sortOrder: 1 },
  { name: '311-100-epic-epic-a.md', parentId: '311-epic-a', sortOrder: 0 },
  { name: '311-110-feature-feature-a.md', parentId: '311-epic-a', sortOrder: 1 },
  { name: '311-111-story-story-a.md', parentId: '311-epic-a', sortOrder: 2 },
  { name: '311-112-story-story-b.md', parentId: '311-epic-a', sortOrder: 3 },
  { name: '312-100-epic-epic-b.md', parentId: '312-epic-b', sortOrder: 0 },
  { name: '312-110-feature-feature-a.md', parentId: '312-epic-b', sortOrder: 1 },
  { name: '312-111-story-story-a.md', parentId: '312-epic-b', sortOrder: 2 },
  { name: '312-120-feature-feature-b.md', parentId: '312-epic-b', sortOrder: 3 }
]

function _createFileId(fileName: string): string {
  return fileName
    .replace(/\.md$/i, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function _readMarkdown(fileName: string): string {
  return readFileSync(join(FILES_DIRECTORY, fileName), 'utf8')
}

function _createSeedNodes(): SeedNode[] {
  const files = FILE_LAYOUT.map(({ name, parentId, sortOrder }): SeedNode => ({
    id: _createFileId(name),
    type: 'file',
    name,
    parentId,
    content: _readMarkdown(name),
    sortOrder
  }))

  return [...FOLDERS, ...files]
}

/**
 * Backfills content when opening a database created by the previous filePath
 * schema. This is a one-time compatibility step; previews use SQLite after it.
 */
function _backfillMissingContent(database: DatabaseSync): void {
  const files = database.prepare(`
    SELECT id, name
    FROM nodes
    WHERE type = 'file' AND content = ''
  `).all() as StoredFileRow[]

  const updateContent = database.prepare(`
    UPDATE nodes
    SET content = ?
    WHERE id = ?
  `)

  for (const file of files) {
    updateContent.run(_readMarkdown(file.name), file.id)
  }
}

/** Seeds the required hierarchy once, after the nodes table has been created. */
export function seedDatabaseIfNeeded(database: DatabaseSync): void {
  const seedRecord = database.prepare(`
    SELECT value
    FROM app_metadata
    WHERE key = 'initial_seed_completed'
  `).get() as MetadataRow | undefined

  if (seedRecord?.value === 'true') {
    return
  }

  const row = database.prepare(`
    SELECT COUNT(*) AS node_count
    FROM nodes
  `).get() as CountRow

  if (row.node_count > 0) {
    _backfillMissingContent(database)
    database.prepare(`
      INSERT OR REPLACE INTO app_metadata (key, value)
      VALUES ('initial_seed_completed', 'true')
    `).run()
    return
  }

  const insertNode = database.prepare(`
    INSERT INTO nodes (id, type, name, parent_id, content, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  database.exec('BEGIN IMMEDIATE')

  try {
    for (const node of _createSeedNodes()) {
      insertNode.run(
        node.id,
        node.type,
        node.name,
        node.parentId,
        node.content,
        node.sortOrder
      )
    }

    database.prepare(`
      INSERT INTO app_metadata (key, value)
      VALUES ('initial_seed_completed', 'true')
    `).run()

    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
}
