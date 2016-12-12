class Workspace
===============

A workspace is a set of projects and the space (directory) where they are built. 
It retains the set of associated projects (sources or packaged) and allow dependencies between projects.

Organisation of a workspace (relative to workspace directory)

 - `workspace.json`: workspace state
 - `${environment name}/${variant name}`: result of builds
 - `.shared/${environment name}/${variant name}`: contains target exported make.js
 - `.build/${environment name}/${variant name}`: build related data (can be removed at any time to force full rebuild)

## Methods

#### `project(directory: string): Project`

Get the loaded project in the given directory.
If the project is not a member of the workspace, it is added.
If the project is not loaded, it is loaded.

