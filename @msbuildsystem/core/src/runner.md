Runner
======

The runner class is designed to execute `do(flux, action)` on the graph.   
The whole execution state is stored by the runner, the graph is left untouched.  
It allow selecting multiple branches of the graph to limit the executed set of tasks.   
The `root` task is always enabled.

There is two way to execute an action: `run` and `runWithMapReduce`.

The map/reduce way is usefull for creating tools around the build graph (ie. generating ide files, autocompletion, ...).
This approach allow to write tool easilly without creating heavy synchronous by design workload on the build graph.
In the long run, big build graph could be shared accross multiple workers and the map/reduce work could then be dispatched with ease.

Configuration
-------------

#### `maxConcurrentTasks: number`

Global maximum number of tasks allowed to run at the same time.   
Defaults to the number of CPU cores available.

Methods
-------

### Creation & configuration

#### `constructor(root: Task, action: string, options: { [s: string]: any } = {})`

Create a new `Runner` for the given _graph_, _action_ and optionally some _options_.
By default the whole _root_ graph is enabled until graph branchs start to be enabled separately.

#### `enable(task: Task)`

Enable the given _task_.   

If the branch that contains _task_ is already enabled, do nothing.   
Remove enabled branches contained by _task_ and add _task_ to `enabled` list.

#### `run(p: Flux<RunnerContext>)`

Execute `action` with `options` on the enabled part of the graph.

#### `runWithMapReduce<V, K>(p: Flux<RunnerContext>, provider: TaskDoMapReduce<V, K>)`

Execute `action` on the selected part of the graph.
Upon the execution of the action, if the property `value` of the task context is not _undefined_, this value will be mapped then reduced.
If the provider supply a `run` method, it will be executed in a task like context for each reduced value.
If the provider property `returnValues` is _true_, then the list of reduced values will be returned in the `values` property of the flux context.

#### `on(event: "taskbegin", listener: (ctx: StepContext<any, any>) => void) : this`

Add a listener to task startup events.

#### `on(event: "taskend", listener: (ctx: StepContext<any, any>) => void) : this`

Add a listener to task termination events.


Properties
----------

#### `root: Task`

The root element of execution graph.

#### `action: string`

The action to execute

#### `enabled: Set<Task>`

The list of enabled graph nodes.   
If empty, this means the whole graph is executed.      
Otherwise, this is the list of non related branches to execute.
