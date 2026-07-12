import { readFileSync } from 'node:fs'
import { loadNodes } from '../utils/db'

/**
 * GET /api/markdown?fileId=<node-id>
 *
 * Reads the Markdown content for a selected file node.
 *
 * The browser sends a virtual file node id, not a filesystem path. The server
 * then looks up that node and reads the filePath stored in the explorer model.
 * This keeps file access tied to the app's virtual file tree.
 */
export default defineEventHandler((event) => {

  // Query params come from the URL, e.g. /api/markdown?fileId=310-architecture
  const query = getQuery(event)
  const fileId = query.fileId

  // Validate request shape before touching the node store.
  if (typeof fileId !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'fileId is required.'
    })
  }

  const nodes = loadNodes()

  // Look up the virtual node first. The client should not send real file paths.
  const fileNode = nodes.find((node) => node.id === fileId)

  if (!fileNode) {
    throw createError({
      statusCode: 404,
      statusMessage: `File node not found: ${fileId}`
    })
  }

  // Folders cannot be previewed as Markdown files.
  if (fileNode.type !== 'file') {
    throw createError({
      statusCode: 400,
      statusMessage: `Node is not a file: ${fileId}`
    })
  }

  if (fileNode.filePath === null) {
    throw createError({
      statusCode: 500,
      statusMessage: `File node has no filePath: ${fileId}`
    })
  }

  try {
    // Read the real Markdown file referenced by the virtual file node.
    const content = readFileSync(fileNode.filePath, 'utf8')

    return {
      id: fileNode.id,
      name: fileNode.name,
      content
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Could not read Markdown file.'
    })
  }
})
