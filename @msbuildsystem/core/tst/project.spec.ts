import {Workspace, Project, Reporter, Target, Flux, Diagnostic, AttributeTypes as V, ComponentElement, FileElement, File} from '@openmicrostep/msbuildsystem.core';
import {assert} from 'chai';
import * as path from 'path';

export class TestTarget extends Target {
  compiler: string;
  sysroot: string;
  static: boolean;
  files:         File[];
  publicHeaders: File[];
  defines:       string[];
  libraries:     string[];
  mylist:        string[];
}
Target.register(["Test"], TestTarget, {
  compiler     : V.defaultsTo(V.validateString, 'default compiler'),
  sysroot      : V.defaultsTo(V.validateString, 'default sysroot'),
  static       : V.defaultsTo(V.validateBoolean, false),
  files        : V.defaultsTo(ComponentElement.setAsListValidator(FileElement.validateFile), []),
  publicHeaders: V.defaultsTo(ComponentElement.setAsListValidator(FileElement.validateFile), []),
  defines      : V.defaultsTo(ComponentElement.setAsListValidator(V.validateString), []),
  libraries    : V.defaultsTo(ComponentElement.setAsListValidator(V.validateString), []),
  mylist       : V.defaultsTo(ComponentElement.setAsListValidator(V.validateString), []),
});

type Context = {
  workspace: Workspace;
  sharedProject: Project;
}

function load_valid_simple(f: Flux<Context>) {
  let workspace = f.context.workspace = Workspace.createTemporary();
  let projectPath = path.normalize(__dirname + "/data/simple-project/make.js");
  let project = f.context.sharedProject = workspace.project(__dirname + "/data/simple-project");
  assert.equal(project.directory, path.normalize(__dirname + "/data/simple-project"));
  assert.equal(project.path, projectPath);
  assert.equal(project.definition!.name, 'MySimpleProject');
  assert.equal(project, workspace.project(__dirname + "/data/simple-project"), "two project at the same path share the same instance");
  assert.deepEqual<Diagnostic[]>(project.reporter.diagnostics, [
    { "category": "load", is: "warning", "path": "MySimpleProject:files:MSStdTime.c"                     , "msg": `file '${project.directory}${path.sep}MSStdTime.c' not found`            },
    { "category": "load", is: "warning", "path": "MySimpleProject:files:MSStdTime-win32.c"               , "msg": `file '${project.directory}${path.sep}MSStdTime-win32.c' not found`      },
    { "category": "load", is: "warning", "path": "MySimpleProject:files:MSStd.c"                         , "msg": `file '${project.directory}${path.sep}MSStd.c' not found`                },
    { "category": "load", is: "warning", "path": "MySimpleProject:files:MSStd.h"                         , "msg": `file '${project.directory}${path.sep}MSStd.h' not found`                },
    { "category": "load", is: "warning", "path": "MySimpleProject:files:MSStd_Private.h"                 , "msg": `file '${project.directory}${path.sep}MSStd_Private.h' not found`        },
    { "category": "load", is: "warning", "path": "MySimpleProject:files:MSStdShared.c"                   , "msg": `file '${project.directory}${path.sep}MSStdShared.c' not found`          },
    { "category": "load", is: "warning", "path": "MySimpleProject:files:MSStdShared-win32.c"             , "msg": `file '${project.directory}${path.sep}MSStdShared-win32.c' not found`    },
    { "category": "load", is: "warning", "path": "MySimpleProject:files:MSStdThreads.c"                  , "msg": `file '${project.directory}${path.sep}MSStdThreads.c' not found`         },
    { "category": "load", is: "warning", "path": "MySimpleProject:files:MSStdThreads-win32.c"            , "msg": `file '${project.directory}${path.sep}MSStdThreads-win32.c' not found`   },
    { "category": "load", is: "warning", "path": "MySimpleProject:files:MSStdBacktrace.c"                , "msg": `file '${project.directory}${path.sep}MSStdBacktrace.c' not found`       },
    { "category": "load", is: "warning", "path": "MySimpleProject:files:MSStdBacktrace-win32.c"          , "msg": `file '${project.directory}${path.sep}MSStdBacktrace-win32.c' not found` },
    { "category": "load", is: "warning", "path": "MySimpleProject:files:unix:MSStdTime-unix.c"           , "msg": `file '${project.directory}${path.sep}MSStdTime-unix.c' not found`       },
    { "category": "load", is: "warning", "path": "MySimpleProject:files:unix:MSStdShared-unix.c"         , "msg": `file '${project.directory}${path.sep}MSStdShared-unix.c' not found`     },
    { "category": "load", is: "warning", "path": "MySimpleProject:files:unix:MSStdThreads-unix.c"        , "msg": `file '${project.directory}${path.sep}MSStdThreads-unix.c' not found`    },
    { "category": "load", is: "warning", "path": "MySimpleProject:files:backtrace:MSStdBacktrace-unix.c" , "msg": `file '${project.directory}${path.sep}MSStdBacktrace-unix.c' not found`  },
    { "category": "load", is: "warning", "path": "MySimpleProject:files:mman:mman.c"                     , "msg": `file '${project.directory}${path.sep}mman.c' not found`                 },
    { "category": "load", is: "warning", "path": "MySimpleProject:files:mman:mman.h"                     , "msg": `file '${project.directory}${path.sep}mman.h' not found`                 },
  ]);
  f.continue();
}
function load_invalid() {
  let workspace = Workspace.createTemporary();
  let projectPath = path.normalize(__dirname + "/data/bad-project/make.js");
  let project = workspace.project(__dirname + "/data/bad-project");
  assert.equal(project.directory, path.normalize(__dirname + "/data/bad-project"));
  assert.equal(project.path, projectPath);
  assert.equal(project.definition!.name, 'MyInvalidProject');
  assert.deepEqual<Diagnostic[]>(project.reporter.diagnostics, [
    { "category": "load", is: "warning", "path": "MyInvalidProject:files:MSStdTime.c"                     , "msg": `file '${project.directory}${path.sep}MSStdTime.c' not found`            },
    { "category": "load", is: "warning", "path": "MyInvalidProject:files:MSStdTime-win32.c"               , "msg": `file '${project.directory}${path.sep}MSStdTime-win32.c' not found`      },
    { "category": "load", is: "warning", "path": "MyInvalidProject:files:MSStd.c"                         , "msg": `file '${project.directory}${path.sep}MSStd.c' not found`                },
    { "category": "load", is: "warning", "path": "MyInvalidProject:files:MSStd.h"                         , "msg": `file '${project.directory}${path.sep}MSStd.h' not found`                },
    { "category": "load", is: "warning", "path": "MyInvalidProject:files:MSStd_Private.h"                 , "msg": `file '${project.directory}${path.sep}MSStd_Private.h' not found`        },
    { "category": "load", is: "warning", "path": "MyInvalidProject:files:MSStdShared.c"                   , "msg": `file '${project.directory}${path.sep}MSStdShared.c' not found`          },
    { "category": "load", is: "warning", "path": "MyInvalidProject:files:MSStdShared-win32.c"             , "msg": `file '${project.directory}${path.sep}MSStdShared-win32.c' not found`    },
    { "category": "load", is: "warning", "path": "MyInvalidProject:files:MSStdThreads.c"                  , "msg": `file '${project.directory}${path.sep}MSStdThreads.c' not found`         },
    { "category": "load", is: "warning", "path": "MyInvalidProject:files:MSStdThreads-win32.c"            , "msg": `file '${project.directory}${path.sep}MSStdThreads-win32.c' not found`   },
    { "category": "load", is: "warning", "path": "MyInvalidProject:files:MSStdBacktrace.c"                , "msg": `file '${project.directory}${path.sep}MSStdBacktrace.c' not found`       },
    { "category": "load", is: "warning", "path": "MyInvalidProject:files:MSStdBacktrace-win32.c"          , "msg": `file '${project.directory}${path.sep}MSStdBacktrace-win32.c' not found` },
    { "category": "load", is: "warning", "path": "MyInvalidProject:files:unix:MSStdTime-unix.c"           , "msg": `file '${project.directory}${path.sep}MSStdTime-unix.c' not found`       },
    { "category": "load", is: "warning", "path": "MyInvalidProject:files:unix:MSStdShared-unix.c"         , "msg": `file '${project.directory}${path.sep}MSStdShared-unix.c' not found`     },
    { "category": "load", is: "warning", "path": "MyInvalidProject:files:unix:MSStdThreads-unix.c"        , "msg": `file '${project.directory}${path.sep}MSStdThreads-unix.c' not found`    },
    { "category": "load", is: "warning", "path": "MyInvalidProject:files:unix:MSStdTime-unix.c"           , "msg": `file '${project.directory}${path.sep}MSStdTime-unix.c' not found`       },
    { "category": "load", is: "warning", "path": "MyInvalidProject:files:unix:MSStdShared-unix.c"         , "msg": `file '${project.directory}${path.sep}MSStdShared-unix.c' not found`     },
    { "category": "load", is: "warning", "path": "MyInvalidProject:files:unix:MSStdThreads-unix.c"        , "msg": `file '${project.directory}${path.sep}MSStdThreads-unix.c' not found`    },
    { "category": "load", is: "error"  , "path": "MyInvalidProject:files.elements[12]"                    , "msg": `conflict with an element defined with the same name: 'unix'`  },
    { "category": "load", is: "note"   , "path": "MyInvalidProject:files:mman.elements[0].tags"           , "msg": "'tags' could be misused, this key has special meaning for some elements" },
    { "category": "load", is: "warning", "path": "MyInvalidProject:files:mman:mman.h"                     , "msg": `file '${project.directory}${path.sep}mman.h' not found`                 },
    { "category": "load", is: "warning", "path": "MyInvalidProject:files:backtrace:MSStdBacktrace-unix.c" , "msg": `file '${project.directory}${path.sep}MSStdBacktrace-unix.c' not found`  },
    { "category": "load", is: "note"   , "path": "MyInvalidProject:files:mman.elements[0].tags"           , "msg": "'tags' could be misused, this key has special meaning for some elements" },
    { "category": "load", is: "warning", "path": "MyInvalidProject:files:mman:mman.h"                     , "msg": `file '${project.directory}${path.sep}mman.h' not found`                 },
    { "category": "load", is: "error"  , "path": "MyInvalidProject:files:mman"                            , "msg": "conflict with an element defined with the same name: 'mman'"  },
    { "category": "load", is: "error"  , "path": "MyInvalidProject:notanobject"                           , "msg": "an element definition or reference was expected"              },
    { "category": "load", is: "error"  , "path": "MyInvalidProject:nois.is"                               , "msg": "'is' attribute must be a string"                              },
    { "category": "resolve", is: "warning", "path": "MyInvalidProject:files:mman.elements[0]", "msg": "attribute must be an element, got a {\"name\":\"mman.c\",\"tags\":[\"CompileC\"]}"}, // MyInvalidProject:files.elements[14]
    { "category": "resolve", is: "warning", "path": "MyInvalidProject:files:mman.elements[0]", "msg": "attribute must be an element, got a {\"name\":\"mman.c\",\"tags\":[\"CompileC\"]}"}, // MyInvalidProject:files.elements[15]
    { "category": "resolve", is: "error"  , "path": "MyInvalidProject:all envs.elements[6]"  , "msg": "elements must be of the same type, expecting environment, got component"          },
  ]);
}
function build_graph(f: Flux<Context>) {
  let reporter = new Reporter();
  let project = f.context.sharedProject;
  let graph = project.buildGraph(reporter, {});
  let targetTasks = Array.from(graph.allTasks());
  assert.deepEqual(reporter.diagnostics, []);
  assert.deepEqual(targetTasks.map(task => task.name), [
    { type: 'target', name: 'MSStd', environment: 'darwin-i386'  , project: project.path },
    { type: 'target', name: 'MSStd', environment: 'darwin-x86_64', project: project.path },
    { type: 'target', name: 'MSStd', environment: 'linux-i386'   , project: project.path },
    { type: 'target', name: 'MSStd', environment: 'linux-x86_64' , project: project.path },
    { type: 'target', name: 'MSStd', environment: 'msvc12-i386'  , project: project.path },
    { type: 'target', name: 'MSStd', environment: 'msvc12-x86_64', project: project.path },
    { type: 'target', name: 'MSStd_static', environment: 'darwin-i386'  , project: project.path },
    { type: 'target', name: 'MSStd_static', environment: 'darwin-x86_64', project: project.path },
    { type: 'target', name: 'MSStd_static', environment: 'linux-i386'   , project: project.path },
    { type: 'target', name: 'MSStd_static', environment: 'linux-x86_64' , project: project.path },
    { type: 'target', name: 'MSStd_static', environment: 'msvc12-i386'  , project: project.path },
    { type: 'target', name: 'MSStd_static', environment: 'msvc12-x86_64', project: project.path },
    { type: 'target', name: 'anotherLib', environment: 'darwin-i386'  , project: project.path },
    { type: 'target', name: 'anotherLib', environment: 'darwin-x86_64', project: project.path },
    { type: 'target', name: 'anotherLib', environment: 'linux-i386'   , project: project.path },
    { type: 'target', name: 'anotherLib', environment: 'linux-x86_64' , project: project.path },
    { type: 'target', name: 'anotherLib', environment: 'msvc12-i386'  , project: project.path },
    { type: 'target', name: 'anotherLib', environment: 'msvc12-x86_64', project: project.path }
  ]);
  let target = (graph.findTask(false, (t: Target) => t.name.name === "MSStd" && t.name.environment === 'darwin-i386') as Target);
  let msstd: any = target.attributes.toJSON();
  msstd.components = msstd.components.map(c => c.name);
  msstd.environment.components = msstd.environment.components.map(c => c.name);
  let exports = {
    is: "target-exports",
    name: "MSStd",
    environment: "darwin-i386",
    components: [
      "=generated",
      {
        is: "component",
        name: "",
        tags: [],
        components: [{
          is: "component",
          name: "",
          tags: [],
          components: [],
          "clang=": {
            is: "component",
            name: "clang",
            tags: ["clang"],
            compiler: "clang",
            components: [],
            mylist: ["v2"],
          }
        }]
      }
    ],
    "generated=": { is: "component", components: [] }
  };
  assert.deepEqual(msstd, {
    is           : 'build-target',
    name         : 'MSStd',
    tags         : [],
    compatibleEnvironments: [],
    components   : [],
    targets      : [],
    manual       : false,
    mylist       : ["v2"],
    environment  : {
      is: "environment",
      name: "darwin-i386",
      compatibleEnvironments: [],
      sysroot: "darwin:i386",
      tags: ["darwin", "i386"],
      components: ["clang"],
      componentsByEnvironment: {},
    },
    compiler     : "clang",
    type         : 'Test',
    static       : false,
    sysroot      : "darwin:i386",
    defines      : ["MINGW_HAS_SECURE_API" ],
    libraries    : ['-lm', '-luuid', '-ldl'],
    files        : ["MSStdTime.c", "MSStd.c", "MSStdShared.c", "MSStdThreads.c", "MSStdBacktrace.c", "mman.c"].map(n => ({ is: "file", name: n, tags: ["CompileC"] })),
    publicHeaders: ["MSStd.h", "mman.h"].map(n => ({ is: "file", name: n, tags: ["Header"] })),
    exports: exports
  });
  assert.deepEqual(target.exports as any, exports);
  assert.deepEqual(reporter.diagnostics, []);
  f.continue();
}

function files(f: Flux<Context>) {
  let reporter = new Reporter();
  let project = f.context.sharedProject.tree;
  assert.deepEqual(
    project.resolveElements(reporter, "=files?CompileC").map(f => f.name),
    ["MSStdTime.c", "MSStd.c", "MSStdShared.c", "MSStdThreads.c", "MSStdBacktrace.c", "mman.c"]);
  assert.deepEqual(
    project.resolveElements(reporter, "=files?Header").map(f => f.name),
    ["MSStd.h", "mman.h"]);
  assert.deepEqual(
    project.resolveElements(reporter, "=files:mman?Header").map(f => f.name),
    ["mman.h"]);
  assert.deepEqual(
    project.resolveElements(reporter, "=files:unix").map(f => f.name),
    ["MSStdTime-unix.c", "MSStdShared-unix.c", "MSStdThreads-unix.c", "MSStdBacktrace-unix.c"]);
  assert.deepEqual(
    project.resolveElements(reporter, "=files:unix:backtrace").map(f => f.name),
    []);
  assert.deepEqual(reporter.diagnostics, [{is: "warning", "msg": "query 'files:unix:backtrace' refer to an element that can't be found, the group 'files:unix:backtrace' is ignored"}]);
  f.continue();
}
function components(f: Flux<Context>) {
  let reporter = new Reporter();
  let project = f.context.sharedProject.tree;
  assert.deepEqual(
    project.resolveElements(reporter, "=clang").map(e => e.toJSON()),
    [{ is: 'component', compiler: "clang", tags: ["clang"], mylist: ["v2"], components: [], componentsByEnvironment: {}, name: 'clang' }]);
  assert.deepEqual(
    project.resolveElements(reporter, "=all envs").map(e => e.name),
    ["darwin-i386", "darwin-x86_64", "linux-i386", "linux-x86_64", "msvc12-i386", "msvc12-x86_64"]);
  assert.deepEqual(
    project.resolveElements(reporter, "=darwin-i386").map(e => e.toJSON()),
    [
      {
        is: 'environment',
        sysroot: "darwin:i386",
        components: [
          {
            is: "component",
            name: "clang",
            components: [],
            componentsByEnvironment: {},
            mylist: ["v2"],
            compiler: "clang",
            tags: ["clang"]
          }
        ],
        componentsByEnvironment: {},
        tags: ["darwin", "i386"],
        name: 'darwin-i386',
        compatibleEnvironments: []
      }
    ]);
  assert.deepEqual(
    project.resolveElements(reporter, "=darwin-x86_64").map(e => e.toJSON()),
    [
      {
        is: 'environment',
        sysroot: "darwin:x86_64",
        components: [
          {
            is: "component",
            name: "clang",
            components: [],
            componentsByEnvironment: {},
            mylist: ["v2"],
            compiler: "clang",
            tags: ["clang"]
          }
        ],
        componentsByEnvironment: {},
        mylist: ["v1"],
        tags: ["darwin", "x86_64"],
        name: 'darwin-x86_64',
        compatibleEnvironments: []
      }
    ]);
  assert.deepEqual(reporter.diagnostics, []);
  f.continue();
}

function with_external_dependencies(f: Flux<Context>) {
  let projectPath = path.normalize(__dirname + "/data/simple-project-dep/make.js");
  let project2 = f.context.workspace.project(__dirname + "/data/simple-project-dep");
  let project = f.context.sharedProject;
  assert.equal(project2.directory, path.normalize(__dirname + "/data/simple-project-dep"));
  assert.equal(project2.path, projectPath);
  assert.equal(project2.definition!.name, 'MyDependencyToSimpleProject');
  assert.deepEqual(project2.reporter.diagnostics.map(d => { if (d.path) d.path = path.relative(project2.directory, d.path); return d;}), []);

  let reporter = new Reporter();
  let graph = project2.buildGraph(reporter, { environments:["msvc12-i386"] });
  let targetTasks = Array.from(graph.allTasks());
  assert.deepEqual(reporter.diagnostics.map(d => { if (d.path) d.path = path.relative(project2.directory, d.path); return d;}), []);
  assert.deepEqual(targetTasks.map(task => task.name), [
    { type: 'target', name: 'ATarget', environment: 'msvc12-i386'  , project: project2.path },
    { type: 'target', name: 'MSStd', environment: 'msvc12-i386'  , project: project.path },
    { type: 'target', name: 'DependencyTestTarget', environment: 'msvc12-i386'  , project: project2.path }
  ]);
  f.continue();
}

export const tests = [
  { name: 'load valid simple'         , test: load_valid_simple          },
  { name: 'load invalid'              , test: load_invalid               },
  { name: 'build graph'               , test: build_graph                },
  { name: 'files'                     , test: files                      },
  { name: 'components'                , test: components                 },
  { name: 'with external dependencies', test: with_external_dependencies },
];
