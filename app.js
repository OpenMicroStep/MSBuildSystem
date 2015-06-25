var BuildSystem = require('./lib/BuildSystem');
var Workspace = require('./lib/core/Workspace');
var Graph = require('./lib/core/Graph');

global.BuildSystem = BuildSystem;

if(process.argv.length < 2) {
  console.warn("Usage: " + process.argv[0] + " make|rebuild|clean [options] workspace");
  console.warn("Options:");
  console.warn("  --env=name        Only build the given environment");
  console.warn("  --target=name     Only build the given target");
  console.warn("  --variant=name    Build for the given variant (debug by default)");
}

var workspace = Workspace.getShared(process.argv.pop());

function startWith(arg, str) {
  if(arg.lastIndexOf(str, 0) !== -1) {
    return arg.substr(str.length);
  }
  return null;
}

var action = null;
var environments = [];
var targets = [];
var variant = "debug";
process.argv.forEach(function(arg) {
  var v;
  if((v = startWith(arg, "--target=")))
    targets.push(v);
  else if((v = startWith(arg, "--env=")))
    environments.push(v);
  else if((v = startWith(arg, "--variant=")))
    variant= v;
  else if(arg === "make")
    action = Graph.Action.RUN;
  else if(arg === "rebuild")
    action = Graph.Action.REBUILD;
  else if(arg === "clean")
    action = Graph.Action.CLEAN;
});

console.info("Action:", action);
console.info("Workspace:", workspace.path);
console.info("Targets:", targets);
console.info("Environments:", environments);


console.info("Building compilation graph");
console.time("Built workspace graph");
workspace.buildGraph({
  variant:variant,
  targets: targets,
  environments: environments
}, function (err, graph) {
  console.timeEnd("Built workspace graph");
  if (err) console.error(err.stack);
  else {
    graph.reset();
    console.time('buildRun');
    //console.info(graph.description());
    console.info("Compiling...");
    graph.start(action, function(task) {
      if(task.errors)
        console.error("%s Failed", Graph.Action[action]);
      else
        console.info("%s Succeded", Graph.Action[action]);
      process.exitCode = task.errors;

    });
  }
});

