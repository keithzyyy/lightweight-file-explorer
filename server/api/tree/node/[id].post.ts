import { ROOT_NODE_ID } from '../../../../app/types/data'
import type { CreateTreeNodeBody } from '../../../../app/types/data'
import { insertFolder } from '../../../utils/db'
import { buildTreeDisplay } from '../../../utils/tree'

/** Creates a folder under :id; __root__ creates it at the virtual root. */
export default defineEventHandler(async (event) => {
  const parentIdParam = getRouterParam(event, 'id')
  const body = await readBody<CreateTreeNodeBody>(event)

  if (!parentIdParam) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Parent id is required.'
    })
  }

  if (typeof body.name !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Folder name is required.'
    })
  }

  const parentId = parentIdParam === ROOT_NODE_ID ? null : parentIdParam

  try {
    return buildTreeDisplay(insertFolder(parentId, body.name))
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error instanceof Error ? error.message : 'Could not create folder.'
    })
  }
})
