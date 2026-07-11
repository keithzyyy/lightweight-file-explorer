# Web APIs as Remote Functions

## 1. The Core Analogy: Web APIs as Remote Functions
An API (Application Programming Interface) is a programmatic way for different applications—regardless of their programming language—to talk to your application using **HTTP requests** as a universal translator. 

In traditional programming, you execute logic by calling a specific function name inside your code. In web development, you execute logic across the internet by combining a **Route** and an **HTTP Method**. Together, they form the **"Virtual Function Name"** of your backend code.

### The Virtual Function Formula
$$\text{HTTP Method (Action Verb)} + \text{Route (Resource Address)} \\ = \text{The Virtual Function Name}$$

### Deconstructing the Components
1. **The Route (The Address):** A URL path (e.g., `/api/users`) that specifies *which object or resource* you want to interact with. Think of this as specifying the module or class you are targeting.
2. **The HTTP Method (The Action Verb):** The command (GET, POST, PUT, DELETE) that tells the server *what to do* with that resource. Think of this as the specific operation or action.

### RESTful Mapping Example
Instead of creating dozens of uniquely named URL endpoints for every single action, RESTful APIs collapse actions down into a single clean route and differentiate the "function name" using HTTP verbs:

| HTTP Verb (Action) | + | Route (Resource) | = | Virtual Function Name | Internal Code Executed |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | + | `/api/users` | = | `GET /api/users` | `getUsers()` |
| **POST** | + | `/api/users` | = | `POST /api/users` | `createUser()` |
| **PUT** | + | `/api/users` | = | `PUT /api/users` | `updateUser()` |
| **DELETE** | + | `/api/users` | = | `DELETE /api/users` | `deleteUser()` |


## 2. Practical Implementation in Nuxt

### 2.1 Automatic API endpoint construction
Nuxt uses your project's file and folder structure to automatically deploy these "Virtual Functions" straight to the Node.js engine without manual configuration.

In Nuxt, any file placed inside the `server/api/` or `server/routes/` directory automatically becomes a backend API endpoint.

* Creating a file at `/server/api/users.get.ts` tells Nuxt to register the `GET /api/users` function.
* Creating a file at `/server/api/users.post.ts` tells Nuxt to register the `POST /api/users` function.

**Node.js** sits underneath, waiting to spin up and execute the underlying JavaScript logic the exact millisecond those internet paths are requested.

### 2.2 Example

Suppose we have a `server/api/tree.get.ts` file:
```ts
import {
  buildTree,
  organizeInitialFiles,
  readMarkdownFileNames
} from '../utils/tree'

/*
`defineEventHandler` is a compiler utility helper provided by
Nitro, the high-performance server engine that powers Nuxt 3.
*/
export default defineEventHandler(() => {
  const fileNames = readMarkdownFileNames('files')
  const nodes = organizeInitialFiles(fileNames)

  return buildTree(nodes)
})
```

`tree.get.ts` automatically creates a route called `/api/tree` and only responds to GET requests (**you don't need to setup the routing logic! Nuxt already does that for you!**).

When a user or a frontend component fetches data from the route
matching this file, Nuxt executes your code on the server like
this:
1. `defineEventHandler` wraps your logic: It standardises incoming network requests and outgoing server responses.
2. Synchronous or Asynchronous Processing: It reads your local markdown file names, organizes them, and constructs a tree architecture.
3. Automatic Serialization: Whatever data structures your functions (`buildTree(nodes)`) return are automatically converted into a JSON response by Nuxt.