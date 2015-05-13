/* @flow weak */
var _ = require('underscore');
var util = require('./util');
var inherits = require('util').inherits;
var fs = require('fs');
var path = require('path');

/**
 * List of loaded sysroot
 * @type {[Sysroot]}
 */
var sysroots = [];

/**
 * List of loaded sysroot classes
 * @type {Object.<string, Sysroot>}
 */
var sysrootClasses = {};

/**
 * Sysroot are CXX toolchain system root
 * A sysroot is the minimal set of headers and libraries that are required to build something
 * Sysroot are put into the build system by the _CXXTarget target.
 * The target find the sysroot that matches the build environment and ask the sysroot to provide compile, link and archive tasks
 *
 * @class Sysroot
 * @property {string} name Name
 * @property {string} arch Architecture (ie. x86_64, i386, armv7, ...)
 * @property {string} platform Platform (ie. darwin, linux, win32, android, ios, ...)
 * @property {string} api API (ie. darwin, linux, win32, mingw-w64, mingw, bsd, ios, ...)
 * @property {string} api-version API version (ie. 10.10, windows7, debian7, debian8, ...)
 * @property {string} directory Absolute directory of the sysroot
 */
function Sysroot(directory, extension) {
  this.directory = directory;
  _.extend(this, extension);
}

Sysroot.loadClasses = function(directory) {
  _.extend(sysrootClasses, util.requireDir(directory));
};

/**
 * Search for 'sysroot.js' files in 'directory' sub directories and load them as sysroot.
 * @param {string} directory
 */
Sysroot.load = function(directory) {
  var dirnames = fs.readdirSync(directory);
  dirnames.forEach(function(dirname) {
    var filename = path.join(directory, dirname, "sysroot.js");
    if(fs.existsSync(filename)) {
      var extension = require(filename);
      var constructor = extension.parent ? sysrootClasses[extension.parent] : Sysroot;
      var sysroot = new constructor(path.join(directory, dirname), extension);
      if(extension.init)
        extension.init.call(sysroot);
      sysroots.push(sysroot);
    }
  });
};

/**
 * Find the first sysroot that match the given environment
 * Matches occurs on the following keys:
 *  - arch
 *  - platform
 *  - sysroot-api
 *  - sysroot-api-version
 *  - sysroot-name
 * A least of the keys must match
 *
 * @param {Environment} env
 * @return {Sysroot|null}
 */
Sysroot.find = function(env) {
  return _.find(sysroots, function(sysroot) {
    var tested =0;
    if(env.arch && ++tested && !_.contains(sysroot.architectures, env.arch))
      return false;
    if(env.platform && ++tested && env.platform !== sysroot.platform)
      return false;
    if(env["sysroot-api"] && ++tested && env["sysroot-api"] !== sysroot.api)
      return false;
    if(env["sysroot-api-version"] && ++tested && env["sysroot-api-version"] !== sysroot["api-version"])
      return false;
    if(env["sysroot-name"] && ++tested && env["sysroot-name"] !== sysroot.name)
      return false;
    return tested > 0;
  });
};

Sysroot.prototype.createCompileTask = function(options, srcFile, objFile, callback) {
  throw "Sysroot must reimplement this to work";
};

Sysroot.prototype.createLinkTask = function(options, objFiles, finalFile, callback) {
  throw "Sysroot must reimplement this to work";
};

Sysroot.prototype.configure = function(options, callback) {
  callback();
};

Sysroot.prototype.linkFinalName = function(options) {
  return options.target.name;
};

Sysroot.prototype.linkFinalPath = function(options) {
  return path.join(options.targetOutput, this.linkFinalName(options));
};

module.exports = Sysroot;
