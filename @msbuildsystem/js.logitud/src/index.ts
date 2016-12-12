import {EnvironmentElement, Workspace} from '@msbuildsystem/core';

const logitud_typescript_angular = new EnvironmentElement("logitud.typescript.angular", Workspace.globalRoot, false);
Object.assign(logitud_typescript_angular, {
  type: "javascript", compiler: "typescript",
  tsConfig: [{
    "target": "es6",
    "declaration": true,
    "sourceMap": true,
    "skipLibCheck": true,
    "moduleResolution": "node",
    "experimentalDecorators": true,
    "strictNullChecks": true,
    "noImplicitThis": true,
    "noImplicitReturns": true,
    "lib": ["es6"]
  }],
  npmInstall: [{
    "@angular/common": "~2.2.0",
    "@angular/compiler": "~2.2.0",
    "@angular/core": "~2.2.0",
    "@angular/forms": "~2.2.0",
    "@angular/http": "~2.2.0",
    "@angular/platform-browser": "~2.2.0",
    "@angular/platform-browser-dynamic": "~2.2.0",
    "@angular/router": "~3.2.0",

    "angular-in-memory-web-api": "~0.1.15",
    "systemjs": "0.19.40",
    "core-js": "^2.4.1",
    "reflect-metadata": "^0.1.8",
    "rxjs": "5.0.0-beta.12",
    "zone.js": "^0.6.26",
  }]
});
Workspace.globalExports.set(logitud_typescript_angular.name, logitud_typescript_angular);

const logitud_node_server = new EnvironmentElement("logitud.node.server", Workspace.globalRoot, false);
Object.assign(logitud_node_server, {
  type: "javascript", compiler: "typescript",
  tsConfig: [{
    "module": "commonjs",
    "types": ["node"]
  }],
  npmInstall: [{
    "@types/node": "^4.0.30",
    "express": "^4.14.0",
    "@types/express": "^4.0.34",
    "express-serve-static-core": "^0.1.1"
  }],
});
Workspace.globalExports.set(logitud_node_server.name, logitud_node_server);
