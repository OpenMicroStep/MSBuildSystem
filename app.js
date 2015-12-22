var BuildSystem = require('./out/buildsystem/BuildSystem');
var Workspace = require('./out/buildsystem/core/Workspace');
var Graph = require('./out/buildsystem/core/Graph');

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
var variants = [];
process.argv.forEach(function(arg) {
  var v;
  if((v = startWith(arg, "--target=")))
    targets.push(v);
  else if((v = startWith(arg, "--env=")))
    environments.push(v);
  else if((v = startWith(arg, "--variant=")))
    variants.push(v);
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
console.info("Variants:", variants);


console.info("Building compilation graph");
console.time("Built workspace graph");

// This VM provide i386 & x86_64 linker/masm
var Provider = require('./out/buildsystem/core/Provider');

// TODO: move this a better place
// Default OSX 10.10 compiler & linker
Provider.register(new Provider.Process("clang", { type:"compiler", compiler:"clang", version:"3.6"}));
Provider.register(new Provider.Process("libtool", { type:"linker", linker:"libtool", version:"870"}));

var end = function() {};
if (1) {
  // Trunk version of clang for msvc support
  Provider.register(new Provider.Process("/Users/vincentrouille/Dev/MicroStep/llvm/build-release/bin/clang", { type:"compiler", compiler:"clang", version:"3.7"}));
  Provider.register(new Provider.Process("/Users/vincentrouille/Dev/MicroStep/llvm/build-release/bin/llvm-link", { type:"llvm-link", version:"3.7"}));
  var client = new Provider.RemoteClient("ws://10.211.55.16:2346");
  client.socket.once("ready", ready);
  end = function() {
    client.socket.webSocket.close();
  };
}
else {
  ready();
}

function ready() {
  workspace.buildGraph({
    variant:variants,
    targets: targets,
    environments: environments
  }, function (err, graph) {
    console.timeEnd("Built workspace graph");
    if (err) {
      console.error(err.stack || err);
      end();
    }
    else {
      graph.reset();
      console.time('buildRun');
      //console.info(graph.description());
      console.info("Compiling...");
      graph.start(action, function(task) {
        if(task.errors)
          console.error("%s Failed", Graph.Action[action]);
        else
          console.info("%s Succeeded", Graph.Action[action]);
        process.exitCode = task.errors;
        end();
      });
    }
  });
}


