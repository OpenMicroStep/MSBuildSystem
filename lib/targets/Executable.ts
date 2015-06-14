/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
'use strict';

import CXXTarget = require('./_CXXTarget');
import util = require('util');
import Target = require('../core/Target');

class Executable extends CXXTarget
{
}
Target.registerClass(Executable, "Executable");

module.exports = Executable;
