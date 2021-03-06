import {Task, Graph, RootGraph, Workspace} from '@openmicrostep/msbuildsystem.core';
import {assert} from 'chai';

function simple_graph() {
  var r = new RootGraph(new Workspace());
  var g = new Graph({ name: "root", type: "test" }, r);
  var t1 = new Task({ name: 't1', type: "test" }, g);
  var t2 = new Task({ name: 't2', type: "test" }, g);
  var t3 = new Task({ name: 't3', type: "test" }, g);
  t2.addDependency(t1);
  t3.addDependency(t1);
  var tasks = Array.from(g.allTasks(true));
  assert.sameMembers(tasks, [t1, t2, t3]);
  assert.sameMembers(Array.from(g.inputs), [t1]);
  var i = 0;
  g.iterate(true, (task) => {
    assert.equal(task, tasks[i++]);
    return true;
  });
  assert.equal(g.findTask(true, t => t.name.name === t3.name.name), t3);
}

export const tests = [
  { name: "simple graph", test: simple_graph },
];
