import { deleteNode } from '../../../utils/db'
import { buildTreeDisplay } from '../../../utils/tree'

/** Deletes a node and its descendants. */
export default defineEventHandler((event) => {
  const nodeId = getRouterParam(event, 'id')

  if (!nodeId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Node id is required.'
    })
  }

  try {
    return buildTreeDisplay(deleteNode(nodeId))
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error instanceof Error ? error.message : 'Could not delete node.'
    })
  }
})
