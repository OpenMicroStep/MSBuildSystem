import {Workspace, Project, Reporter, Target, declareTarget} from '@msbuildsystem/core';
import {assert} from 'chai';
import * as path from 'path';

@declareTarget({ type: "Test" })
export class TestTarget extends Target {
}

export function tests() {

let workspace = new Workspace();
let sharedProject: Project | null = null;
it('load valid simple', () => {
  let projectPath = path.normalize(__dirname + "/data/simple-project/make.js");
  let project = sharedProject = workspace.project(__dirname + "/data/simple-project");
  assert.equal(project.directory, path.normalize(__dirname + "/data/simple-project"));
  assert.equal(project.path, projectPath);
  assert.equal(project.definition!.name, 'MySimpleProject');
  assert.equal(project, workspace.project(__dirname + "/data/simple-project"), "two project at the same path share the same instance");
  assert.deepEqual(project.reporter.diagnostics.map(d => { if (d.path) d.path = path.relative(project.directory, d.path); return d;}), [
    { "msg": "'MySimpleProject:files.elements[0]' refer to a file that can't be found", "path": "MSStdTime.c", "type": "warning" },
    { "msg": "'MySimpleProject:files.elements[1]' refer to a file that can't be found", "path": "MSStdTime-win32.c", "type": "warning" },
    { "msg": "'MySimpleProject:files.elements[2]' refer to a file that can't be found", "path": "MSStd.c", "type": "warning" },
    { "msg": "'MySimpleProject:files.elements[3]' refer to a file that can't be found", "path": "MSStd.h", "type": "warning" },
    { "msg": "'MySimpleProject:files.elements[4]' refer to a file that can't be found", "path": "MSStd_Private.h", "type": "warning" },
    { "msg": "'MySimpleProject:files.elements[5]' refer to a file that can't be found", "path": "MSStdShared.c", "type": "warning" },
    { "msg": "'MySimpleProject:files.elements[6]' refer to a file that can't be found", "path": "MSStdShared-win32.c", "type": "warning" },
    { "msg": "'MySimpleProject:files.elements[7]' refer to a file that can't be found", "path": "MSStdThreads.c", "type": "warning" },
    { "msg": "'MySimpleProject:files.elements[8]' refer to a file that can't be found", "path": "MSStdThreads-win32.c", "type": "warning" },
    { "msg": "'MySimpleProject:files.elements[9]' refer to a file that can't be found", "path": "MSStdBacktrace.c", "type": "warning" },
    { "msg": "'MySimpleProject:files.elements[10]' refer to a file that can't be found", "path": "MSStdBacktrace-win32.c", "type": "warning" },
    { "msg": "'MySimpleProject:files.elements[11].elements[0]' refer to a file that can't be found", "path": "MSStdTime-unix.c", "type": "warning" },
    { "msg": "'MySimpleProject:files.elements[11].elements[1]' refer to a file that can't be found", "path": "MSStdShared-unix.c", "type": "warning" },
    { "msg": "'MySimpleProject:files.elements[11].elements[2]' refer to a file that can't be found", "path": "MSStdThreads-unix.c", "type": "warning" },
    { "msg": "'MySimpleProject:files:backtrace.elements[0]' refer to a file that can't be found", "path": "MSStdBacktrace-unix.c", "type": "warning" },
    { "msg": "'MySimpleProject:files:mman.elements[0]' refer to a file that can't be found", "path": "mman.c", "type": "warning" },
    { "msg": "'MySimpleProject:files:mman.elements[1]' refer to a file that can't be found", "path": "mman.h", "type": "warning" },
  ]);
});
it('load invalid', () => {
  let workspace = new Workspace();
  let projectPath = path.normalize(__dirname + "/data/bad-project/make.js");
  let project = workspace.project(__dirname + "/data/bad-project");
  assert.equal(project.directory, path.normalize(__dirname + "/data/bad-project"));
  assert.equal(project.path, projectPath);
  assert.equal(project.definition!.name, 'MyInvalidProject');
  assert.deepEqual(project.reporter.diagnostics.map(d => { if (d.path) d.path = path.relative(project.directory, d.path); return d;}), [
    { "msg": "'MyInvalidProject:files.elements[0]' refer to a file that can't be found", "path": "MSStdTime.c", "type": "warning" },
    { "msg": "'MyInvalidProject:files.elements[1]' refer to a file that can't be found", "path": "MSStdTime-win32.c", "type": "warning" },
    { "msg": "'MyInvalidProject:files.elements[2]' refer to a file that can't be found", "path": "MSStd.c", "type": "warning" },
    { "msg": "'MyInvalidProject:files.elements[3]' refer to a file that can't be found", "path": "MSStd.h", "type": "warning" },
    { "msg": "'MyInvalidProject:files.elements[4]' refer to a file that can't be found", "path": "MSStd_Private.h", "type": "warning" },
    { "msg": "'MyInvalidProject:files.elements[5]' refer to a file that can't be found", "path": "MSStdShared.c", "type": "warning" },
    { "msg": "'MyInvalidProject:files.elements[6]' refer to a file that can't be found", "path": "MSStdShared-win32.c", "type": "warning" },
    { "msg": "'MyInvalidProject:files.elements[7]' refer to a file that can't be found", "path": "MSStdThreads.c", "type": "warning" },
    { "msg": "'MyInvalidProject:files.elements[8]' refer to a file that can't be found", "path": "MSStdThreads-win32.c", "type": "warning" },
    { "msg": "'MyInvalidProject:files.elements[9]' refer to a file that can't be found", "path": "MSStdBacktrace.c", "type": "warning" },
    { "msg": "'MyInvalidProject:files.elements[10]' refer to a file that can't be found", "path": "MSStdBacktrace-win32.c", "type": "warning" },
    { "msg": "'MyInvalidProject:files.elements[11].elements[0]' refer to a file that can't be found", "path": "MSStdTime-unix.c", "type": "warning" },
    { "msg": "'MyInvalidProject:files.elements[11].elements[1]' refer to a file that can't be found", "path": "MSStdShared-unix.c", "type": "warning" },
    { "msg": "'MyInvalidProject:files.elements[11].elements[2]' refer to a file that can't be found", "path": "MSStdThreads-unix.c", "type": "warning" },
    { "msg": "'MyInvalidProject:files.elements[12].elements[0]' refer to a file that can't be found", "path": "MSStdTime-unix.c", "type": "warning" },
    { "msg": "'MyInvalidProject:files.elements[12].elements[1]' refer to a file that can't be found", "path": "MSStdShared-unix.c", "type": "warning" },
    { "msg": "'MyInvalidProject:files.elements[12].elements[2]' refer to a file that can't be found", "path": "MSStdThreads-unix.c", "type": "warning" },
    { "msg": "'MyInvalidProject:files.elements[12]' attribute is in conflict with an element defined with the same name", "type": "error", },
    { "msg": "'MyInvalidProject:files.elements[15].elements[0].is' attribute must be a string", "type": "error", },
    { "msg": "'MyInvalidProject:files.elements[15].elements[1]' refer to a file that can't be found", "path": "mman.h", "type": "warning" },
    { "msg": "'MyInvalidProject:files:backtrace.elements[0]' refer to a file that can't be found", "path": "MSStdBacktrace-unix.c", "type": "warning" },
    { "msg": "'MyInvalidProject:files:mman.elements[0].is' attribute must be a string", "type": "error" },
    { "msg": "'MyInvalidProject:files:mman.elements[1]' refer to a file that can't be found", "path": "mman.h", "type": "warning" },
    { "msg": "'MyInvalidProject:files:mman' attribute is in conflict with an element defined with the same name", "type": "error", },
    { "msg": "'MyInvalidProject:notanobject.is' attribute must be a string", "type": "error", },
    { "msg": "'MyInvalidProject:nois.is' attribute must be a string", "type": "error", },
    { "msg": "'MyInvalidProject:all envs.elements' must only contains elements of the same type, expecting environment, got component", "type": "error"}
  ]);
});
it('files', () => {
  let reporter = new Reporter();
  let project = sharedProject!;
  assert.deepEqual(
    project.resolveFiles(reporter, "files?CompileC").map(f => f.name),
    ["MSStdTime.c", "MSStd.c", "MSStdShared.c", "MSStdThreads.c", "MSStdBacktrace.c", "mman.c"]);
  assert.deepEqual(
    project.resolveFiles(reporter, "files?Header").map(f => f.name),
    ["MSStd.h", "mman.h"]);
  assert.deepEqual(
    project.resolveFiles(reporter, "files:mman?Header").map(f => f.name),
    ["mman.h"]);
  assert.deepEqual(
    project.resolveFiles(reporter, "files:unix").map(f => f.name),
    ["MSStdTime-unix.c", "MSStdShared-unix.c", "MSStdThreads-unix.c", "MSStdBacktrace-unix.c"]);
  assert.deepEqual(
    project.resolveFiles(reporter, "files:unix:backtrace").map(f => f.name),
    []);
  assert.deepEqual(reporter.diagnostics, [{"type": "warning", "msg": "query 'files:unix:backtrace' refer to a group that can't be found, the group 'files:unix:backtrace' is ignored"}]);
});
it('components', () => {
  function simplify(e) {
    var r: any = {};
    Object.assign(r, e);
    r.__parent = r.__parent && r.__parent.name || null;
    return r;
  }
  let reporter = new Reporter();
  let project = sharedProject!;
  assert.deepEqual(
    project.resolveElements(reporter, "clang").map(simplify),
    [{ is: 'component', compiler: "clang", tags: ["clang"], mylist: ["v2"], components: [], name: 'clang', __parent: 'MySimpleProject', __resolved: true }]);
  assert.deepEqual(
    project.resolveElements(reporter, "all envs").map(e => e.name),
    ["darwin-i386", "darwin-x86_64", "linux-i386", "linux-x86_64", "msvc12-i386", "msvc12-x86_64"]);
 assert.deepEqual(
    project.resolveElements(reporter, "darwin-i386").map(simplify),
    [{ is: 'environment', sysroot: "darwin:i386" , mylist: ["v2"], compiler: "clang", components: project.resolveElements(reporter, "clang"), tags: ["darwin", "i386"],
       name: 'darwin-i386', __parent: 'MySimpleProject', __resolved: true, compatibleEnvironments: [] }]);
 assert.deepEqual(
    project.resolveElements(reporter, "darwin-x86_64").map(simplify),
    [{ is: 'environment', sysroot: "darwin:x86_64" , mylist: ["v1", "v2"], compiler: "clang", components: project.resolveElements(reporter, "clang"), tags: ["darwin", "x86_64"],
       name: 'darwin-x86_64', __parent: 'MySimpleProject', __resolved: true, compatibleEnvironments: [] }]);
  let msstds = project.resolveElements(reporter, "MSStd");
  assert.strictEqual(msstds.length, 1);
  let msstd: any = msstds[0];
  assert.strictEqual(msstd.is, 'target');
  assert.strictEqual(msstd.name, 'MSStd');
  assert.strictEqual(msstd.type, 'Test');
  assert.strictEqual(msstd.static, false);
  assert.sameMembers(msstd.defines, ["MINGW_HAS_SECURE_API" ]);
  assert.sameMembers(msstd.libraries, ['-lm', '-luuid', '-ldl']);
  assert.sameMembers(msstd.environments.map(e => e.name), ["darwin-i386", "darwin-x86_64", "linux-i386", "linux-x86_64", "msvc12-i386", "msvc12-x86_64"]);
  assert.sameMembers(msstd.files.map(e => e.name), ["MSStdTime.c", "MSStd.c", "MSStdShared.c", "MSStdThreads.c", "MSStdBacktrace.c", "mman.c"]);
  assert.sameMembers(msstd.publicHeaders.map(e => e.name), ["MSStd.h", "mman.h"]);

  msstds = project.resolveElements(reporter, "MSStd_static");
  assert.strictEqual(msstds.length, 1);
  msstd = msstds[0];
  assert.strictEqual(msstd.is, 'target');
  assert.strictEqual(msstd.name, 'MSStd_static');
  assert.strictEqual(msstd.type, 'Test');
  assert.strictEqual(msstd.static, true);
  assert.sameMembers(msstd.defines, ["MINGW_HAS_SECURE_API" ]);
  assert.sameMembers(msstd.libraries, ['-lm', '-luuid', '-ldl']);
  assert.sameMembers(msstd.environments.map(e => e.name), ["darwin-i386", "darwin-x86_64", "linux-i386", "linux-x86_64", "msvc12-i386", "msvc12-x86_64"]);
  assert.sameMembers(msstd.files.map(e => e.name), ["MSStdTime.c", "MSStd.c", "MSStdShared.c", "MSStdThreads.c", "MSStdBacktrace.c", "mman.c"]);
  assert.sameMembers(msstd.publicHeaders.map(e => e.name), ["MSStd.h", "mman.h"]);

  assert.deepEqual(reporter.diagnostics, []);
});
it('build graph', () => {
  let reporter = new Reporter();
  let project = sharedProject!;
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
});

it('with external dependencies', () => {
  let projectPath = path.normalize(__dirname + "/data/simple-project-dep/make.js");
  let project2 = workspace.project(__dirname + "/data/simple-project-dep");
  let project = sharedProject!;
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
});

}
