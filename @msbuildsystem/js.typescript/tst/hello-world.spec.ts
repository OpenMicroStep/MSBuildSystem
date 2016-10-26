import {Workspace, Project, Runner, RootGraph, Reporter, File, Async, Task, TGraph} from '@msbuildsystem/core';
import {CopyTask} from '@msbuildsystem/foundation';
import {JSTarget} from '@msbuildsystem/js';
import {TypescriptCompiler, TypescriptTask} from '@msbuildsystem/js.typescript';
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
    targets.forEach((t: JSTarget) => {
      let files = t.files;
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
        "constructor": JSTarget,
        "environment": "ts",
        "name": "Hello World",
        "project": project.path,
        "type": "target",
        "variant": "debug",
        "children": [
          {
            "constructor": TypescriptCompiler,
            "name": "typescript",
            "type": "compiler",
            "children": [
              {
                "constructor": TypescriptTask,
                "name": "tsc",
                "type": "typescript"
              }
            ]
          }
        ]
      }
    ]);
  });
  it('build', (done) => {
    let runner = new Runner(graph, 'build');
    runner.on('taskend', (context) => {
      if (context.reporter.failed && context.reporter.logs)
        console.warn(context.reporter.logs);
      assert.deepEqual(context.reporter.diagnostics, []);
      assert.equal(context.reporter.failed, false);
    });
    Async.run<{ runner: Runner, failed: boolean }>(null, [
      (p) => { runner.run(p); },
      (p) => {
        assert.equal(runner, p.context.runner);
        assert.equal(p.context.failed, false);
        done();
      }
    ]);
  });
}
