import { buildTree } from '../utils/tree'
import { updateNodeParent } from '../utils/db'

type MoveNodeBody = {
  nodeId?: string
  newParentId?: string | null
}

/**
 * POST /api/move
 *
 * Moves a file/folder, then returns the updated tree.
 *
 * For now this updates server memory through updateNodeParent().
 * Later, updateNodeParent can be replaced with a SQLite-backed UPDATE
 * operation without changing this API shape.
 */
export default defineEventHandler(async (event) => {

  // Read the node-to-move and destination parent from the request body.
  const body = await readBody<MoveNodeBody>(event)

  const nodeId = body.nodeId
  const newParentId = body.newParentId ?? null

  // Validate request shape before touching the store.
  // Deeper explorer rules live in updateNodeParent()/moveNode().
  if (typeof nodeId !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'nodeId is required.'
    })
  }

  if (
    body.newParentId !== undefined &&
    body.newParentId !== null &&
    typeof body.newParentId !== 'string'
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'newParentId must be a string or null.'
    })
  }

  try {
    const nodes = updateNodeParent(nodeId, newParentId)

    return buildTree(nodes)
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error instanceof Error ? error.message : 'Could not move file/folder.'
    })
  }
})
