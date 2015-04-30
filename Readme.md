# OpenMicroStep Build System

## Introduction

## Current state

## Examples

## Hacking

The idea of this build system in terms of performance is to use the nodejs async power to it's maximum, so most task are
async and the returned value is given by a callback with most of the time 2 arguments (err and value).



### Workspaces and targets 

Let's start with the project main component: `Workspace`.
A workspace represent a set of files and targets. Files can be shared across targets.
A target represent a compilation result (ie. library, framework, binary, ...).
To describe a project aside from the building graph, only  the `Workspace` and the `Target` classes are necessary.

The `Workspace` does not only provides a tree of files and a list of targets, it also describe the possible and supported
sets of configuration. To be more precise, a Workspace can define a set of supported tool-chains, which means the project
should work well with those tool-chains. Because some project can have much more specific build condition than just toolchain,
the Workspace provide everything to also manage a set of build options :
 - value type (int, bool, string),
 - default value,
 - supported combination of build options for a set of toolchain (or all supported if not precised)
This approach allow the build system to build and run tests for a set of supported tool-chains and build options and thus
making really easy to maintains a cross platform code with some options without setup pain or waiting for the continuous
integration bot to return the result of your last commit. Making the common issue of having a build option that had work
and should still work but is not tested anymore.
The hidden goal is also to be able display build errors in real-time in the IDE for all supported build configurations.

### Building sources

For the requested set of build configurations, build dependency graph are built to allow fast parallel build process.
The entry point for building this graph is the `Workspace`. It requires build and dependency graph of the requested 
targets and returns the resulting graph. 

To create the build graph, the build system follows this algorithm:

    for each target
        call configure on target make object
        for each target dependencies
            create it's build graph
            call exports on each dependency
              - give a chance to the dependency target to change the target
              - give a chance to the dependency make to change the target
        if the toolchain implements buildGraph, then give the responsibility to build the graph to the toolchain
        otherwise let the target build it's graph

To prevent the build system from running 100 clang process at the same time, the `Process` module queue the execution of
build task until system resources are available (ie. it limits the number of child process to the number of CPU (virtual
HT processor counted in by default). See `Process.maxConcurrentProcess`)
