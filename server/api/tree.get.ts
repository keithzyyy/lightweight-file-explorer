import { buildTree } from '../utils/tree'
import { loadNodes } from '../utils/db'

/**
 * GET /api/tree
 *
 * Loads the current flat nodes from the SQLite database,
 * converts them into a nested tree, and returns that tree to the UI.
 */
export default defineEventHandler(() => {
  const nodes = loadNodes()

  return buildTree(nodes)
})