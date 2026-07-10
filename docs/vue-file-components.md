In Vue/Nuxt, a `.vue` file can contain three sections:

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

So `lang="ts"` means:

> Treat this script block as TypeScript.

Example:

```vue
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

```vue
<script setup lang="ts">
```

This is Vue’s concise syntax for component logic. Variables/functions defined there are automatically available in the `<template>`.

So if you write:

```vue
<script setup lang="ts">
const message = 'hello'
</script>

<template>
  <p>{{ message }}</p>
</template>
```

Vue knows how to render `message`.

This is one reason `.vue` files feel unusual at first: one file can contain component logic, markup, and styling together.