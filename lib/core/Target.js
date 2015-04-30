var path = require('path');
var _ = require('underscore');

/**
 * @typedef {object} TargetDependency
 * @property {string} workspace
 * @property {[string]} targets
 * @property {string} target
 * @property {Object.<string, *>} buildOptions
 */
/**
 * @typedef {object} TargetInfo
 * @property {string} name
 * @property {string} type
 * @property {[TargetDependency]} dependencies
 * @property {function} configure
 * @property {function} exports
 */

/**
 * @param {Workspace} workspace
 * @param {TargetInfo} info
 * @constructor
 */
function Target(workspace, info) {
  this.workspace = workspace;
  this.info = info;
  this.name = info.name;

  /**
   * @type {TargetDependency}
   */
  this.dependencies = info.dependencies || [];


}

Target.prototype.addDependency = function(dependency) {

  this.dependencies.push(dependency);

};

var noop = function() { arguments[arguments.length -1](); };

Target.prototype.exports = function(selfOptions, target, targetOptions, callback) {
  var self = this;
  (self.info.exports || noop)(self, selfOptions, target, targetOptions, function(err) {
    if(err) return callback(err);

    var deepExports = self.info["deep-exports"];
    if(deepExports) {
      var exports = target.exports;
      target.exports = function (_selfOptions, _target, _targetOptions, _callback) {
        exports.call(this, _selfOptions, _target, _targetOptions, function(err) {
          if(err) return _callback(err);
          deepExports.call(self.info, self, selfOptions, _target, _targetOptions, _callback);
        });
      };
      deepExports.call(self.info, self, selfOptions, target, targetOptions, callback);
    }
    else {
      callback(err);
    }
  });
};

/**
 * @param {TargetBuildOptions} options
 * @param {BuildGraphCallback} callback
 */
Target.prototype.buildGraph = function(options, callback) {
  this.buildTaskGraph(options, callback);
};

/**
 * @param {TargetBuildOptions} options
 * @param {BuildGraphCallback} callback
 */
Target.prototype.buildTaskGraph = function(options, callback) {
  throw "'buildTaskGraph' must be reimplemented by subclasses"
};

/**
 *
 * @constructor
 */
function Middlewares() {
  this.middlewares = [];
}

/**
 * @callback Middleware
 * @param {*} obj
 * @param {function} next
 */

/**
 *
 * @param {Middleware|[Middleware]} middleware
 */
Middlewares.prototype.add = function(middleware) {
  if(Array.isArray(middleware))
    Array.prototype.push.apply(this.middlewares, middleware);
  this.middlewares.push(middleware);
};

/**
 *
 * @param obj
 * @param callback
 */
Middlewares.prototype.execute = function(obj, callback) {
  var args = _.toArray(arguments);
  callback = args[args.length - 1];

  var i = 0;
  var self = this;
  var next = function(err) {
    if(err)
      return callback(err);
    if(i < self.middlewares.length) {
      var idx = i;
      ++i;
      self.middlewares[idx].apply(null, args);
    }
    else {
      callback();
    }
  };
  args[args.length - 1] = next;

  next();
};

Target.Middlewares = Middlewares;
module.exports = Target;