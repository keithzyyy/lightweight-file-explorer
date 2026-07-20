import type { PatchTreeNodeBody } from '../../../../app/types/data'
import { patchNode } from '../../../utils/db'
import { buildTreeDisplay } from '../../../utils/tree'

/** Renames and/or moves a node. */
export default defineEventHandler(async (event) => {
  const nodeId = getRouterParam(event, 'id')
  const body = await readBody<PatchTreeNodeBody>(event)

  if (!nodeId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Node id is required.'
    })
  }

  const hasName = Object.hasOwn(body, 'name')
  const hasParentId = Object.hasOwn(body, 'parentId')

  if (!hasName && !hasParentId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Provide name and/or parentId to update.'
    })
  }

  if (hasName && typeof body.name !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'name must be a string.'
    })
  }

  if (
    hasParentId &&
    body.parentId !== null &&
    typeof body.parentId !== 'string'
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'parentId must be a string or null.'
    })
  }

  const updates: PatchTreeNodeBody = {}

  if (typeof body.name === 'string') {
    updates.name = body.name
  }

  if (hasParentId) {
    updates.parentId = body.parentId ?? null
  }

  try {
    return buildTreeDisplay(patchNode(nodeId, updates))
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error instanceof Error ? error.message : 'Could not update node.'
    })
  }
})
