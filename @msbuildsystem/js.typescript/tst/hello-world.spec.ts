import {Workspace, Project, Runner, RootGraph, Reporter, File, Async, Task, Graph, Flux} from '@openmicrostep/msbuildsystem.core';
import {JSTarget, DefaultJSPackager} from '@openmicrostep/msbuildsystem.js';
import {TypescriptCompiler, TypescriptTask} from '@openmicrostep/msbuildsystem.js.typescript';
import {assert} from 'chai';
import * as path from 'path';

type Context = {
  workspace: Workspace;
  sharedProject: Project;
  graph: RootGraph;
}

function load(f: Flux<Context>) {
  f.context.workspace = new Workspace();
  let project = f.context.workspace.project(__dirname + "/data/hello-world");
  f.context.sharedProject = project;
  assert.equal(project.definition!.name, 'Hello World');
  assert.deepEqual(project.reporter.diagnostics.map(d => { if (d.path) d.path = path.relative(project.directory, d.path); return d; }), [
  ]);
  f.continue();
}
function graph(f: Flux<Context>) {
  let reporter = new Reporter();
  let graph = f.context.graph = f.context.sharedProject.buildGraph(reporter, {});
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
      t instanceof Graph && { "children":  Array.from(t.allTasks(false)).map(info) }
    );
  }
  let tree = targets.map(info);
  assert.deepEqual(reporter.diagnostics, []);
  assert.deepEqual(tree, [
    {
      "constructor": JSTarget,
      "environment": "ts",
      "name": "Hello World",
      "project": f.context.sharedProject.path,
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
        },
        {
          "constructor": DefaultJSPackager,
          "name": "javascript default",
          "type": "packager",
          "children": []
        }
      ]
    }
  ]);
  f.continue();
}
function build(f: Flux<Context>) {
  let runner = new Runner(f.context.graph, 'build');
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
      f.continue();
    }
  ]);
}

export const tests = {
  name: 'helloworld',
  tests: [
    { name: 'load', test: load },
    { name: 'graph', test: graph },
    { name: 'build', test: build }
  ]
};
