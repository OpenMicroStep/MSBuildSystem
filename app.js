var BuildSystem = require('./lib/BuildSystem');
var Workspace = require('./lib/core/Workspace');
var TaskGraph = require('./lib/core/Task').Graph;
var Runner = require('./lib/core/Task').Runner;

global.BuildSystem = BuildSystem;

if(process.argv.length < 2) {
  console.warn("Usage: " + process.argv[0] + " make [options] workspace");
  console.warn("Options:");
  console.warn("  --target=name        Only build the given target");
  console.warn("  --toolchain=name     Name of the toolchain to use for the build, if given multiple times, then multiple toolchains are used for the build");
  console.warn("  --livebuild          Watch for file change and rebuild every times it's needed");
}

var workspace = Workspace.getShared(process.argv.pop());

function startWith(arg, str) {
  if(arg.lastIndexOf(str, 0) !== -1) {
    return arg.substr(str.length);
  }
  return null;
}

var action = null;
var toolchains = [];
var targets = [];
process.argv.forEach(function(arg) {
  var v;
  if((v = startWith(arg, "--target=")))
    targets.push(v);
  else if((v = startWith(arg, "--toolchain=")))
    toolchains.push(v);
  else if(arg === "make")
    action = "run";
  else if(arg === "clean")
    action = "clean";

});

console.info("Action:", action);
console.info("Workspace:", workspace.path);
console.info("Targets:", targets);
console.info("Toolchains:", toolchains);
if(toolchains.length) {
  toolchains.forEach(function (toolchain) {
    console.time('buildGraph' + toolchain);
    workspace.buildGraph({
      targets: targets,
      toolchain: toolchain
    }, function (err, inputs, outputs) {
      console.timeEnd('buildGraph' + toolchain);
      if (err) console.error(err);
      else {
        console.time('buildRun' + toolchain);
        (new TaskGraph(inputs, outputs))[action](new Runner(), function (err) {
          console.timeEnd('buildRun' + toolchain);
          process.exit(err);
        });
      }
    });
  });
}
else {
  console.time('buildGraph');
  workspace.buildSupportedVariantsGraph(function(err, inputs, outputs) {
    console.timeEnd('buildGraph');
    if (err) console.error(err);
    else {
      console.time('buildRun');
      (new TaskGraph(inputs, outputs))[action](new Runner(), function (err) {
        console.timeEnd('buildRun');
        process.exit(err);
      });
    }
  });
}