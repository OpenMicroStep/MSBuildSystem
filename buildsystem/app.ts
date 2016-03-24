import BuildSystem = require('./BuildSystem');
import Workspace = require('./core/Workspace');
import Graph = require('./core/Graph');
import Async = require('./core/Async');
import Runner = require('./core/Runner');

(<any>global).BuildSystem = BuildSystem;

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
    action = "build";
  else if(arg === "clean")
    action = "clear";
});
console.info("Action:", action);
console.info("Workspace:", workspace.path);
console.info("Targets:", targets);
console.info("Environments:", environments);
console.info("Variants:", variants);

// This VM provide i386 & x86_64 linker/masm
var Provider = require('./core/Provider');

var end = function() {};
if (0) {
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
  Async.run(null, [
    (p) => {
      p.context.t0 = BuildSystem.util.timeElapsed("Built workspace graph");
      workspace.buildGraph(p, {
        variants:variants,
        targets: targets,
        environments: environments
      });
    },
    (p) => {
      p.context.t0();
      if (p.context.error) {
        var err = p.context.error;
        console.error(err.stack || err);
        p.continue();
      }
      else {
        var graph: Graph = p.context.root;
        var runner = new Runner(graph, action);
        runner.enable(graph);
        console.info("Building...");
        runner.run(p);
      }
    },
    (p) => {
      var errors = p.context.step.errors;
      if(errors)
         console.error("%s Failed with %d errors", action, errors.length);
      else
        console.info("%s Succeeded", action);
      (<any>process).exitCode = errors.length;
      p.continue();
    }
  ]);
}
