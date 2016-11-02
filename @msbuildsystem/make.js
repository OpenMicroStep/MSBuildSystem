module.exports= {
  is: "project",
  name: "MSBuildSystem",
  'files=': {
    is: 'group',
    'core=':             { is: 'group', elements: [{ is: 'file', name: "core/src/**.ts"          }] },
    'core tests=':       { is: 'group', elements: [{ is: 'file', name: "core/tst/**.ts"          }] },
    'shared=':           { is: 'group', elements: [{ is: 'file', name: "shared/src/**.ts"        }] },
    'shared tests=':     { is: 'group', elements: [{ is: 'file', name: "shared/tst/**.ts"        }] },
    'foundation=':       { is: 'group', elements: [{ is: 'file', name: "foundation/src/**.ts"    }] },
    'foundation tests=': { is: 'group', elements: [{ is: 'file', name: "foundation/tst/**.ts"    }] },
    'cxx=':              { is: 'group', elements: [{ is: 'file', name: "cxx/src/**.ts"           }] },
    'cxx tests=':        { is: 'group', elements: [{ is: 'file', name: "cxx/tst/**.ts"           }] },
    'js=':               { is: 'group', elements: [{ is: 'file', name: "js/src/**.ts"            }] },
    'js tests=':         { is: 'group', elements: [{ is: 'file', name: "js/tst/**.ts"            }] },
    'typescript=':       { is: 'group', elements: [{ is: 'file', name: "js.typescript/src/**.ts" }] },
    'typescript tests=': { is: 'group', elements: [{ is: 'file', name: "js.typescript/tst/**.ts" }] }
  },
  'node env=': { is: "environment", packager: "npm" /* generate to node_modules/${target.outputName} */ },
  'base=': {
    is: "component",
    type: "javascript",
    compiler: "typescript",
    environments: ["=node env"],
    npmPackage: [{
      "main": "index.js",
      "typings": "index.d.ts"
    }],
    tsConfig: [{
      "module": "commonjs",
      "target": "es6",
      "declaration": true,
      "sourceMap": true,
      "experimentalDecorators": true,
      "strictNullChecks": true,
      "noImplicitThis": true,
      "noImplicitReturns": true,
      "lib": ["es6"],
      "types": ["node"],
      "baseUrl": ".",
      "paths": {
        "@msbuildsystem/core/src/*": ["./node_modules/@msbuildsystem/core/*"],
        "@msbuildsystem/shared/src/*": ["./node_modules/@msbuildsystem/shared/*"]
      }
    }],
    npmInstall: [{
      "@types/node": "^4.0.30"
    }]
  },
  'base tests=': {
    is: "component",
    components: ["=base"],
    tsConfig: [{
      "types": ["node", "mocha", "chai"]
    }],
    npmInstall: [{
      "@types/chai": "^3.4.29",
      "@types/mocha": "^2.2.28",
      "@types/node": "^4.0.30"
    }]
  },
  'core=': {
    is: "target",
    outputName: '@msbuildsystem/core',
    components: ['=base'],
    targets: ['=shared'],
    files: ['=files:core'],
    npmInstall: [{
      "@types/fs-extra": "0.0.28",
    }],
    npmPackage: [{
      "dependencies": {
        "fs-extra": "^0.30.0",
        "source-map-support": "^0.4.0"
      }
    }]
  },
  'core tests=': {
    is: "target",
    outputName: '@msbuildsystem/core.tests',
    components: ['=base tests'],
    targets: ['=core'],
    files: ['=files:core tests'],
  },
  'shared=': {
    is: "target",
    components: ['=base'],
    outputName: '@msbuildsystem/shared',
    files: ['=files:shared']
  },
  'shared tests=': {
    is: "target",
    outputName: '@msbuildsystem/shared.tests',
    components: ['=base tests'],
    targets: ['=shared'],
    files: ['=files:shared tests'],
  },
  'foundation=': {
    is: "target",
    outputName: '@msbuildsystem/foundation',
    components: ['=base'],
    targets: ['=core'],
    files: ['=files:foundation']
  },
  'foundation tests=': {
    is: "target",
    outputName: '@msbuildsystem/foundation.tests',
    components: ['=base tests'],
    targets: ['=foundation'],
    files: ['=files:foundation tests'],
  },
  'cxx=': {
    is: "target",
    outputName: '@msbuildsystem/cxx',
    components: ['=base'],
    targets: ['=core', '=foundation'],
    files: ['=files:cxx']
  },
  'cxx tests=': {
    is: "target",
    outputName: '@msbuildsystem/cxx.tests',
    components: ['=base tests'],
    targets: ['=cxx'],
    files: ['=files:cxx tests'],
  }
}
