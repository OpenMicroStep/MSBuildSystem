import {Workspace, Project, Runner, RootGraph, Reporter, File, Async, Task, TGraph} from '@msbuildsystem/core';
import {CXXExecutable, CompileClangTask, LinkLibToolTask, CXXDarwinSysroot} from '@msbuildsystem/cxx';
import {assert} from 'chai';
import * as path from 'path';

export function tests() {

  let workspace = new Workspace();
  let project: Project;
  let graph: RootGraph;
  it('load', () => {
    project = workspace.project(__dirname + "/data/hello-world");
    assert.equal(project.definition!.name, 'Hello World');
    assert.deepEqual(project.reporter.diagnostics.map(d => { if (d.path) d.path = path.relative(project.directory, d.path); return d; }), [
    ]);
  });
  it('graph', () => {
    let reporter = new Reporter();
    graph = project.buildGraph(reporter, {});
    let targets = Array.from(graph.allTasks());
    targets.forEach((t: CXXExecutable) => {
      let files = t.files.keys();
      for (let file of files)
        assert.instanceOf(file, File);
    });
    function info(t: Task) {
      return Object.assign(
        {"constructor": t.constructor},
        t.name,
        t instanceof TGraph && { "children":  Array.from(t.allTasks(false)).map(info) }
      );
    }
    let tree = targets.map(info);
    assert.deepEqual(reporter.diagnostics, []);
    assert.deepEqual(tree, [
      {
        "constructor": CXXExecutable,
        "environment": "darwin-i386",
        "name": "Hello World",
        "project": project.path,
        "type": "target",
        "variant": "debug",
        "children": [
          {
            "constructor": CXXDarwinSysroot,
            "name": "darwin",
            "type": "sysroot",
            "children": [
              { "constructor": CompileClangTask, "name": "main.c", "type": "cxxcompile" },
              { "constructor": LinkLibToolTask, "name": "Hello World", "type": "link" }
            ]
          }
        ]
      },
      {
        "constructor": CXXExecutable,
        "environment": "darwin-x86_64",
        "name": "Hello World",
        "project": project.path,
        "type": "target",
        "variant": "debug",
        "children": [
          {
            "constructor": CXXDarwinSysroot,
            "name": "darwin",
            "type": "sysroot",
            "children": [
              { "constructor": CompileClangTask, "name": "main.c", "type": "cxxcompile" },
              { "constructor": LinkLibToolTask, "name": "Hello World", "type": "link" }
            ]
          }
        ]
      }
    ]);
  });
  it('build', (done) => {
    let runner = new Runner(graph, 'build');
    runner.enable(graph);
    runner.on('taskend', (context) => {
      if (context.reporter.failed && context.reporter.logs)
        console.warn(context.reporter.logs);
      assert.deepEqual(context.reporter.diagnostics, []);
      assert.equal(context.reporter.failed, false);
    });
    Async.run<{ runner: Runner }>(null, [
      (p) => { runner.run(p); },
      (p) => {
        assert.equal(runner, p.context.runner);
        assert.equal(runner.failed, false);
        done();
      }
    ]);
  });

}
