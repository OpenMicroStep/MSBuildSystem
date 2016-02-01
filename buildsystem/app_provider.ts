require('source-map-support').install();
import BuildSystem = require('./BuildSystem');
import Provider = require('./core/Provider');

new Provider.Server(process.env.PORT || 2346, "C:/tmp");//