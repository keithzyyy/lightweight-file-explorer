import {
  buildTree,
  organizeInitialFiles,
  readMarkdownFileNames
} from '../utils/tree'


/*
defineEventHandler is a compiler utility helper provided by
Nitro, the high-performance server engine that powers Nuxt 3.

In Nuxt, any file placed inside the server/api/ or server/routes/ directory automatically
becomes a backend API endpoint.
- tree.get.ts automatically creates a route called `/api/tree` and only responds to GET requests

When a user or a frontend component fetches data from the rout
matching this file, Nuxt executes your code on the server like
this:
1. defineEventHandler wraps your logic: It standardises incoming network requests and
outgoing server responses.
2. Synchronous or Asynchronous Processing: It reads your local markdown file names,
organizes them, and constructs a tree architecture.
3. Automatic Serialization: Whatever data structures your functions (buildTree(nodes))
return are automatically converted into a JSON response by Nuxt.

*/

export default defineEventHandler(() => {
  const fileNames = readMarkdownFileNames('files')
  const nodes = organizeInitialFiles(fileNames)

  return buildTree(nodes)
})
