Runner
======

The runner class is designed to execute `do(flux, action)` on the graph.   
The whole execution state is stored by the runner, the graph is left untouched.  
It allow selecting multiple branches of the graph to limit the executed set of tasks.   
The `root` task is always enabled.

Methods
-------

### Creation & configuration

#### `constructor(root: Task, action: string)`

Create a new `Runner` for the given graph and action.   

#### `enable(task: Task)`

Enable the given `task`.   
If the branch that contains `task` is already enabled, do nothing.   
Remove from enabled branches contained by `task` and it to `enabled` list.

#### `run(p: Flux<RunnerContext>)`

Execute `action` on the selected part of the graph.

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
