import {Workspace, Project, Reporter, Target, declareTarget, Flux} from '@msbuildsystem/core';
import {assert} from 'chai';
import * as path from 'path';

@declareTarget({ type: "Test" })
export class TestTarget extends Target {
}

type Context = {
  workspace: Workspace;
  sharedProject: Project;
}

function load_valid_simple(f: Flux<Context>) {
  let workspace = f.context.workspace = new Workspace();
  let projectPath = path.normalize(__dirname + "/data/simple-project/make.js");
  let project = f.context.sharedProject = workspace.project(__dirname + "/data/simple-project");
  assert.equal(project.directory, path.normalize(__dirname + "/data/simple-project"));
  assert.equal(project.path, projectPath);
  assert.equal(project.definition!.name, 'MySimpleProject');
  assert.equal(project, workspace.project(__dirname + "/data/simple-project"), "two project at the same path share the same instance");
  assert.deepEqual(project.reporter.diagnostics, [
    { "category": "load", "type": "warning", "path": "MySimpleProject:files:MSStdTime.c"                     , "msg": `file '${project.directory}/MSStdTime.c' not found`            },
    { "category": "load", "type": "warning", "path": "MySimpleProject:files:MSStdTime-win32.c"               , "msg": `file '${project.directory}/MSStdTime-win32.c' not found`      },
    { "category": "load", "type": "warning", "path": "MySimpleProject:files:MSStd.c"                         , "msg": `file '${project.directory}/MSStd.c' not found`                },
    { "category": "load", "type": "warning", "path": "MySimpleProject:files:MSStd.h"                         , "msg": `file '${project.directory}/MSStd.h' not found`                },
    { "category": "load", "type": "warning", "path": "MySimpleProject:files:MSStd_Private.h"                 , "msg": `file '${project.directory}/MSStd_Private.h' not found`        },
    { "category": "load", "type": "warning", "path": "MySimpleProject:files:MSStdShared.c"                   , "msg": `file '${project.directory}/MSStdShared.c' not found`          },
    { "category": "load", "type": "warning", "path": "MySimpleProject:files:MSStdShared-win32.c"             , "msg": `file '${project.directory}/MSStdShared-win32.c' not found`    },
    { "category": "load", "type": "warning", "path": "MySimpleProject:files:MSStdThreads.c"                  , "msg": `file '${project.directory}/MSStdThreads.c' not found`         },
    { "category": "load", "type": "warning", "path": "MySimpleProject:files:MSStdThreads-win32.c"            , "msg": `file '${project.directory}/MSStdThreads-win32.c' not found`   },
    { "category": "load", "type": "warning", "path": "MySimpleProject:files:MSStdBacktrace.c"                , "msg": `file '${project.directory}/MSStdBacktrace.c' not found`       },
    { "category": "load", "type": "warning", "path": "MySimpleProject:files:MSStdBacktrace-win32.c"          , "msg": `file '${project.directory}/MSStdBacktrace-win32.c' not found` },
    { "category": "load", "type": "warning", "path": "MySimpleProject:files:unix:MSStdTime-unix.c"           , "msg": `file '${project.directory}/MSStdTime-unix.c' not found`       },
    { "category": "load", "type": "warning", "path": "MySimpleProject:files:unix:MSStdShared-unix.c"         , "msg": `file '${project.directory}/MSStdShared-unix.c' not found`     },
    { "category": "load", "type": "warning", "path": "MySimpleProject:files:unix:MSStdThreads-unix.c"        , "msg": `file '${project.directory}/MSStdThreads-unix.c' not found`    },
    { "category": "load", "type": "warning", "path": "MySimpleProject:files:backtrace:MSStdBacktrace-unix.c" , "msg": `file '${project.directory}/MSStdBacktrace-unix.c' not found`  },
    { "category": "load", "type": "warning", "path": "MySimpleProject:files:mman:mman.c"                     , "msg": `file '${project.directory}/mman.c' not found`                 },
    { "category": "load", "type": "warning", "path": "MySimpleProject:files:mman:mman.h"                     , "msg": `file '${project.directory}/mman.h' not found`                 },
  ]);
  f.continue();
}
function load_invalid() {
  let workspace = new Workspace();
  let projectPath = path.normalize(__dirname + "/data/bad-project/make.js");
  let project = workspace.project(__dirname + "/data/bad-project");
  assert.equal(project.directory, path.normalize(__dirname + "/data/bad-project"));
  assert.equal(project.path, projectPath);
  assert.equal(project.definition!.name, 'MyInvalidProject');
  assert.deepEqual(project.reporter.diagnostics, [
    { "category": "load", "type": "warning", "path": "MyInvalidProject:files:MSStdTime.c"                     , "msg": `file '${project.directory}/MSStdTime.c' not found`            },
    { "category": "load", "type": "warning", "path": "MyInvalidProject:files:MSStdTime-win32.c"               , "msg": `file '${project.directory}/MSStdTime-win32.c' not found`      },
    { "category": "load", "type": "warning", "path": "MyInvalidProject:files:MSStd.c"                         , "msg": `file '${project.directory}/MSStd.c' not found`                },
    { "category": "load", "type": "warning", "path": "MyInvalidProject:files:MSStd.h"                         , "msg": `file '${project.directory}/MSStd.h' not found`                },
    { "category": "load", "type": "warning", "path": "MyInvalidProject:files:MSStd_Private.h"                 , "msg": `file '${project.directory}/MSStd_Private.h' not found`        },
    { "category": "load", "type": "warning", "path": "MyInvalidProject:files:MSStdShared.c"                   , "msg": `file '${project.directory}/MSStdShared.c' not found`          },
    { "category": "load", "type": "warning", "path": "MyInvalidProject:files:MSStdShared-win32.c"             , "msg": `file '${project.directory}/MSStdShared-win32.c' not found`    },
    { "category": "load", "type": "warning", "path": "MyInvalidProject:files:MSStdThreads.c"                  , "msg": `file '${project.directory}/MSStdThreads.c' not found`         },
    { "category": "load", "type": "warning", "path": "MyInvalidProject:files:MSStdThreads-win32.c"            , "msg": `file '${project.directory}/MSStdThreads-win32.c' not found`   },
    { "category": "load", "type": "warning", "path": "MyInvalidProject:files:MSStdBacktrace.c"                , "msg": `file '${project.directory}/MSStdBacktrace.c' not found`       },
    { "category": "load", "type": "warning", "path": "MyInvalidProject:files:MSStdBacktrace-win32.c"          , "msg": `file '${project.directory}/MSStdBacktrace-win32.c' not found` },
    { "category": "load", "type": "warning", "path": "MyInvalidProject:files:unix:MSStdTime-unix.c"           , "msg": `file '${project.directory}/MSStdTime-unix.c' not found`       },
    { "category": "load", "type": "warning", "path": "MyInvalidProject:files:unix:MSStdShared-unix.c"         , "msg": `file '${project.directory}/MSStdShared-unix.c' not found`     },
    { "category": "load", "type": "warning", "path": "MyInvalidProject:files:unix:MSStdThreads-unix.c"        , "msg": `file '${project.directory}/MSStdThreads-unix.c' not found`    },
    { "category": "load", "type": "warning", "path": "MyInvalidProject:files:unix:MSStdTime-unix.c"           , "msg": `file '${project.directory}/MSStdTime-unix.c' not found`       },
    { "category": "load", "type": "warning", "path": "MyInvalidProject:files:unix:MSStdShared-unix.c"         , "msg": `file '${project.directory}/MSStdShared-unix.c' not found`     },
    { "category": "load", "type": "warning", "path": "MyInvalidProject:files:unix:MSStdThreads-unix.c"        , "msg": `file '${project.directory}/MSStdThreads-unix.c' not found`    },
    { "category": "load", "type": "error"  , "path": "MyInvalidProject:files.elements[12]"                    , "msg": `conflict with an element defined with the same name: 'unix'`  },
    { "category": "load", "type": "note"   , "path": "MyInvalidProject:files:mman.elements[0].tags"           , "msg": "'tags' could be misused, this key has special meaning for some elements" },
    { "category": "load", "type": "warning", "path": "MyInvalidProject:files:mman:mman.h"                     , "msg": `file '${project.directory}/mman.h' not found`                 },
    { "category": "load", "type": "warning", "path": "MyInvalidProject:files:backtrace:MSStdBacktrace-unix.c" , "msg": `file '${project.directory}/MSStdBacktrace-unix.c' not found`  },
    { "category": "load", "type": "note"   , "path": "MyInvalidProject:files:mman.elements[0].tags"           , "msg": "'tags' could be misused, this key has special meaning for some elements" },
    { "category": "load", "type": "warning", "path": "MyInvalidProject:files:mman:mman.h"                     , "msg": `file '${project.directory}/mman.h' not found`                 },
    { "category": "load", "type": "error"  , "path": "MyInvalidProject:files:mman"                            , "msg": "conflict with an element defined with the same name: 'mman'"  },
    { "category": "load", "type": "error"  , "path": "MyInvalidProject:notanobject.is"                        , "msg": "'is' attribute must be a string"                              },
    { "category": "load", "type": "error"  , "path": "MyInvalidProject:nois.is"                               , "msg": "'is' attribute must be a string"                              },
    { "category": "resolve", "type": "error", "path": "MyInvalidProject:files:mman.elements[1]"               , "msg": "elements must be of the same type, expecting not an element, got file"   },
    { "category": "resolve", "type": "error", "path": "MyInvalidProject:files.elements[14]"                   , "msg": "elements must be of the same type, expecting file, got not an element"   },
    { "category": "resolve", "type": "error", "path": "MyInvalidProject:files:mman.elements[1]"               , "msg": "elements must be of the same type, expecting not an element, got file"   },
    { "category": "resolve", "type": "error", "path": "MyInvalidProject:files.elements[15].elements[0]"       , "msg": "elements must be of the same type, expecting file, got not an element"   },
    { "category": "resolve", "type": "error", "path": "MyInvalidProject:all envs.elements[6]"                 , "msg": "elements must be of the same type, expecting environment, got component" },
  ]);
}
function build_graph(f: Flux<Context>) {
  let reporter = new Reporter();
  let project = f.context.sharedProject;
  let graph = project.buildGraph(reporter, {});
  let targetTasks = Array.from(graph.allTasks());
  assert.deepEqual(reporter.diagnostics, []);
  assert.deepEqual(targetTasks.map(task => task.name), [
    { type: 'target', name: 'MSStd', environment: 'darwin-i386'  , variant: 'debug', project: project.path },
    { type: 'target', name: 'MSStd', environment: 'darwin-x86_64', variant: 'debug', project: project.path },
    { type: 'target', name: 'MSStd', environment: 'linux-i386'   , variant: 'debug', project: project.path },
    { type: 'target', name: 'MSStd', environment: 'linux-x86_64' , variant: 'debug', project: project.path },
    { type: 'target', name: 'MSStd', environment: 'msvc12-i386'  , variant: 'debug', project: project.path },
    { type: 'target', name: 'MSStd', environment: 'msvc12-x86_64', variant: 'debug', project: project.path },
    { type: 'target', name: 'MSStd_static', environment: 'darwin-i386'  , variant: 'debug', project: project.path },
    { type: 'target', name: 'MSStd_static', environment: 'darwin-x86_64', variant: 'debug', project: project.path },
    { type: 'target', name: 'MSStd_static', environment: 'linux-i386'   , variant: 'debug', project: project.path },
    { type: 'target', name: 'MSStd_static', environment: 'linux-x86_64' , variant: 'debug', project: project.path },
    { type: 'target', name: 'MSStd_static', environment: 'msvc12-i386'  , variant: 'debug', project: project.path },
    { type: 'target', name: 'MSStd_static', environment: 'msvc12-x86_64', variant: 'debug', project: project.path },
    { type: 'target', name: 'anotherLib', environment: 'darwin-i386'  , variant: 'debug', project: project.path },
    { type: 'target', name: 'anotherLib', environment: 'darwin-x86_64', variant: 'debug', project: project.path },
    { type: 'target', name: 'anotherLib', environment: 'linux-i386'   , variant: 'debug', project: project.path },
    { type: 'target', name: 'anotherLib', environment: 'linux-x86_64' , variant: 'debug', project: project.path },
    { type: 'target', name: 'anotherLib', environment: 'msvc12-i386'  , variant: 'debug', project: project.path },
    { type: 'target', name: 'anotherLib', environment: 'msvc12-x86_64', variant: 'debug', project: project.path }
  ]);
  let msstd: any = graph.findTask(false, (t: Target) => t.name.name === "MSStd" && t.name.environment === 'darwin-i386')!.attributes;
  assert.strictEqual(msstd.is, 'build-target');
  assert.strictEqual(msstd.name, 'MSStd');
  assert.strictEqual(msstd.type, 'Test');
  assert.strictEqual(msstd.static, false);
  assert.sameMembers(msstd.defines, ["MINGW_HAS_SECURE_API" ]);
  assert.sameMembers(msstd.libraries, ['-lm', '-luuid', '-ldl']);
  assert.sameMembers(msstd.environments.map(e => e.name), ["darwin-i386", "darwin-x86_64", "linux-i386", "linux-x86_64", "msvc12-i386", "msvc12-x86_64"]);
  assert.sameMembers(msstd.files.map(e => e.name), ["MSStdTime.c", "MSStd.c", "MSStdShared.c", "MSStdThreads.c", "MSStdBacktrace.c", "mman.c"]);
  assert.sameMembers(msstd.publicHeaders.map(e => e.name), ["MSStd.h", "mman.h"]);

  msstd = graph.findTask(false, (t: Target) => t.name.name === "MSStd_static" && t.name.environment === 'darwin-i386')!.attributes;
  assert.strictEqual(msstd.is, 'build-target');
  assert.strictEqual(msstd.name, 'MSStd_static');
  assert.strictEqual(msstd.type, 'Test');
  assert.strictEqual(msstd.static, true);
  assert.sameMembers(msstd.defines, ["MINGW_HAS_SECURE_API" ]);
  assert.sameMembers(msstd.libraries, ['-lm', '-luuid', '-ldl']);
  assert.sameMembers(msstd.environments.map(e => e.name), ["darwin-i386", "darwin-x86_64", "linux-i386", "linux-x86_64", "msvc12-i386", "msvc12-x86_64"]);
  assert.sameMembers(msstd.files.map(e => e.name), ["MSStdTime.c", "MSStd.c", "MSStdShared.c", "MSStdThreads.c", "MSStdBacktrace.c", "mman.c"]);
  assert.sameMembers(msstd.publicHeaders.map(e => e.name), ["MSStd.h", "mman.h"]);
  f.continue();
}

function files(f: Flux<Context>) {
  let reporter = new Reporter();
  let project = f.context.sharedProject.tree;
  assert.deepEqual(
    project.resolveElements(reporter, "files?CompileC").map(f => f.name),
    ["MSStdTime.c", "MSStd.c", "MSStdShared.c", "MSStdThreads.c", "MSStdBacktrace.c", "mman.c"]);
  assert.deepEqual(
    project.resolveElements(reporter, "files?Header").map(f => f.name),
    ["MSStd.h", "mman.h"]);
  assert.deepEqual(
    project.resolveElements(reporter, "files:mman?Header").map(f => f.name),
    ["mman.h"]);
  assert.deepEqual(
    project.resolveElements(reporter, "files:unix").map(f => f.name),
    ["MSStdTime-unix.c", "MSStdShared-unix.c", "MSStdThreads-unix.c", "MSStdBacktrace-unix.c"]);
  assert.deepEqual(
    project.resolveElements(reporter, "files:unix:backtrace").map(f => f.name),
    []);
  assert.deepEqual(reporter.diagnostics, [{"type": "warning", "msg": "query 'files:unix:backtrace' refer to an element that can't be found, the group 'files:unix:backtrace' is ignored"}]);
  f.continue();
}
function components(f: Flux<Context>) {
  function simplify(e) {
    var r: any = {};
    Object.assign(r, e);
    r.__parent = r.__parent && r.__parent.name || null;
    return r;
  }
  let reporter = new Reporter();
  let project = f.context.sharedProject.tree;
  /*assert.deepEqual(
    project.resolveElements(reporter, "clang").map(simplify),
    [{ is: 'component', compiler: "clang", tags: ["clang"], mylist: ["v2"], components: [], componentsByEnvironment: {}, name: 'clang', __parent: 'MySimpleProject', __resolved: true }]);
  assert.deepEqual(
    project.resolveElements(reporter, "all envs").map(e => e.name),
    ["darwin-i386", "darwin-x86_64", "linux-i386", "linux-x86_64", "msvc12-i386", "msvc12-x86_64"]);
  assert.deepEqual(
    project.resolveElements(reporter, "darwin-i386").map(simplify),
    [{ is: 'environment', sysroot: "darwin:i386" , mylist: ["v2"], compiler: "clang", components: [], componentsByEnvironment: {}, tags: ["darwin", "i386"],
       name: 'darwin-i386', __parent: 'MySimpleProject', __resolved: true, compatibleEnvironments: [] }]);
  assert.deepEqual(
    project.resolveElements(reporter, "darwin-x86_64").map(simplify),
    [{ is: 'environment', sysroot: "darwin:x86_64" , mylist: ["v2", "v1"], compiler: "clang", components: [], componentsByEnvironment: {}, tags: ["darwin", "x86_64"],
       name: 'darwin-x86_64', __parent: 'MySimpleProject', __resolved: true, compatibleEnvironments: [] }]);*/
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
    { type: 'target', name: 'ATarget', environment: 'msvc12-i386'  , variant: 'debug', project: project2.path },
    { type: 'target', name: 'MSStd', environment: 'msvc12-i386'  , variant: 'debug', project: project.path },
    { type: 'target', name: 'DependencyTestTarget', environment: 'msvc12-i386'  , variant: 'debug', project: project2.path }
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
