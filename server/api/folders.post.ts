import { buildTree } from '../utils/tree'
import { insertFolder } from '../utils/node-store'

type CreateFolderBody = {
  parentId?: string | null
  name?: string
}

/**
 * POST /api/folders
 *
 * Creates a virtual folder, then returns the updated tree.
 *
 * For now this updates server memory. Later, insertFolder can be
 * replaced with a SQLite-backed insert operation.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<CreateFolderBody>(event)

  const name = body.name
  const parentId = body.parentId ?? null

  // Validate request shape before touching the store.
  if (typeof name !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Folder name is required.'
    })
  }

  try {
    const nodes = insertFolder(parentId, name)

    return buildTree(nodes)
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error instanceof Error ? error.message : 'Could not create folder.'
    })
  }
})