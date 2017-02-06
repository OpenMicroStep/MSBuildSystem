import {Workspace, Project, Runner, RunnerContext, RootGraph, Reporter, File, Async, Task, TGraph, Flux} from '@msbuildsystem/core';
import {ParseAspectInterfaceTask} from '@msbuildsystem/aspects';
import {assert} from 'chai';
import * as path from 'path';
import * as fs from 'fs';

function simple_local(f: Flux<RunnerContext>) {
  let w = Workspace.createTemporary();
  let g = new RootGraph(w);
  let task = new ParseAspectInterfaceTask(g, {
    values: [File.getShared(path.join(__dirname, 'data/simple_local.md'), true)],
    ext: { header: '', customHeader: '' }
  }, File.getShared(path.join(w.directory, 'simple_local'), true));
  let runner = new Runner(g, 'build');
  runner.on('taskend', (ctx) => {
    if (ctx.task === task)
      assert.deepEqual(ctx.reporter.diagnostics, []);
  });
  f.setFirstElements([
    f => runner.run(f),
    f => {
      assert.equal(f.context.failed, false);
      assert.deepEqual(
        fs.readFileSync(path.join(w.directory, 'simple_local/aspects.interfaces.ts'), 'utf8'),
        fs.readFileSync(path.join(__dirname, 'data/simple_local.ts'), 'utf8'));
      f.continue();
    }
  ]);
  f.continue();
}

export const tests = {
  name: 'parse interface',
  tests: [
    simple_local
  ]
};
