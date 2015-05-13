/* @flow weak */
var Task = require('./Task');
var Barrier = require('./Barrier');
var path = require('path');
var fs = require('fs-extra');
var _ = require('underscore');

/**
 * @typedef {object} GroupInfo
 * @property {string} group Name of the group
 * @property {[GroupInfo|FileInfo]} files
 */

/**
 * @typedef {object} FileInfo
 * @property {string} file Path of the file
 * @property {[string]} tags Tags this file has
 */

/**
 * @typedef {object} ExportInfo
 * @property {[string]} publicHeaders
 * @property {[string]} defines
 * @property {[TargetDependency]} dependencies
 * @property {function} configure
 */

/**
 * @typedef {object} TargetInfo
 * @property {string} name
 * @property {string} type
 * @property {[string]} environments
 * @property {[string]} files
 * @property {[string]} publicHeaders
 * @property {[string]} defines
 * @property {[string]} frameworks
 * @property {[TargetDependency]} dependencies
 * @property {function} configure
 * @property {ExportInfo} exports
 * @property {ExportInfo} deepExports
 */

/**
 * @class Environment
 * @property {string} name
 * @property {string} arch
 * @property {string} platform
 * @property {string} api
 * @property {string} api-version
 * @property {string} compiler
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
   * @type {Object.<string, Environment|[string]>}
   */
  this.environments = settings.environments || [];

  /**
   * List of targets with workspace contains
   * @type {[TargetInfo]}
   */
  this.targets = settings.targets || [];

  /**
   * Tree of files
   * @type [GroupInfo|FileInfo]
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
 * @callback BuildGraphCallback
 * @param {Error} err
 * @param {Graph} graph
 */

/**
 * Resolve the given list of files
 * @param {[string]} queries
 * @return {[string]}
 */
Workspace.prototype.resolveFiles = function(queries) {
  console.time("resolveFiles");
  var self = this;
  function findGroup(path, files) {
    var pathIdx = 0;
    var pathLen = path.length;
    var p = path[pathIdx];

    for(var i = 0; pathIdx < pathLen && i < files.length; ++i) {
      var file = files[i];
      if(file.group === p) {
        if(++pathIdx === pathLen)
          return file;
        p = path[pathIdx];
        files = file.files || [];
      }
    }
    return null;
  }

  function filterFiles(filters, files, fileTree) {
    fileTree.forEach(function(file) {
      if(file.group) {
        if(file.files)
          filterFiles(filters, files, file.files);
      }
      else if(file.file) {
        if(!filters.length || (file.tags && filters.every(function(filter) { return file.tags.indexOf(filter) !== -1; }))) {
          files.push(file.file);
        }
      }
    });
  }

  var ret = [];
  queries.forEach(function(query) {
    var groupName, fileTree, files = [];
    var filters = query.split("?");

    fileTree= (groupName= filters.shift()) !== "" ? ((findGroup(groupName.split('.'), self.files) || {}).files || []) : self.files;
    filterFiles(filters, files, fileTree);
    ret = _.union(ret, files);
  });
  console.timeEnd("resolveFiles");
  return ret;
};

/**
 * Resolve the given list of environments
 * @param {[string]} envs
 * @return {[Environment]}
 */
Workspace.prototype.resolveEnvironments = function(envs) {
  var self = this;
  var ret = [];
  envs.forEach(function(env) {
    var e;
    if((e= self.environments[env])) {
      if(_.isArray(e))
        Array.prototype.push.apply(ret, self.resolveEnvironments(e));
      else if(typeof e === "string")
        Array.prototype.push.apply(ret, self.resolveEnvironments([e]));
      else if(_.isObject(e)) {
        if(!e.name) { // environment is not initialized
          e.name = env;
          if(e.parent) {
            var parents = self.resolveEnvironments([e.parent]);
            if(parents.length)
              _.defaults(e, parents[0]);
          }
          _.defaults(e, {
            directories : {
              intermediates : ".intermediates",
              output : "out",
              publicHeaders : "include",
              target : {
                "Library": "lib",
                "Framework": "framework",
                "Executable": "bin",
                "Bundle": "bundle"
              }
            }
          });
        }
        ret.push(e);
      }
      else
          console.warn("ignoring invalid environment '"+env+"'");
    }
    else {
      console.warn("TODO: create a global environment system");
    }
  });
  return ret;
};

/**
 *
 * @param {{targets:[string], directory:string, environments:[string]}} options
 * @param {BuildGraphCallback} callback
 */
Workspace.prototype.buildGraph = function(options, callback) {
  var context = {
    targets: {},
    directory: options.directory || this.directory
  };
  this._buildGraph(context, options, callback);
};

function _getTargetGraph(context, workspace, env, targetInfo, callback) {
  var key = path.join(workspace.directory, targetInfo.name, env.name);
  var graph = context.targets[key];
  if(!graph) {
    // Graph must be built
    graph = context.targets[key] = { args:null, obs:[callback] };
    workspace._buildTargetGraph(context, env, targetInfo, function() {
      var obs = graph.obs;
      graph.args = arguments;
      delete graph.obs;
      obs.forEach(function(cb) { cb.apply(null, graph.args); })
    });
  }
  else if(graph.obs) {
    // Graph is building
    graph.obs.push(callback);
  }
  else {
    // Graph is built
    callback.apply(null, graph.args);
  }
}

Workspace.prototype._buildGraph = function(context, options, callback) {
  var self = this;
  var targets = options.targets || [];
  var environments = options.environments || [];
  var barrier = new Barrier.Simple();
  var graphs = [];
  self.targets.forEach(function(targetInfo) {
    if(!targets.length || targets.indexOf(targetInfo.name) !== -1) {

      var envs = self.resolveEnvironments(targetInfo.environments);
      envs.forEach(function (env) {
        if(!environments.length || environments.indexOf(env.name)) {
          barrier.inc();
          _getTargetGraph(context, self, env, targetInfo, function (err, opts, graph) {
            if (err) return barrier.dec(err);
            console.log(targetInfo.name, env.name, opts.env.name);
            graphs.push(graph);
            barrier.dec();
          });

        }
      });
    }
  });

  barrier.endWith(function(err) {
    callback(err, new Task.Graph("Root", graphs, graphs));
  });
};

Workspace.prototype._buildTargetGraph = function(context, env, targetInfo, callback) {
  var self = this;
  var intermediates = path.join(context.directory, env.directories.intermediates, env.name, targetInfo.name);
  var targetOutput = path.join(context.directory, env.directories.output, env.name, env.directories.target[targetInfo.type]);
  var output = path.join(context.directory, env.directories.output, env.name);
  var TargetConstructor = BuildSystem.Target[targetInfo.type];
  var target = new TargetConstructor(self, targetInfo);
  var opts = {
    intermediates:intermediates,
    output:output,
    targetOutput:targetOutput,
    target:target,
    env:env,
    variant:"debug"
  };

  target.configure(opts, function(err) {
    if (err) return callback(err);

    // Dependencies
    var deps = targetInfo.dependencies || [];
    var depGraphs = [];
    var depBarrier = new Barrier.Simple(deps.length);
    deps.forEach(function (dependency) {
      if (typeof dependency === "string")
        dependency = {target: dependency, workspace:null, condition:null};
      if (dependency.condition && !dependency.condition(opts))
        return depBarrier.dec();
      if (!dependency.target)
        return depBarrier.dec("Dependency must explicitly set the target");

      var depWorkspace = self;
      if (dependency.workspace) {
        if (path.isAbsolute(dependency.workspace))
          depWorkspace = Workspace.getShared(dependency.workspace);
        else
          depWorkspace = Workspace.getShared(path.join(self.directory, dependency.workspace));
      }

      var depTargetInfo = _.find(depWorkspace.targets, function (targetInfo) {
        return targetInfo.name === dependency.target;
      });
      if (!depTargetInfo)
        return depBarrier.dec("Dependency '" + dependency.target + "' not found");

      _getTargetGraph(context, depWorkspace, env, depTargetInfo, function (err, opts, depGraph) {
        if (err) return depBarrier.dec(err);
        depGraphs.push(depGraph);
        depBarrier.dec();
      });
    });

    // Build target graph
    depBarrier.endWith(function (err) {
      if (err) return callback(err);

      // We give a chance to the environment to have control over the target build graph (useful for multi arch env)
      var builder = env.buildGraph ? env : target;
      builder.buildGraph(opts, function (err, targetGraph) {
        if (err) return callback(err);

        // Merge dependency graph to the target graph if necessary
        if (depGraphs.length) {
          targetGraph.addDependencies(depGraphs);
          callback(null, opts, new Task.Graph("Target" + targetInfo.name + " with dependencies", depGraphs, [targetGraph]));
        }
        else {
          callback(null, opts, targetGraph);
        }
      });

    });
  });
};

module.exports = {
  getShared: Workspace.getShared
};