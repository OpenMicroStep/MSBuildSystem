class Workspace
===============

A workspace is a set of projects and the space (directory) where they are built. 
It retains the set of associated projects (sources or packaged) and allow dependencies between projects.

Organisation of a workspace (relative to workspace directory)

 - `workspace.json`: workspace state (see `WorkspaceData` type)
 - `${environment name}`: result of builds
 - `.shared/${environment name}`: contains target exported make.js
 - `.build/${environment name}`: build related data (can be removed at any time to force full rebuild)

## Methods

### Workspace lifecycle

#### `constructor(directory?: string)`

Create a workspace in _directory_. 
If _directory_ is not defined, the first loaded project name will be used to define it (ie. `/opt/microstep/${project name}`)

#### `static createTemporary() : Workspace`

Create a temporary workspace that will be cleared once node process exit or if clear() is called.
The temporary workspace is created in the os temporary directory.

#### `project(directory: string): Project`

Get the loaded project in the given directory.
If the project is not a member of the workspace, it is added.
If the project is not loaded, it is loaded.

#### `removeProject(directory)`

Remove a project from the workspace.

#### `save()`

Save workspace persistant data (ie. the project list)

#### `clear()`

Clear workspace data (ie. the whole directory is removed)

#### `isDirectoryPendingResolution(): boolean`

Returns true if the workspace directory is not yet defined to it's final value.


### Tools

#### `buildGraph(reporter: Reporter, options: BuildGraphOptions): RootGraph`

Build a new graph of the workspace with respect to the provided _options_.

#### `resolveExports(name: string, environmentName: string): Element[]`

Resolve workspace global elements (ie. referenced with the `=::name:environmentName::` syntax).

First a lookup into `Workspace.globalExports` is done.
If this gave no results, the lookup occur in the current set of targets.
Returns the first result found or an empty array.

#### `targets() : TargetElement[]`

Returns the list of all targets in this workspace.
