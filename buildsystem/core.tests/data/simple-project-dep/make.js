module.exports =  {
  is: "project",
  name: "MyDependencyToSimpleProject",
  description: "This is a very simple c project example to test basic component import features",
  "darwin-i386="    : { is: 'environment', sysroot: "darwin:i386"       , components: [], compatibleEnvironments: ["darwin-i386-c"  ], tags: ["darwin", "i386"] },
  "darwin-x86_64="  : { is: 'environment', sysroot: "darwin:x86_64"     , components: [], compatibleEnvironments: ["darwin-x86_64-c"], tags: ["darwin", "x86_64"] },
  "linux-i386="     : { is: 'environment', sysroot: "linux:i386"        , components: [], compatibleEnvironments: ["linux-i386-c"   ], tags: ["linux", "i386"] },
  "linux-x86_64="   : { is: 'environment', sysroot: "linux:x86_64"      , components: [], compatibleEnvironments: ["linux-x86_64-c" ], tags: ["linux", "x86_64"] },
  "msvc12-i386="    : { is: 'environment', sysroot: "msvc:i386"         , components: [], compatibleEnvironments: ["msvc12-i386-c"  ], tags: ["msvc12", "i386"] },
  "msvc12-x86_64="  : { is: 'environment', sysroot: "msvc:x86_64"       , components: [], compatibleEnvironments: ["msvc12-x86_64-c"], tags: ["msvc12", "x86_64"] },
  "darwin envs="    : { is: 'group', elements: ["=darwin-i386", "=darwin-x86_64"] },
  "linux envs="     : { is: 'group', elements: ["=linux-i386" , "=linux-x86_64"] },
  "win envs="       : { is: 'group', elements: ["=msvc12-i386", "=msvc12-x86_64"] },
  "all envs="       : { is: 'group', elements: ["=darwin envs", "=linux envs", "=win envs"] },
  "ATarget=": {
    is: 'target',
    type: "Test",
    environments : ["=all envs"],
  },
  "DependencyTestTarget=": {
    is: 'target',
    type: "Test",
    environments : ["=win envs"],
    targets: ["=ATarget", "=::*:MSStd::"]
  }
};
