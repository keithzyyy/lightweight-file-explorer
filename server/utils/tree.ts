console.log("----Hi, trying out JavaScript/TypeScript for first time----")

const nodes = [
{ id: '300-product',
    type: 'folder',
    name: '300-product',
    parentId: null },

{ id: '310-governance',
    type: 'folder',
    name: '310-governance',
    parentId: '310-product-a'},

{ id: '310-product-a',
    type: 'folder',
    name: '310-product-a',
    parentId: '300-product' },
{ id: '310-architecture',
    type: 'file',
    name: '310-ARCHITECTURE.md',
    parentId: '310-governance',
    filePath: 'files/310-ARCHITECTURE.md' },

]

console.log(nodes) // print the array of Objects/JSON
console.log("------")
console.log(nodes[0]) // print the first Object in the array
console.log("------")
console.log(nodes[0].id) // print the id of the first Object in the array