import {Workspace, Project, Runner, RootGraph, Reporter, File, Async, Task, Graph, Flux, Target} from '@openmicrostep/msbuildsystem.core';
import {CXXExecutable, CompileClangTask, LinkLibToolTask, CXXDarwinSysroot} from '@openmicrostep/msbuildsystem.cxx';
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
  assert.deepEqual(project.reporter.diagnostics, []);
  assert.equal(project.definition!.name, 'Hello World');
  f.continue();
}
function graph(f: Flux<Context>) {
  let reporter = new Reporter();
  let project = f.context.sharedProject;
  let graph = f.context.graph = project.buildGraph(reporter, {});
  let targets = Array.from(graph.allTasks());
  targets.forEach((t: CXXExecutable) => {
    let files = t.files.keys();
    for (let file of files)
      assert.instanceOf(file, File);
  });
  function info(t: Task) {
    return Object.assign(
      {"constructor": t.constructor.name},
      t.name,
      t instanceof Graph && { "children":  Array.from(t.allTasks(false)).map(info) }
    );
  }
  let tree = targets.map(info);
  assert.deepEqual(reporter.diagnostics, []);

  assert.deepEqual(tree, [
    {
      "constructor": "CXXExecutable",
      "environment": "darwin-i386",
      "name": "Hello World",
      "project": project.path,
      "type": "target",
      "variant": "debug",
      "children": [
        {
          "constructor": "CXXDarwinSysroot",
          "name": "darwin",
          "type": "sysroot",
          "children": [
            { "constructor": "CompileClangTask", "name": "main.c", "type": "cxxcompile" },
            { "constructor": "LinkClangTask", "name": "Hello World", "type": "link" }
          ]
        },
        {
          "constructor": "GenerateExports",
          "name": "Hello World",
          "type": "exports"
        }
      ]
    },
    {
      "constructor": "CXXExecutable",
      "environment": "darwin-x86_64",
      "name": "Hello World",
      "project": project.path,
      "type": "target",
      "variant": "debug",
      "children": [
        {
          "constructor": "CXXDarwinSysroot",
          "name": "darwin",
          "type": "sysroot",
          "children": [
            { "constructor": "CompileClangTask", "name": "main.c", "type": "cxxcompile" },
            { "constructor": "LinkClangTask", "name": "Hello World", "type": "link" }
          ]
        },
        {
          "constructor": "GenerateExports",
          "name": "Hello World",
          "type": "exports"
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

export const tests = [
  { name: 'load' , test: load  },
  { name: 'graph', test: graph },
  { name: 'build', test: build },
];
