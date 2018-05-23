# make.js

The make.js is the entry point of any project that use the crosscompilation buildsystem.
It's where you define your project (files, targets, environments, runs, ...).

## Vocabulary

An **environment** is a precise set of options that define a way to use the project. For example, in compiled programming language, there is at least one environment per wanted target system/architecture.

A **target** is one of the product of your project, this could be a library, a documentation, an executable, ...

A **run** is an execution of something related to your project.


## Definition

The `make.js` file is a simple javascript file that define a CommonJS module and has access to node modules to create it's project definition.
The exported module is the definition of the project, it's an object composed of 5 parts:

 - `environments`
 - `files`
 - `targets`
 - `runs`

### environments

It's a list of **environment** you want your project to be compatible with.
An environment is always defined by two things:

 - `env`: the name that is used to store the environement products and that can be shared accross project
 - `name`: the name that you can use to refer to this environment in this definition file
If `name` isn't provided, the value of `env` is used in place.

TODO: c style environments

### files

It's a tree based list of files starting with an array of files and/or groups.
Any item in the array can be either a file or a group.

A file is defined by two things:
 - `file`: the path to the file relative to this definition file.
 - `tags`: a optional list of tags that can be used to filter and select a set of files in target definitions.

A group is defined by two things:
 - `group`: the name of the group
 - `subs`: a list of files and/or groups

This define a well-organized list of file and this is the only place in the make definition where you should define where a file is, anywhere else, the combinaison of tags and group path should be more than enough.

Anywhere else in this make definition you can refer to a set of files with the following filtering format: **[GROUP]?[?TAG]***.

The filter can start this a path to a group in the files tree (ex: `MyGroup1.MyGroup2`) and this limit the set of files to the given group.
The filter can be followed by one of multiple tag name prepended with a **?** character (ex: `?MyTag0?MyTag1). This limits the set of files to the ones that have all the requested tags.

### targets


### runs

## Example

```
module.exports = {
  "environments": [
    {env: "darwin-x86_64", sysroot: "darwin", arch: "x86_64"}
  ],
  files: [
    { file: "MyFile.c", tags: ["CompileMe"] },
    { group: "MyGroup", subs: [
      { file: "DontCompileMe.c" },
      { file: "CompileMe.c", tags: ["CompileMe"] }
    ]}
  ]
  "targets": [
    {
      name: "MyExecutable",  // name of the target
      type: "Executable",    // this target is an executable
      files: ["MyGroup?CompileMe"], // all the file that has the tag: CompileMe
    }
  ],
  "runs": [
    {
      name: "RunMyExecutable",
      dependencies: ["MyExecutable"],
      path: { target: "MyExecutable" },
      arguments: [ "1", "2", function() { return "3"; }],
    }
  ]

}