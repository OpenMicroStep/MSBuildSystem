var BuildSystem = require('./lib/BuildSystem');
var Workspace = require('./lib/core/Workspace');
var Graph = require('./lib/core/Graph');

global.BuildSystem = BuildSystem;

if(process.argv.length < 2) {
  console.warn("Usage: " + process.argv[0] + " make [options] workspace");
  console.warn("Options:");
  console.warn("  --env=name        Only build the given environment");
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
process.argv.forEach(function(arg) {
  var v;
  if((v = startWith(arg, "--target=")))
    targets.push(v);
  else if((v = startWith(arg, "--env=")))
    environments.push(v);
  else if(arg === "make")
    action = Graph.Action.RUN;
  else if(arg === "clean")
    action = Graph.Action.CLEAN;

});

console.info("Action:", action);
console.info("Workspace:", workspace.path);
console.info("Targets:", targets);
console.info("Environments:", environments);


console.trace("Building workspace graph");
console.time("Built workspace graph");
workspace.buildGraph({
  targets: targets,
  environments: environments
}, function (err, graph) {
  graph.reset();
  if (err) console.error(err);
  else {
    console.time('buildRun');
    console.log(graph.description());
    graph.start(action);
  }
});

