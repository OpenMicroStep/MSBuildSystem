module.exports =  {
  is: "project",
  name: "Hello World",
  description: "Hello to the world of C",
  "darwin-i386="    : { is: 'environment', sysroot: "darwin:i386"       , components: [], compatibleEnvironments: ["darwin-i386-c"  ], tags: ["darwin", "i386"] },
  "darwin-x86_64="  : { is: 'environment', sysroot: "darwin:x86_64"     , components: [], compatibleEnvironments: ["darwin-x86_64-c"], tags: ["darwin", "x86_64"] },
  "darwin envs="    : { is: 'group', elements: ["=darwin-i386", "=darwin-x86_64"] },
  "Files=": {
    is: 'group',
    elements: [
      { is: 'file', name: 'main.c' }
    ]
  },
  "Hello World=": {
    is: 'target',
    type: "CXXExecutable",
    files: ["=Files"],
    environments : ["=darwin envs"]
  }
};
