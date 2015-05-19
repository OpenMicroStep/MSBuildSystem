/// <reference path="../../typings/tsd.d.ts" />
/* @flow weak */
import Framework = require('./Framework');
import Target = require('../core/Target');

class Bundle extends Framework {

}

Target.registerClass(Bundle, "Bundle");

export = Bundle;
