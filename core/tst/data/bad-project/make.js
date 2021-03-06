module.exports =  {
  is: "project",
  name: "MyInvalidProject",
  description: "This is a very simple c project example to test basic component features",
  'files=': { is: "group", 
    elements: [
      {is: 'file', name: "MSStdTime.c", tags:["CompileC"]},
      {is: 'file', name: "MSStdTime-win32.c"},
      {is: 'file', name: "MSStd.c", tags:["CompileC"]},
      {is: 'file', name: "MSStd.h", tags:["Header"]},
      {is: 'file', name: "MSStd_Private.h"},
      {is: 'file', name: "MSStdShared.c", tags:["CompileC"]},
      {is: 'file', name: "MSStdShared-win32.c"},
      {is: 'file', name: "MSStdThreads.c", tags:["CompileC"]},
      {is: 'file', name: "MSStdThreads-win32.c"},
      {is: 'file', name: "MSStdBacktrace.c", tags:["CompileC"]},
      {is: 'file', name: "MSStdBacktrace-win32.c"},
      {is: 'group', name: 'unix' , elements: [
        {is: 'file', name: "MSStdTime-unix.c"},
        {is: 'file', name: "MSStdShared-unix.c"},
        {is: 'file', name: "MSStdThreads-unix.c"},
        "=backtrace"
      ]},
      {is: 'group', name: 'unix' , elements: [ // group unix is defined twice
        {is: 'file', name: "MSStdTime-unix.c"},
        {is: 'file', name: "MSStdShared-unix.c"},
        {is: 'file', name: "MSStdThreads-unix.c"},
        "=backtrace"
      ]},
      "=backtrace",
      "=mman",
      {is: 'group', name: 'mman', elements: [ // group mman is defined twice
        {name: "mman.c", tags:["CompileC"]},
        {is: 'file', name: "mman.h", tags:["Header"]},
      ]}
    ],
    "backtrace=": { is: 'group', elements: [
      {is: 'file', name: "MSStdBacktrace-unix.c"},
    ]},
    "mman=": {is: 'group', elements: [
      {name: "mman.c", tags:["CompileC"]},
      {is: 'file', name: "mman.h", tags:["Header"]},
    ]},
  },
  "notanobject=": "",
  "nois=": {},
  "clang="        : { is: 'component', compiler: "clang", tags: ["clang"] },
  "darwin-i386="  : { is: 'environment', sysroot: "darwin:i386"       , components: ["=clang"], tags: ["darwin", "i386"] },
  "darwin-x86_64=": { is: 'environment', sysroot: "darwin:x86_64"     , components: ["=clang"], tags: ["darwin", "x86_64"] },
  "darwin-univ="  : { is: 'environment', sysroot: "darwin:i386,x86_64", components: ["=clang"], tags: ["darwin", "i386", "x86_64"] },
  "linux-i386="   : { is: 'environment', sysroot: "linux:i386"        , components: ["=clang"], tags: ["linux", "i386"] },
  "linux-x86_64=" : { is: 'environment', sysroot: "linux:x86_64"      , components: ["=clang"], tags: ["linux", "x86_64"] },
  "msvc12-i386="  : { is: 'environment', sysroot: "msvc:i386"         , components: ["=clang"], tags: ["msvc12", "i386"] },
  "msvc12-x86_64=": { is: 'environment', sysroot: "msvc:x86_64"       , components: ["=clang"], tags: ["msvc12", "x86_64"] },
  "wo451-i386="   : { is: 'environment', sysroot: "wo451:i386"                             , tags: ["wo451", "i386"] },
  "all envs="     : { is: 'group', elements: ["=darwin-i386", "=darwin-x86_64", "=linux-i386", "=linux-x86_64", "=msvc12-i386", "=msvc12-x86_64", "=clang"] }, // group can only contains element of the same is
  "MSStd=": {
    is: 'target',
    type: "Test",
    environments : ["=all envs"],
    files        : ["=files ? CompileC"],
    publicHeaders: ["=files ? Header"],
    static       : true,
    defines      : ["MINGW_HAS_SECURE_API" ],
    libraries    : ['-lm', '-luuid', '-ldl']
  }
};
