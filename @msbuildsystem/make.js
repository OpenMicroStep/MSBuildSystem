const version = require('child_process').execSync('git describe --always', { cwd: __dirname }).toString().trim();

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

function cwd_test(workspace) {
  return `${workspace}/node/node_modules/@openmicrostep`;
}
function tests(workspace) { return [
  `msbuildsystem.shared.tests/index.js`,
  `msbuildsystem.core.tests/index.js`,
  `msbuildsystem.js.tests/index.js`,
  `msbuildsystem.js.typescript.tests/index.js`,
].map(p => `${cwd_test(workspace)}/${p}`);
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
  'config=': { is: "group",
    'node=': {
      is: "environment",
      npmPackage: { is: "component",
        "version": version,
      }
    },
    'module=': {
      is: "component",
      type: "javascript",
      compiler: "typescript",
      packager: "npm",
      npmPackage: { is: "component",
        "main": "index.js",
        "typings": "index.d.ts",
        devDependencies: { is: "component",
          "@types/node": "^6.0.78"
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
    'module tests=': {
      is: "component",
      components: ["=module"],
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
          "@types/node": "^6.0.78",
          "@openmicrostep/tests": "^0.1.0"
        },
      },
    },
  },
  'base=': {
    is: "component",
    components: ["=config:module"],
    environments: ["=config:node"],
  },
  'base tests=': {
    is: "component",
    components: ["=config:module tests"],
    environments: ["=config:node"],
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
          "semver": "^5.4.1",
          "fs-extra": "^4.0.1",
          "source-map-support": "^0.4.0"
        },
        devDependencies: { is: "component",
          "@types/semver": "^5.3.33",
          "@types/fs-extra": "^4.0.0",
        },
      },
      exports: [{ is: 'component', name: 'cfg',
        "module=": { is: 'component', components: ['=config:module']       },
        "tests=" : { is: 'component', components: ['=config:module tests'] },
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
    "envs=": { is: "group", elements: [
      { is: "environment", name: "gitlab"  , tags: ["ci"   ] },
      { is: "environment", name: "travis"  , tags: ["ci"   , "coveralls"] },
      { is: "environment", name: "appveyor", tags: ["ci"   ] },
      { is: "environment", name: "local"   , tags: ["local"] },
    ]},
    "shell=": {
      is: "component",
      type: "basic",
      manual: true,
      environments: ["=envs"],
    },
    "cmd_no_cwd=": {
      is: "component",
      type: "cmd",
      tty: true,
      shell: true,
    },
    "cmd=": {
      is: "component",
      components: ["=cmd_no_cwd"],
      cwd: "={cwd}.absolutePath",
    },
    'cwd=': { is: 'group', elements: [{ is: 'file', name: "../" }] },
    "install-deps=": { is: "task", components: ["=cmd"], cmd: "npm install -g -q coveralls nyc @openmicrostep/tests" },
    "build-1=": { is: "task", components: ["=cmd"], cmd: Value([
      "msbuildsystem", "build", "-p", "@msbuildsystem", "-w", "dist/1/"
    ]) },
    "tests-1=": { is: "task", components: ["=cmd"], cmd: Value([
      "mstests", "-c", ...tests("dist/1")
    ]) },
    "build-2=": { is: "task", components: ["=cmd"], cmd: Value([
      "node", "dist/1/node/node_modules/@openmicrostep/msbuildsystem.cli/index.js", "build", "-p", "@msbuildsystem", "-w", "dist/2/"
    ]) },
    "tests-2=": { is: "task", components: ["=cmd"], cmd: Value([
      "mstests", "-c", ...tests("dist/2")
    ]) },
    "build-3=": { is: "task", components: ["=cmd"], cmd: Value([
      "node", "dist/2/node/node_modules/@openmicrostep/msbuildsystem.cli/index.js", "build", "-p", "@msbuildsystem", "-w", "dist/3/"
    ]) },
    "tests-3=": { is: "task", components: ["=cmd"], cmd: Value([
      "mstests", "-c", "-t", "10000", ...tests("dist/3")
    ]) },
    "coverage-local-3=": { is: "task", components: ["=cmd"], env: { is: "component", NYC_CWD: cwd_test("dist/3") }, cmd: Value([
      "nyc", "--reporter=html", "--report-dir", `${__dirname}/../dist/coverage`, "-x", "*.tests/**", "mstests",
      "-c", "-t", "20000", ...tests("dist/3")
    ]) },
    "coveralls-3=": { is: "task", components: ["=cmd"], env: { is: "component", NYC_CWD: cwd_test("dist/3") }, cmd:
      `nyc --reporter=text-lcov --report-dir ${__dirname}/../dist/coverage -x "*.tests/**" mstests -c -t 20000 ${tests("dist/3").join(' ')} | coveralls`
    },

    "deploy-shared="    : { is: "task", components: ["=cmd"], cmd: Value(["npm",  "publish", "dist/3/node/node_modules/@openmicrostep/msbuildsystem.shared"       ]) },
    "deploy-core="      : { is: "task", components: ["=cmd"], cmd: Value(["npm",  "publish", "dist/3/node/node_modules/@openmicrostep/msbuildsystem.core"         ]) },
    "deploy-cli="       : { is: "task", components: ["=cmd"], cmd: Value(["npm",  "publish", "dist/3/node/node_modules/@openmicrostep/msbuildsystem.cli"          ]) },
    "deploy-foundation=": { is: "task", components: ["=cmd"], cmd: Value(["npm",  "publish", "dist/3/node/node_modules/@openmicrostep/msbuildsystem.foundation"   ]) },
    "deploy-js="        : { is: "task", components: ["=cmd"], cmd: Value(["npm",  "publish", "dist/3/node/node_modules/@openmicrostep/msbuildsystem.js"           ]) },
    "deploy-ts="        : { is: "task", components: ["=cmd"], cmd: Value(["npm",  "publish", "dist/3/node/node_modules/@openmicrostep/msbuildsystem.js.typescript"]) },
    "deploy=":        { is: "target", components: ["=shell"], targets: ["bootstrap"],
      preTasks: Value(["=deploy-shared","=deploy-core","=deploy-cli","=deploy-foundation","=deploy-js","=deploy-ts"]) },

    "build-tests-1=": { is: "target", components: ["=shell"], preTasks: Value(["=build-1", "=tests-1"]) },
    "build-tests-2=": { is: "target", components: ["=shell"], preTasks: Value(["=build-2", "=tests-2"]) },
    "build-tests-3=": { is: "target", components: ["=shell"], preTasks: Value(["=build-3", "=tests-3"]) },
    "bootstrap=":     { is: "target", components: ["=shell"], preTasksByEnvironment: {
      "=envs ? ci + !coveralls": Value(["=install-deps", "=build-1", "=build-2", "=build-3", "=tests-3"                                    ]),
      "=envs ? ci +  coveralls": Value(["=install-deps", "=build-1", "=build-2", "=build-3", "=tests-3", "=coveralls-3"     ]),
      "=envs ? local"          : Value(["=build-1", "=build-2", "=build-3", "=tests-3", "=coverage-local-3"]),
    } },
  }
}

