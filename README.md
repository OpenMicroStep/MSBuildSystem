MSBuildSystem
=============

This project aim to provide a language independent build system.


Modules
-------

Specific functionalities are provided by modules.
Here is the current official module list:

 - js: Base module for anything related to javascript
 - js.typescript: Add typescript support to the js module
 - cxx: Base module for anything related to C/C++/Objective-C
 - cxx.tools.clang: Add a clang provider (binaries)
 - cxx.sysroot.*: sysroot providers (`x86_64-darwin12`, `x86_64-msvc12`, `x86_64-debian7`, ...)


Installation
------------

Because this buildsystem is made to be run by node.js, it's distributed by npm (node package manager).

```
npm install -g @msbuildsystem/cli
```

To install buildsystem module you can do:

```
msbuildsystem modules install @msbuildsystem/MODULE_NAME
```

