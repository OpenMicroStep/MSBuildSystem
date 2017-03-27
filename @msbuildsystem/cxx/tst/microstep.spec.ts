import {Workspace, Project, Runner, RootGraph, Reporter, Async, Task, Graph} from '@msbuildsystem/core';
import {CXXExecutable, CompileClangTask, LinkLibToolTask, CXXDarwinSysroot} from '@msbuildsystem/cxx';
import {assert} from 'chai';
import * as path from 'path';

function printDiagnostic(d) : string {
  let ret = "";
  if (d.path) {
    ret += d.path;
    if (d.row) {
      ret += ':' + d.row;
      if (d.col)
        ret += ':' + d.col;
    }
    ret += " ";
  }
  ret += d.type + ': ' + d.msg;
  return ret;
}
export function tests() {

  let workspace = new Workspace();
  let project: Project;
  let graph: RootGraph;
  let failed = false;
  it('load msobjclib', () => {
    project = workspace.project("/Users/vincentrouille/Dev/MicroStep/MSFoundation/deps/msobjclib/");
    assert.deepEqual(project.reporter.diagnostics, []);
    failed = failed || project.reporter.failed;
  });
  it('load msstdlib', () => {
    project = workspace.project("/Users/vincentrouille/Dev/MicroStep/MSFoundation/deps/msstdlib/");
    assert.deepEqual(project.reporter.diagnostics, []);
    failed = failed || project.reporter.failed;
  });
  it('load libffi', () => {
    project = workspace.project("/Users/vincentrouille/Dev/MicroStep/MSFoundation/deps/libffi/");
    assert.deepEqual(project.reporter.diagnostics, []);
    failed = failed || project.reporter.failed;
  });
  it('load libuv', () => {
    project = workspace.project("/Users/vincentrouille/Dev/MicroStep/MSFoundation/deps/libuv/");
    assert.deepEqual(project.reporter.diagnostics, []);
    failed = failed || project.reporter.failed;
  });
  it('load MSFoundation', () => {
    project = workspace.project("/Users/vincentrouille/Dev/MicroStep/MSFoundation/");
    assert.deepEqual(project.reporter.diagnostics, []);
    failed = failed || project.reporter.failed;
  });
  it('graph', () => {
    if (failed) return;
    let reporter = new Reporter();
    graph = project.buildGraph(reporter, {
      environments: ["darwin-x86_64", "darwin-x86_64-foundation"],
      targets: ["MSFoundation"]
    });
    assert.deepEqual(reporter.diagnostics, []);
  });
  it('build', (done) => {
    if (failed) return done();
    let runner = new Runner(graph, 'build');
    runner.on("taskbegin", (context) => {
      console.info("BEGIN ", context.task.graph && context.task.target().__path(), context.task.name);
    });
    runner.on("taskend", (context) => {
      console.info("END ", context.reporter.failed ? "KO" : "OK", context.task.graph && context.task.target().__path(), context.task.name, (context.lastRunEndTime - context.lastRunStartTime) + 'ms');
      if (context.reporter.diagnostics.length)
        console.info(context.reporter.diagnostics.map(printDiagnostic).join('\n'));
      if (context.reporter.failed && context.reporter.logs)
        console.warn(context.reporter.logs);
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
