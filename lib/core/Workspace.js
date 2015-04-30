var Task = require('./Task');
var path = require('path');
var fs = require('fs-extra');
var _ = require('underscore');

/**
 * @typedef {Object.<string, FileTree>|[string]}FileTree
 */

/**
 * Workspace is the main component of a project
 * @param directory
 * @constructor
 */
function Workspace(directory) {
  this.directory = directory;
  this.path = path.join(directory, "make.js");
  var settings = require(this.path);

  /**
   * @type {Profile}
   */
  this.profile = (settings.profile && BuildSystem.Profile[settings.profile]) || BuildSystem.Profile.OpenMicroStep;

  /**
   * List of build options this workspace defines.
   * Build option names are limited to ASCII characters.
   * The whole set of build options define the build variant.
   * @type {Object.<string, {type: BuildOptionType, value: *}>}
   */
  this.buildOptions = settings.buildOptions || {};

  /**
   * List of supported toolchains.
   * This project should build & work fine on any of these toolchain.
   * @type {[string]}
   */
  this.supportedToolchains = settings.supportedToolchains || [];

  /**
   * List of supported build options combinaison.
   * @type {[{ options: Object.<string, *> , toolchains:[string] }]}
   */
  this.supportedBuildOptions = settings.supportedBuildOptions || [];

  /**
   * List of targets with workspace contains
   * @type {[TargetInfo]}
   */
  this.targets = settings.targets || [];

  /**
   * Tree of files
   * @type FileTree
   */
  this.files = settings.files || [];
}

var workspaces = {};

/**
 * Get a shared across the whole process file.
 * @param workspacePath
 * @return {File}
 */
Workspace.getShared = function(workspacePath) {
  workspacePath = path.normalize(workspacePath);
  if(!path.isAbsolute(workspacePath))
    throw "'workspacePath' must be absolute (workspacePath=" + workspacePath + ")";

  var workspace = workspaces[workspacePath];
  if(!workspace)
    workspace = workspaces[workspacePath] = new Workspace(workspacePath);
  return workspace;
};

/**
 * @enum BuildOptionType
 * @type {string}
 */
Workspace.BuildOptionType = {
  BOOLEAN : "boolean",
  STRING : "string",
  NUMBER : "number"
};

var _buildOptionRx = /^[a-zA-Z_-]+$/;
Workspace.prototype.defineBuildOption = function(name, type, defaultValue) {
  if(!_buildOptionRx.test(name))
    throw "Build option name contains invalid characters";
  this.buildOptions[name] = {type: type, value:defaultValue};
};

/**
 * @callback BuildGraphCallback
 * @param {Error} err
 * @param {[Task]} inputs
 * @param {[Task]} outputs
 */

/**
 * @typedef {object} TargetBuildOptions
 * @property {string} intermediates Path where to store intermediate build files
 * @property {string} output Out directory
 * @property {string} targetOutput Target out directory
 * @property {Profile} profile Build output profile
 * @property {Target} target Target that is built
 * @property {Object.<string, *>} buildOptions Build options to use to compile the target
 * @property {Toolchain} toolchain Toolchain to use for the build
 */

/**
 * @typedef {object} WorkspaceBuildOptions
 * @property {[string]} [targets] Targets to have in the build graph
 * @property {Object.<string, *>} buildOptions Build options to use to compile these targets
 * @property {string} toolchain Toolchain to use for the build
 * @property {string} [output] Output directory (by default, the output directory is defined by
 *                                               both the current profile and the workspace directory)
 * @property {string} [profile] Profile to use (by default, the workspace profile is used)
 * @property {function({TargetBuildOptions} options, cb)} [beforeBuildGraph] Hook to run before building a target graph
 */

/**
 *
 * @param {WorkspaceBuildOptions} options
 * @param {BuildGraphCallback} callback
 */
Workspace.prototype.buildGraph = function(options, callback) {
  // Handle settings
  var profile = this.profile;
  if(options.profile) {
    if(typeof options.profile !== "string")
      return callback(new Error("'options.profile' must be a string"));
    if(!(profile = BuildSystem.Profile[options.profile]))
      return callback(new Error("profile '" + options.profile + "' not found"));

  }
  var buildOptions = options.buildOptions || _.mapObject(this.buildOptions, function(opt) { return opt.value; });
  var targets = options.targets || [];
  var toolchain = options.toolchain;
  if(typeof toolchain !== "string")
    return callback(new Error("'options.toolchain' must be a string"));
  if(!BuildSystem.Toolchain[toolchain])
    return callback(new Error("toolchain '" + toolchain + "' not found"));

  var buildOptionsKey = "";
  _.each(buildOptions, function(v, i) {
    buildOptionsKey += i + "=" + v;
  });
  var uniquePath = path.join(toolchain, buildOptionsKey);
  var output = options.output || path.join(this.directory, profile.directories.output, uniquePath);

  var context = {
    profile:profile,
    buildOptions:buildOptions,
    uniquePath:uniquePath,
    toolchain:BuildSystem.Toolchain[toolchain],
    output:output,
    graphs: {}
  };
  this._buildGraph(context, targets, function (options, cb) { cb(); }, callback);
};

Workspace.prototype._buildGraph = function(context, targets, exports, callback) {
  function _requestGraph(targetInfo, outcb) {
    var key = targetInfo.name;
    var graph = context.graphs[key];
    if(!graph) { // Graph must be built
      graph = context.graphs[key] = { args:null, obs:[outcb] };
      self._buildTargetGraph(context, targetInfo, function() {
        var obs = graph.obs;
        graph.args = arguments;
        delete graph.obs;
        obs.forEach(function(outcb) { outcb.apply(null, graph.args); })
      });
    }
    else if(graph.obs) // Graph is building
      graph.obs.push(outcb);
    else // Graph is built
      outcb.apply(null, graph.args);
  }

  var self = this;
  var inputs= [];
  var outputs= [];
  var barrier = new Barrier.Simple();
  this.targets.forEach(function(targetInfo) {
    if(!targets.length || targets.indexOf(targetInfo.name) !== -1) {
      barrier.inc();

      _requestGraph(targetInfo, function(err, opts, targetInputs, targetOutputs) {
        if(err) return barrier.dec(err);

        exports(opts, function(err) {
          if(err) return barrier.dec(err);

          Array.prototype.push.apply(inputs, targetInputs);
          Array.prototype.push.apply(outputs, targetOutputs);
          barrier.dec();
        })
      });
    }
  });

  barrier.endWith(function(err) {
    callback(err, inputs, outputs);
  });
};

Workspace.prototype._buildTargetGraph = function(context, targetInfo, callback) {
  var self = this;
  var intermediates = path.join(self.directory, context.profile.directories.intermediates, context.uniquePath, targetInfo.name);
  var targetOutput = path.join(context.output, context.profile.directories.target[targetInfo.type]);
  var TargetConstructor = BuildSystem.Target[targetInfo.type];
  var target = new TargetConstructor(self, targetInfo);
  /** @type TargetBuildOptions */
  var opts = {
    intermediates:intermediates,
    output:context.output,
    targetOutput:targetOutput,
    profile:context.profile,
    target:target,
    buildOptions: context.buildOptions,
    toolchain:context.toolchain
  };

  // Call configure on target make
  targetInfo.configure.call(self, target, opts, function(err) {
    if (err) return callback(err);

    // Dependencies
    var deps = targetInfo.dependencies || [];
    var depInputs= [];
    var depOutputs= [];
    var depBarrier = new Barrier.Simple(deps.length);
    deps.forEach(function (dependency) {
      if(typeof dependency === "string")
        dependency = { targets: [dependency] };
      if(dependency.condition && !dependency.condition(opts))
        return depBarrier.dec();

      var depWorkspace = self;
      var depTargets = (dependency.target ? [dependency.target] : dependency.targets) || [];
      if (dependency.workspace) {
        if (path.isAbsolute(dependency.workspace))
          depWorkspace = Workspace.getShared(dependency.workspace);
        else
          depWorkspace = Workspace.getShared(path.join(self.directory, dependency.workspace));
      } else if(!depTargets.length) {
        return depBarrier.dec("Dependency inside the same workspace must explicitly set the list of targets");
      }
      depWorkspace._buildGraph(context, depTargets, function(depOptions, cb) {
        // Give dependency a change to setup target
        depOptions.target.exports(depOptions, target, opts, cb);
      }, function(err, targetInputs, targetOutputs) {
        if(err) return depBarrier.dec(err);

        Array.prototype.push.apply(depInputs, targetInputs);
        Array.prototype.push.apply(depOutputs, targetOutputs);
        depBarrier.dec();
      });

    });

    // Build target graph
    depBarrier.endWith(function(err) { if (err) return callback(err);

      // We give a chance to the toolchain to have control over the target build graph (useful for multi arch tool-chains)
      var builder = opts.toolchain.buildGraph ? opts.toolchain : target;
      builder.buildGraph(opts, function(err, targetInputs, targetOutputs) {
        if(err) return callback(err);

        // Merge dependency graph to the target graph if necessary
        if(depInputs.length && depOutputs.length) {
          targetInputs.forEach(function(targetInput) { targetInput.addDependencies(depOutputs); });
          targetInputs = depInputs;
        }
        callback(null, opts, targetInputs, targetOutputs);
      });

    });
  });
};

/**
 * Create a build graph that will compile all supported build variants.
 *  - every supported build options for every toolchains it support
 *  - every supported toolchains with default options
 * @param {object} options
 * @param callback
 */
Workspace.prototype.buildSupportedVariantsGraph = function(options, callback) {
  if(!callback) {
    callback = options;
    options = {};
  }

  var self = this;
  var fullInputs= [];
  var fullOutputs= [];
  var barrier = new Barrier.Simple();
  self.supportedBuildOptions.forEach(function(supportedBuildOption) {
    var toolchains = supportedBuildOption.toolchains || self.supportedToolchains;
    toolchains.forEach(function(toolchain) {
      barrier.inc();
      self.buildGraph({
        buildOptions: supportedBuildOption.options,
        toolchain:toolchain
      }, function(err, inputs, outputs) {
        if(err) return barrier.dec(err);

        Array.prototype.push.apply(fullInputs, inputs);
        Array.prototype.push.apply(fullOutputs, outputs);
        barrier.dec();
      });
    });
  });

  barrier.endWith(function(err) {
    if(err) return callback(err);
    callback(err, fullInputs, fullOutputs);
  })
};

module.exports = {
  getShared: Workspace.getShared
};