## In Vue/Nuxt, a `.vue` file can contain three sections:

```vue
<script setup lang="ts">
/* TypeScript logic goes here */
</script>

<template>
  <!-- HTML-like UI goes here -->
</template>

<style scoped>
/* CSS goes here */
</style>
```

This is called a Vue single-file component. One file can contain the component's logic, markup, and styling together.

## 1. Script Section

JavaScript is the programming language used for browser and Node.js code. TypeScript is JavaScript with type annotations.

In a `.vue` file, the script section is where the component's logic lives: data values, types, functions, API calls, and derived/computed values.

So `lang="ts"` means:

> Treat this script block as TypeScript.

Example:

```html
<script setup lang="ts">
type User = {
  id: string
  name: string
}

const user: User = {
  id: '1',
  name: 'Keith'
}
</script>

<template>
  <p>{{ user.name }}</p>
</template>
```

Nuxt/Vue tooling compiles this for you. The browser does not directly run TypeScript; Nuxt turns it into JavaScript during dev/build.

The special part is `setup`:

```html
<script setup lang="ts">
```

This is Vue's concise syntax for component logic. Variables/functions defined there are automatically available in the `<template>`.

So if you write:

```html
<script setup lang="ts">
const message = 'hello'
</script>

<template>
  <p>{{ message }}</p>
</template>
```

Vue knows how to render `message`.

This is one reason `.vue` files feel unusual at first: one file can contain component logic, markup, and styling together.

## 2. Template Section

HTML is the markup language used to describe page structure, such as headings, paragraphs, lists, buttons, and layout containers.

The template section is HTML-like, but it is not plain HTML. Vue compiles it and connects it to the component's script state.

For example:

```html
<script setup lang="ts">
const title = 'File Explorer'
const selectedName = ref('Nothing selected')

function selectFile(name: string) {
  selectedName.value = name
}
</script>

<template>
  <h1>{{ title }}</h1>
  <p>{{ selectedName }}</p>
  <button @click="selectFile('README.md')">Select README</button>
</template>
```

The template can access values and functions declared in `<script setup>`. They do not have to be functions.

Common Vue template syntax:

- `{{ value }}` renders a JavaScript/TypeScript expression as text.
- `v-if="pending"` renders something only if the value is truthy.
- `v-for="node in displayNodes"` loops over an array.
- `@click="selectFile(node.name)"` runs code when the user clicks.
- `:style="{ paddingLeft: node.depth * 20 + 'px' }"` binds an HTML attribute to an expression.

In this project, the template in `app/app.vue` renders the left file tree and the right preview area.

## 3. Style Section

CSS is the styling language used to control how HTML looks: layout, spacing, colors, borders, fonts, and hover states.

The style section contains the CSS for the component.

Example:

```html
<style scoped>
.tree-row {
  display: flex;
  gap: 8px;
  padding: 6px 4px;
}

.tree-row:hover {
  background: #e9eef5;
}
</style>
```

The `scoped` attribute means the styles apply only to this component. For example, `.tree-row` in one component will not accidentally style `.tree-row` in another component.

## Important notes

### Template block can access anything declared in the script

Anything declared in `<script setup>` is automatically available to the `<template>`.

This includes:

- plain values such as `const title = 'File Explorer'`
- Vue refs such as `const selectedName = ref('Nothing selected')`
- computed values such as `const displayNodes = computed(...)`
- functions such as `selectFile(...)`
- data returned from Nuxt composables such as `useFetch(...)`

This automatic connection is Vue-specific. It is one of the main differences between a Vue template and a normal `.html` file.

### Multiple `.vue` files to represent multiple frontend components

`app/app.vue` is currently the root frontend component. It can contain the whole UI while the app is still small.

Later, repeated or complex UI can be moved into smaller components:

```text
app/app.vue
app/components/FileTree.vue
app/components/FileTreeRow.vue
app/components/MarkdownPreview.vue
```

In that setup, `app.vue` becomes the page-level coordinator, while child components handle focused pieces of the interface.

This is different from the UI-facing operations in the spec. Vue components are frontend UI pieces. UI-facing operations such as `loadTree()`, `createFolderForUi(...)`, `moveNodeForUi(...)`, and `getMarkdownFile(...)` should be exposed through Nuxt server API routes, then called by the frontend.

For example:

```text
app/app.vue
  calls /api/tree

server/api/tree.get.ts
  handles the request

server/utils/tree.ts
  contains tree logic such as readMarkdownFileNames, organizeInitialFiles, and buildTree
```
