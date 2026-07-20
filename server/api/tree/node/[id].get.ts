import { getNodeById } from '../../../utils/db'

/** Returns one complete node, including stored Markdown content. */
export default defineEventHandler((event) => {
  const nodeId = getRouterParam(event, 'id')

  if (!nodeId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Node id is required.'
    })
  }

  const node = getNodeById(nodeId)

  if (!node) {
    throw createError({
      statusCode: 404,
      statusMessage: `Node not found: ${nodeId}`
    })
  }

  return node
})
