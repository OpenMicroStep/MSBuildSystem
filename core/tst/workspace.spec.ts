import {Workspace} from '@openmicrostep/msbuildsystem.core';
import {assert} from 'chai';
import * as path from 'path';
import * as fs from 'fs';

function defaultDirectory() {
  let workspace = new Workspace();
  assert.isTrue(workspace.isDirectoryPendingResolution());
  let project = workspace.project(path.join(__dirname, "data/simple-project"));
  assert.isTrue(workspace.isDirectoryPendingResolution());
  workspace.fixDirectoryPendingResolution();
  assert.isFalse(workspace.isDirectoryPendingResolution());
  assert.deepEqual(workspace.reporter.diagnostics, []);
  assert.sameMembers(Array.from(workspace.projects.values()), [project]);
  assert.deepEqual(workspace.targets().map(t => t.toJSON().name), ["MSStd", "MSStd_static", "anotherLib"]);
  workspace.clear();
  assert.strictEqual(workspace.projects.size, 0);
}

function save_load() {
  let workspaceSave = Workspace.createTemporary();
  assert.isFalse(workspaceSave.isDirectoryPendingResolution());
  let project = workspaceSave.project(path.join(__dirname, "data/simple-project"));
  assert.sameMembers(Array.from(workspaceSave.projects.values()), [project]);
  workspaceSave.save();
  assert.sameMembers(Array.from(workspaceSave.projects.values()), [project]);
  let content = JSON.parse(fs.readFileSync(path.join(workspaceSave.directory, 'workspace.json'), 'utf8'));
  assert.deepEqual(content, { projects: [path.relative(workspaceSave.directory, project.directory)] });

  let workspaceLoad = new Workspace(workspaceSave.directory);
  assert.strictEqual(workspaceLoad.projects.size, 1);
  let p2 = workspaceLoad.projects.values().next().value;
  assert.deepEqual(p2.definition, project.definition);

  workspaceSave.clear();
}

export const tests = { name: 'workspace', tests: [
  defaultDirectory,
  save_load
] };
