/// <reference path="../../typings/browser.d.ts" />

import IDE = require('./IDE');

var globals: {
  electron: any,
  ide: IDE
} = {
  electron: (<any>window).electron || null,
  ide: null
};

export = globals;