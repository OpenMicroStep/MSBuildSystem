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
function tests(path) {
  return [
    `${path}/node/node_modules/@openmicrostep/msbuildsystem.shared.tests/index.js`,
    `${path}/node/node_modules/@openmicrostep/msbuildsystem.core.tests/index.js`,
    `${path}/node/node_modules/@openmicrostep/msbuildsystem.js.tests/index.js`,
    `${path}/node/node_modules/@openmicrostep/msbuildsystem.js.typescript.tests/index.js`,
  ]
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
    npmPackage: { is: "component",
      "version": "0.4.2",
      "main": "index.js",
      "typings": "index.d.ts",
      devDependencies: { is: "component",
        "@types/node": "^4.0.30"
      }
    },
    tsConfig: { is: "component",
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
    },
  },
  'base tests=': {
    is: "component",
    components: ["=base"],
    tsConfig: { is: "component",
      "types": ["node", "mocha", "chai"]
    },
    npmPackage: { is: "component",
      dependencies: { is: "component",
        "chai": "4.0.0-canary.2"
      },
      devDependencies: { is: "component",
        "@types/chai": "^3.4.29",
        "@types/mocha": "^2.2.28",
        "@types/node": "^4.0.30",
        "@openmicrostep/tests": "^0.1.0"
      },
    },
  },
  'targets=': { 'is': 'group',
    'core=': {
      is: "target",
      outputName: '@openmicrostep/msbuildsystem.core',
      targets: ['shared'],
      components: ['=base', '=::shared::'],
      files: ['=files:core:src ? tsc'],
      npmPackage: { is: "component",
        dependencies: { is: "component",
          "fs-extra": "^0.30.0",
          "source-map-support": "^0.4.0"
        },
        devDependencies: { is: "component",
          "@types/fs-extra": "0.0.28",
        },
      },
      exports: [{ is: 'component', name: 'cfg',
        "module=": { is: 'component', components: ['={base} - environments']       },
        "tests=" : { is: 'component', components: ['=base tests'] },
      }]
    },
    'core tests=': {
      is: "target",
      outputName: '@openmicrostep/msbuildsystem.core.tests',
      targets: ['core'],
      components: ['=base tests', '=::core::'],
      files: ['=files:core:tst ? tsc'],
      copyFiles: [{is: 'group', elements: ['=files:core:tst ? rsc'], dest: 'data', expand: true }]
    },
    'shared=': {
      is: "target",
      components: ['=base'],
      outputName: '@openmicrostep/msbuildsystem.shared',
      files: ['=files:shared'],
      npmPackage: { is: "component",
        dependencies: { is: "component",
          "@openmicrostep/async": "^0.1.0"
        },
        devDependencies: { is: "component",
          "@openmicrostep/async": "^0.1.0",
        }
      }
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
      //tsConfig: [{ traceResolution: true }],,
      npmPackage: { is: "component",
        bin: { "msbuildsystem": "./bin.js" },
        dependencies: { is: "component",
          "argparse": "^1.0.9",
          "chalk": "^1.1.3"
        },
        devDependencies: { is: "component",
          "@types/argparse": "^1.0.30",
          "@types/chalk": "^0.4.31",
        },
      }
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
      copyFiles: [{is: 'group', elements: ['=files:cxx:tst ? rsc'], dest: 'data/hello-world', expand: true }]
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
      copyFiles: [{is: 'group', elements: ['=files:js:tst ? rsc'], dest: 'data/hello-world', expand: true }]
    },
    'typescript=':       {
      is: 'target',
      outputName: '@openmicrostep/msbuildsystem.js.typescript',
      targets: ['core', 'foundation', 'js'],
      components: ['=base', '=::foundation::', '=::js::', '=::core::'],
      files: ['=files:typescript:src ? tsc'],
      npmPackage: { is: "component",
        dependencies: { is: "component",
          "typescript": "^2.2.2",
        }
      },
    },
    'typescript tests=': {
      is: 'target',
      outputName: '@openmicrostep/msbuildsystem.js.typescript.tests',
      components: ['=base tests', '=::core::', '=::js::', '=::typescript::'],
      targets: ['typescript'],
      files: ['=files:typescript:tst ? tsc'],
      copyFiles: [{is: 'group', elements: ['=files:typescript:tst ? rsc'], dest: 'data/hello-world', expand: true }]
    },
  },
  'commands=': { is: "group",
    "shell=": { is: "environment"},
    'cwd=': { is: 'group', elements: [{ is: 'file', name: "../" }] },
    "build-1=": { is: "task", type: "cmd", cwd: "={cwd}.absolutePath", tty: true, cmd: Value([
      "msbuildsystem", "build", "-p", "@msbuildsystem", "-w", "dist/1/"
    ]) },
    "tests-1=": { is: "task", type: "cmd", cwd: "={cwd}.absolutePath", tty: true, cmd: Value([
      "mstests", "-c", ...tests("dist/1")
    ]) },
    "build-2=": { is: "task", type: "cmd", cwd: "={cwd}.absolutePath", tty: true, cmd: Value([
      "node", "dist/1/node/node_modules/@openmicrostep/msbuildsystem.cli/index.js", "build", "-p", "@msbuildsystem", "-w", "dist/2/"
    ]) },
    "tests-2=": { is: "task", type: "cmd", cwd: "={cwd}.absolutePath", tty: true, cmd: Value([
      "mstests", "-c", ...tests("dist/2")
    ]) },
    "build-3=": { is: "task", type: "cmd", cwd: "={cwd}.absolutePath", tty: true, cmd: Value([
      "node", "dist/2/node/node_modules/@openmicrostep/msbuildsystem.cli/index.js", "build", "-p", "@msbuildsystem", "-w", "dist/3/"
    ]) },
    "tests-3=": { is: "task", type: "cmd", cwd: "={cwd}.absolutePath", tty: true, cmd: Value([
      "mstests", "-c", ...tests("dist/3")
    ]) },
    "build-tests-1=": { is: "target", type: "basic", environments: ["=shell"], manual: true, preTasks: Value(["=build-1", "=tests-1"]) },
    "build-tests-2=": { is: "target", type: "basic", environments: ["=shell"], manual: true, preTasks: Value(["=build-2", "=tests-2"]) },
    "build-tests-3=": { is: "target", type: "basic", environments: ["=shell"], manual: true, preTasks: Value(["=build-3", "=tests-3"]) },
    "bootstrap=": { is: "target", type: "basic", environments: ["=shell"], manual: true, preTasks: Value(
      ["=build-1", "=build-2", "=build-3", "=tests-3"]
    ) },
  }
}

