# Learning Notes

These notes are for building a mental model of the stack used in this take-home task. They are not the product spec and are not meant to replace the README.

## Terminologies & Mental Model

This project is a ***web app***. That means there are two important places where code can run:

1. in the **browser**, where the user sees and clicks the interface

2. on the server, where backend code can read files, talk to a database, and return data to the browser

***JavaScript*** is the language. It can run in the browser, and it can also run outside the browser when a runtime provides the environment for it.

A ***runtime*** is the program that executes code and provides the surrounding environment needed by that code.
- In Python, when running:

    ```powershell
    python script.py
    ```
    the Python interpreter/runtime executes the Python code. It also gives that code access to memory, files, installed packages, standard library modules, and operating system features.

- ***Node.js*** plays a similar role for JavaScript outside the browser. When running:

    ```powershell
    node script.js
    ```

- Node.js executes the JavaScript code and gives it access to server-side capabilities such as the file system, npm packages, backend APIs, and databases.

***Nuxt*** is the web app framework. It uses Vue for the frontend and Node.js for development/build/server-side behavior. In this project, Nuxt provides the structure for the browser UI, server routes, and app build process.

- This is different from R Shiny or Streamlit. Shiny and Streamlit provide high-level UI primitives such as buttons, inputs, charts, and reactive outputs. Nuxt is lower level and more explicit: the app usually has frontend components, server API routes, data models, and persistence logic that are wired together deliberately.

The transferable idea from Python/R workflows is still strong:

- pure logic should be developed as small functions
- inputs and outputs should be easy to test
- UI code should call tested logic rather than contain all the logic itself
- tree operations can be designed like data transformation functions before being connected to buttons

## Project Stack

- Node.js is the runtime for running JavaScript outside the browser.
- npm is the package manager and script runner.
- Nuxt is the full-stack web framework.
- Vue is the frontend component framework used by Nuxt.
- TypeScript is JavaScript with type annotations.
- SQLite will be used later for local persistence of the virtual file explorer structure.

For this project, the Markdown files stay flat in `files/`. The app will store the virtual folder/file organization separately in SQLite.

## Nuxt Project Files

`package.json` is the project manifest. It lists dependencies and commands such as `dev`, `build`, and `preview`.

`package-lock.json` records the exact dependency versions installed. This helps another person install the same dependency tree.

`nuxt.config.ts` is the Nuxt configuration file. Project-wide Nuxt settings and modules are configured here.

`tsconfig.json` configures TypeScript. Nuxt manages much of this, but the file tells tools how to understand TypeScript paths and project types.

`app/app.vue` is the current root Vue component for the app. The scaffold currently shows Nuxt's welcome screen from here.

`public/` contains static files that are served directly by the app, such as `favicon.ico` and `robots.txt`.

## Suggested project directory

Future project code will likely add directories such as:

- `server/` is where Nuxt backend code can live.
- `app/components/` is where reusable frontend UI components can live.

To be more precise,
```python
server/
    utils/ # backend helper functions
        tree.ts     # backend logic
        db.ts       # database logic
    api/ # HTTP endpoints the browser can call
        tree.get.ts   # backend route/endpoint
app/
    app.vue           # frontend UI
    components/       # frontend components
```
- `server/` is where Nuxt backend code can live.
  - `utils/`: backend helper functions
    - `server/utils/tree.ts` could be like a Python module containing reusable backend logic.
    - `server/utils/db.ts` contains database logic for db operations
  - `api/`: HTTP endpoints the browser can call
    - `server/api/tree.get.ts` is like an API entrypoint: **“when the browser asks for the tree, run this backend code.”**


- `app/`: Browser UI code
  - `app/components/` is where reusable frontend UI components can live.

### Python Analogy comparison
```
Python project
  src/
    tree.py
    db.py
  app.py / cli.py

Nuxt project
  server/
    utils/tree.ts     # backend logic
    utils/db.ts       # database logic
    api/tree.get.ts   # backend route/endpoint
  app/
    app.vue           # frontend UI
    components/       # frontend components
```


## JavaScript And TypeScript

JavaScript is the language that ultimately runs in the browser and in Node.js.

TypeScript adds types on top of JavaScript. The types help catch mistakes before runtime and make data shapes easier to understand.

For quick experiments, JavaScript is fine. For project code, TypeScript is preferable because the tree model has meaningful shapes and rules.

For example, a file explorer node has a few important fields:

```ts
type ExplorerNode = {
  id: string
  type: 'folder' | 'file'
  name: string
  parentId: string | null
  filePath?: string
  sortOrder: number
}
```

This makes the assumptions explicit:

- a node is either a folder or a file
- `parentId: null` means the node is at the virtual root
- file nodes can point to a Markdown file path
- folder nodes should not need a file path

## Node And npm Commands

Check the installed Node.js version:

```powershell
node --version
```

Check the installed npm version:

```powershell
npm.cmd --version
```

Use `npm.cmd` in PowerShell if plain `npm` is blocked by PowerShell execution policy.

Run the Nuxt development server:

```powershell
npm.cmd run dev
```

Build the app:

```powershell
npm.cmd run build
```

Preview the built app:

```powershell
npm.cmd run preview
```

The project scripts are defined in `package.json`.

## Frontend, Server, And Database Flow

In this project, "server" means backend code running under Node.js/Nuxt.
- During development, that server runs on the local machine.
- If deployed later, it would run on the deployment host.
- It does not necessarily mean a separate physical computer for the MVP.

The expected flow is:

```text
1. Browser UI
  calls
2. Nuxt server API
  uses
3. Tree/database logic
  reads and writes
4. SQLite database
```

1. The browser UI should display the file/folder tree and Markdown preview. It should not directly edit SQLite or read local Markdown files.

2. The Nuxt server API should receive requests from the UI, such as "load the tree", "create a folder", "move a node", or "get this Markdown file".

3. The tree/database logic should handle the important rules:
   - build a tree from flat database rows
   - create a virtual folder
   - move a node to a new parent
   - prevent moving a folder into itself or one of its descendants
   - read Markdown content from the real file path referenced by a file node
4. SQLite should persist the virtual structure. The original Markdown files in `files/` should remain flat and unchanged.

## Open Questions

- Should shared tree types live under `app/`, `server/`, or a separate shared directory once implementation starts?
- Should SQLite access use Node's built-in `node:sqlite`, or should the project switch to another package if Nuxt compatibility becomes awkward?
- How much of the first MVP should be developed through tests before connecting it to the UI?
