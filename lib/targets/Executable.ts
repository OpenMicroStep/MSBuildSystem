/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
import CXXTarget = require('./_CXXTarget');
import util = require('util');

class Executable extends CXXTarget
{
}

Executable.prototype.type = "executable";

module.exports = Executable;
