require('source-map-support').install();
import BuildSystem = require('./BuildSystem');

new BuildSystem.Provider.Server(process.env.PORT || 2346, "0.0.0.0", "C:/tmp");//