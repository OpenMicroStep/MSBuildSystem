import {Workspace, Project, Runner, RootGraph, Reporter, Target, File, Async} from '@msbuildsystem/core';
import {CXXExecutable, CompileClangTask, LinkLibToolTask} from '@msbuildsystem/cxx';
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
    let tree = targets.map((t: Target) => {
      return Object.assign({
        "cstor": t.constructor,
        "graph" : Array.from(t.allTasks(true)).map(t => Object.assign({ "cstor": t.constructor }, t.name))
      }, t.name);
    });
    assert.deepEqual(reporter.diagnostics, []);
    assert.deepEqual(tree, [
      {
        "cstor": CXXExecutable,
        "environment": "darwin-i386",
        "name": "Hello World",
        "project": project.path,
        "type": "target",
        "variant": "debug",
        "graph": [
          { "cstor": CompileClangTask, "name": "main.c", "type": "cxxcompile" },
          { "cstor": LinkLibToolTask, "name": "Hello World", "type": "link" }
        ]
      },
      {
        "cstor": CXXExecutable,
        "environment": "darwin-x86_64",
        "name": "Hello World",
        "project": project.path,
        "type": "target",
        "variant": "debug",
        "graph": [
          { "cstor": CompileClangTask, "name": "main.c", "type": "cxxcompile" },
          { "cstor": LinkLibToolTask, "name": "Hello World", "type": "link" }
        ]
      }
    ]);
  });
  it('build', (done) => {
    let runner = new Runner(graph, 'build');
    runner.enable(graph);
    Async.run(null, [
      runner.run.bind(runner),
      done
    ]);
  });

}
