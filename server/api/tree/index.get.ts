import { loadNodes } from '../../utils/db'
import { buildTreeDisplay } from '../../utils/tree'

/** Initializes SQLite if needed and returns flattened display rows. */
export default defineEventHandler(() => {
  return buildTreeDisplay(loadNodes())
})
