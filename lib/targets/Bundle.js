/* @flow weak */
var Framework = require('./Framework');
var util = require('util');

function Bundle()
{
  Framework.apply(this, arguments);
}

util.inherits(Bundle, Framework);

Bundle.prototype.type = "bundle";

module.exports = Bundle;
