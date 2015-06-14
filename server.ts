/// <reference path="./typings/tsd.d.ts" />
/* @flow weak */
'use strict';
import express = require('express');
var app = express();
app.use(express.static(__dirname + '/support/html', {
  maxAge: '1d'
}));
