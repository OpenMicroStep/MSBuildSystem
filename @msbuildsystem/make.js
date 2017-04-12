function moduleFiles(name) {
  return { is: 'group', path: name, elements: [
    { is: 'group', name: "src", path: "src", elements: [
      { is: 'file', name: "index.ts", tags: ["tsc"] }
    ]},
    { is: 'group', name: "tst", path: "tst", elements: [
      { is: 'file', name: "index.ts", tags: ["tsc"] },
      { is: 'file', name: "data/**" , tags: ["rsc"] }
    ]}
  ]}
}

module.exports= {
  is: "project",
  name: "MSBuildSystem",
  'files=': {
    is: 'group',
    'cli=':              { is: 'group', elements: [{ is: 'file', name: "cli/src/index.ts"           },
                                                   { is: 'file', name: "cli/src/bin.ts"             }] },
    'core=':             moduleFiles('core'),
    'shared=':           { is: 'group', elements: [{ is: 'file', name: "shared/src/index.ts"        }] },
    'shared tests=':     { is: 'group', elements: [{ is: 'file', name: "shared/tst/index.ts"        }] },
    'foundation=':       { is: 'group', elements: [{ is: 'file', name: "foundation/src/index.ts"    }] },
    //'foundation tests=': { is: 'group', elements: [{ is: 'file', name: "foundation/tst/index.ts"    }] },
    'cxx=':              moduleFiles('cxx'),
    'js=' :              moduleFiles('js'),
    'typescript=':       moduleFiles('js.typescript'),
  },
  'node=': { is: "environment", packager: "npm" /* generate to node_modules/${target.outputName} */ },
  'base=': {
    is: "component",
    type: "javascript",
    compiler: "typescript",
    environments: ["=node"],
    npmPackage: [{
      "version": "0.3.0",
      "main": "index.js",
      "typings": "index.d.ts"
    }],
    tsConfig: [{
      "module": "commonjs",
      "target": "es6",
      "declaration": true,
      "experimentalDecorators": true,
      "strictNullChecks": true,
      "noImplicitThis": true,
      "noImplicitReturns": true,
      "sourceMap": true,
      //"lib": ["es6"],
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
      "@types/node": "^4.0.30",
      "@openmicrostep/tests": "^0.1.0"
    }],
    npmPackage: [{
      "dependencies": {
        "chai": "^3.5.0"
      }
    }]
  },
  'targets=': { 'is': 'group',
    'core=': {
      is: "target",
      outputName: '@openmicrostep/msbuildsystem.core',
      targets: ['shared'],
      components: ['=base', '=::shared::'],
      files: ['=files:core:src ? tsc'],
      npmInstall: [{
        "@types/fs-extra": "0.0.28",
      }],
      npmPackage: [{
        "dependencies": {
          "fs-extra": "^0.30.0",
          "source-map-support": "^0.4.0"
        }
      }],
      exports: [{ is: 'component', name: 'cfg',
        "module=": { is: 'component', components: ['=base']       },
        "tests=" : { is: 'component', components: ['=base tests'] },
      }]
    },
    'core tests=': {
      is: "target",
      outputName: '@openmicrostep/msbuildsystem.core.tests',
      targets: ['core'],
      components: ['=base tests', '=::core::'],
      files: ['=files:core:tst ? tsc'],
      copyFiles: [{value: ['=files:core:tst ? rsc'], dest: 'data', expand: true }]
    },
    'shared=': {
      is: "target",
      components: ['=base'],
      outputName: '@openmicrostep/msbuildsystem.shared',
      files: ['=files:shared'],
      npmInstall: [{
        "@openmicrostep/async": "^0.1.0",
      }],
      npmPackage: [{
        "dependencies": {
          "@openmicrostep/async": "^0.1.0"
        }
      }]
    },
    'shared tests=': {
      is: "target",
      outputName: '@openmicrostep/msbuildsystem.shared.tests',
      targets: ['shared'],
      components: ['=base tests', '=::shared::'],
      files: ['=files:shared tests'],
    },
    'cli=': {
      is: "target",
      outputName: '@openmicrostep/msbuildsystem.cli',
      components: ['=base', '=::core::'],
      targets: ['core'],
      files: ['=files:cli'],
      //tsConfig: [{ traceResolution: true }],
      npmInstall: [{
        "@types/argparse": "^1.0.30",
        "@types/chalk": "^0.4.31",
      }],
      npmPackage: [{
        "dependencies": {
          "argparse": "^1.0.9",
          "chalk": "^1.1.3"
        },
        "bin": { "msbuildsystem": "./bin.js" },
      }]
    },
    'foundation=': {
      is: "target",
      outputName: '@openmicrostep/msbuildsystem.foundation',
      targets: ['core'],
      components: ['=base', '=::core::'],
      files: ['=files:foundation']
    },
    /*'foundation tests=': {
      is: "target",
      outputName: '@openmicrostep/msbuildsystem.foundation.tests',
      components: ['=base tests'],
      targets: ['foundation'],
      files: ['=files:foundation tests'],
    },*/
    'cxx=': {
      is: "target",
      outputName: '@openmicrostep/msbuildsystem.cxx',
      targets: ['core', 'foundation'],
      components: ['=base', '=::core::', '=::foundation::'],
      files: ['=files:cxx:src ? tsc'],
    },
    'cxx tests=': {
      is: "target",
      outputName: '@openmicrostep/msbuildsystem.cxx.tests',
      targets: ['cxx'],
      components: ['=base tests', '=::cxx::', '=::core::'],
      files: ['=files:cxx:tst ? tsc'],
      copyFiles: [{value: ['=files:cxx:tst ? rsc'], dest: 'data/hello-world', expand: true }]
    },
    'js=':               {
      is: 'target',
      outputName: '@openmicrostep/msbuildsystem.js',
      targets: ['core', 'foundation'],
      components: ['=base', '=::core::', '=::foundation::'],
      files: ['=files:js:src ? tsc']
    },
    'js tests=':         {
      is: 'target',
      outputName: '@openmicrostep/msbuildsystem.js.tests',
      targets: ['js'],
      components: ['=base tests', '=::foundation::', '=::core::', '=::js::'],
      files: ['=files:js:tst ? tsc'],
      copyFiles: [{value: ['=files:js:tst ? rsc'], dest: 'data/hello-world', expand: true }]
    },
    'typescript=':       {
      is: 'target',
      outputName: '@openmicrostep/msbuildsystem.js.typescript',
      targets: ['core', 'foundation', 'js'],
      components: ['=base', '=::foundation::', '=::js::', '=::core::'],
      files: ['=files:typescript:src ? tsc'],
      npmPackage: [{
        "dependencies": {
          "typescript": "^2.2.2",
        }
      }],
      npmInstall: [{
        "typescript": "^2.2.2",
      }]
    },
    'typescript tests=': {
      is: 'target',
      outputName: '@openmicrostep/msbuildsystem.js.typescript.tests',
      components: ['=base tests', '=::core::', '=::js::', '=::typescript::'],
      targets: ['typescript'],
      files: ['=files:typescript:tst ? tsc'],
      copyFiles: [{value: ['=files:typescript:tst ? rsc'], dest: 'data/hello-world', expand: true }]
    },
  },
  /* WIP
  'tests=': {
    // launch is a new element type related to testing/executing/debugging an output
    is: 'launch',
    // the type of launch allow like for targets to provide advanced control over the launch (ie. providing a debugger service)
    type: "node",
    // launch element results in launch graph in the build graph with dependencies to some targets
    targets: ['=targets ? test'],
    // like targets, launch are compatible with some environements
    environments: ['=launch envs:node'],
    // Everypath is relative to the environment output to make it easy to set the program value
    program: "=::core.tests:: ?"
    arguments: [...]
    "cwd":
  }
  */
}
