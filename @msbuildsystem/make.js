module.exports= {
  is: "project",
  name: "MSBuildSystem",
  'files=': {
    is: 'group',
    'cli=':              { is: 'group', elements: [{ is: 'file', name: "cli/src/index.ts"           }] },
    'core=':             { is: 'group', elements: [{ is: 'file', name: "core/src/index.ts"          }] },
    'core tests=':       { is: 'group', elements: [{ is: 'file', name: "core/tst/index.ts"          }] },
    'shared=':           { is: 'group', elements: [{ is: 'file', name: "shared/src/index.ts"        }] },
    'shared tests=':     { is: 'group', elements: [{ is: 'file', name: "shared/tst/index.ts"        }] },
    'foundation=':       { is: 'group', elements: [{ is: 'file', name: "foundation/src/index.ts"    }] },
    'foundation tests=': { is: 'group', elements: [{ is: 'file', name: "foundation/tst/index.ts"    }] },
    'cxx=':              { is: 'group', elements: [{ is: 'file', name: "cxx/src/index.ts"           }] },
    'cxx tests=':        { is: 'group', elements: [{ is: 'file', name: "cxx/tst/index.ts"           }] },
    'js=':               { is: 'group', elements: [{ is: 'file', name: "js/src/index.ts"            }] },
    'js tests=':         { is: 'group', elements: [{ is: 'file', name: "js/tst/index.ts"            }] },
    'typescript=':       { is: 'group', elements: [{ is: 'file', name: "js.typescript/src/index.ts" }] },
    'typescript tests=': { is: 'group', elements: [{ is: 'file', name: "js.typescript/tst/index.ts" }] },
    'js.logitud=':       { is: 'group', elements: [{ is: 'file', name: "js.logitud/src/index.ts"    }] },
    'aspects=':          { is: 'group', elements: [{ is: 'file', name: "aspects/src/index.ts"       }] },
  },
  'node env=': { is: "environment", packager: "npm" /* generate to node_modules/${target.outputName} */ },
  'base=': {
    is: "component",
    type: "javascript",
    compiler: "typescript",
    environments: ["=node env"],
    npmPackage: [{
      "version": "0.1.0",
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
      "types": ["node"]
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
    files: ['=files:shared'],
    npmInstall: [{
      "@microstep/async": "^0.1.0",
    }]
  },
  'shared tests=': {
    is: "target",
    outputName: '@msbuildsystem/shared.tests',
    components: ['=base tests'],
    targets: ['=shared'],
    files: ['=files:shared tests'],
  },
  'cli=': {
    is: "target",
    outputName: '@msbuildsystem/cli',
    components: ['=base'],
    targets: ['=core'],
    files: ['=files:cli'],
    npmInstall: [{
      "@types/argparse": "^1.0.30",
      "@types/chalk": "^0.4.31",
    }],
    npmPackage: [{
      "dependencies": {
        "argparse": "^1.0.9",
        "chalk": "^1.1.3"
      },
      "bin": { "msbuildsystem": "./index.js" },
    }]
  },
  'foundation=': {
    is: "target",
    outputName: '@msbuildsystem/foundation',
    components: ['=base'],
    targets: ['=core'],
    files: ['=files:foundation']
  },
  /*'foundation tests=': {
    is: "target",
    outputName: '@msbuildsystem/foundation.tests',
    components: ['=base tests'],
    targets: ['=foundation'],
    files: ['=files:foundation tests'],
  },*/
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
  },
  'js=':               {
    is: 'target',
    outputName: '@msbuildsystem/js',
    components: ['=base'],
    targets: ['=core', '=foundation'],
    files: ['=files:js']
  },
  'js tests=':         {
    is: 'target',
    outputName: '@msbuildsystem/js.tests',
    components: ['=base tests'],
    targets: ['=js'],
    files: ['=files:js tests']
  },
  'typescript=':       {
    is: 'target',
    outputName: '@msbuildsystem/js.typescript',
    components: ['=base'],
    targets: ['=core', '=foundation', '=js'],
    files: ['=files:typescript'],
    npmInstall: [{
      "typescript": "^2.1.4",
    }]
  },
  'typescript tests=': {
    is: 'target',
    outputName: '@msbuildsystem/js.typescript.tests',
    components: ['=base tests'],
    targets: ['=typescript'],
    files: ['=files:typescript tests']
   },
  'js.logitud=': {
    is: 'target',
    outputName: '@msbuildsystem/js.logitud',
    components: ['=base'],
    targets: ['=core', '=js'],
    files: ['=files:js.logitud']
   },
  'aspects=': {
    is: 'target',
    outputName: '@msbuildsystem/aspects',
    components: ['=base'],
    targets: ['=core'],
    files: ['=files:aspects']
   }
}
