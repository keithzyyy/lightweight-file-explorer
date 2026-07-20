export type NodeType = 'folder' | 'file'

export const ROOT_NODE_ID = '__root__'

export type TreeNode = {
  id: string
  type: NodeType
  name: string
  parentId: string | null
  content: string
  sortOrder: number
  children: TreeNode[]
}

export type Tree = TreeNode & {
  depth: number
  ancestorIds: string[]
}

export type MoveDestination = {
  value: string
  parentId: string | null
  label: string
  disabled: boolean
}

export type CreateTreeNodeBody = {
  name?: string
}

export type PatchTreeNodeBody = {
  name?: string
  parentId?: string | null
}

export type NodeRow = {
  id: string
  type: NodeType
  name: string
  parent_id: string | null
  content: string
  sort_order: number
}

export type CountRow = {
  node_count: number
}

export type TableColumnRow = {
  name: string
}
