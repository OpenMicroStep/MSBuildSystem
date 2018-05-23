@openmicrostep/msbuildsystem.cxx
================================

This buildsystem module aims to provide CXX cross-compilation building capabilities.

This module has 4 concepts:

 - sysroot: a set of system files providing headers and libraries for OS level apis,
 - toolchain: a self building graph that define how the target must be built based for a defined api / compiler / linker,
 - compile: a compilation task
 - link: a link task

The cxx-target build graph looks like:

```
+-------------- [target: cxx-*] --------------+
| +------------ [toolchain:   ] ------------+ |
| | +- [graph: compile] -+                  | |
| | | [task: compile]    |                  | |
| | |       ....         | -> [task: link]  | |
| | | [task: compile]    |                  | |
| | +--------------------+                  | |
| +-----------------------------------------+ |
+---------------------------------------------+
```
