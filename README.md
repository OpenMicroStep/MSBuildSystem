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

```sh
npm install -g @openmicrostep/msbuildsystem.cli
```

To install buildsystem modules you can do:

```sh
msbuildsystem modules install $NPM_MODULE_NAME
msbuildsystem modules install @openmicrostep/msbuildsystem.js.typescript
```

