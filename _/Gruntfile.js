/**
 * Created by vincentrouille on 24/05/15.
 */
var pkgjson = require('./package.json');

Date.prototype.yyyymmdd = function() {
  var yyyy = this.getFullYear().toString();
  var mm = (this.getMonth()+1).toString(); // getMonth() is zero-based
  var dd  = this.getDate().toString();
  return yyyy + (mm[1]?mm:"0"+mm[0]) + (dd[1]?dd:"0"+dd[0]); // padding
};
module.exports = function (grunt) {
  require('time-grunt')(grunt);

  // Configuration
  grunt.initConfig({
    config: {
      pkg: pkgjson,
      out: "out",
      date: (new Date()).yyyymmdd(),
      ide : {
        client : {
          out : "<%= config.out %>/ide/client",
        },
        electron : {
          out : "<%= config.out %>/ide/electron",
        },
        server : {
          out : "<%= config.out %>/ide/server",
        },
      },
      buildsystem : {
        out : "<%= config.out %>/buildsystem",
      },
    },

    /////
    // Compilation speedup
    concurrent: {
      ide: [
        'jade:ide', // HTML
        'sass:ide', // CSS
        'ts:ide', // JS
        'ts:nodejs', // JS
      ]
    },
    //
    /////

    /////
    // HTML Compilation
    jade: {
      ide: {
        options: {
          pretty: true,
          data: { debug: true },
        },
        files: {"<%= config.ide.client.out %>/index-debug.html": ["../ide/views/index.jade"]}
      },
      "ide-release": {
        files: {"<%= config.ide.client.out %>/index.html": ["../ide/views/index.jade"]}
      }
    },
    //
    /////

    /////
    // CSS Compilation
    sass: {
      options: {
        //style: "compressed",
      },
      ide: {
        files: [
          {src: '../ide/views/theme-light.scss', dest: '<%= config.ide.client.out %>/css/theme-light.css'},
          {src: '../ide/views/theme-dark.scss', dest: '<%= config.ide.client.out %>/css/theme-dark.css'}
        ]
      }
    },
    //
    /////

    /////
    // Typescript Compilation
    ts: {
      options: {
        noLib: true,
        target: 'es5',
        sourceMap: true,
        compiler: './node_modules/typescript/bin/tsc'
      },
      ide: {
        src: ["typings/browser.d.ts", '../ide/client/**/*.ts', '../ide/core/**/*.ts', '../ide/views/**/*.ts'],
        dest: '<%= config.ide.client.out %>/js',
        options: {
          module: 'amd',
        }
      },
      nodejs: {
        src: ["typings/node.d.ts", '../buildsystem/**/*.ts', '../ide/server/**/*.ts'],
        dest: '<%= config.out %>',
        options: {
          module: 'commonjs',
        }
      }
    },
    //
    /////

    /////
    // Copy dependencies
    copy: {
      ide: {
        files: [{
          expand: true,
          flatten: true,
          src: [
            'node_modules/bootstrap/fonts/*',
            'node_modules/font-awesome/fonts/*',
          ],
          dest: '<%= config.ide.client.out %>/fonts'
        },{
          expand: true,
          flatten: true,
          src: [
            'node_modules/bootstrap/dist/css/bootstrap.css',
            'node_modules/bootstrap/dist/css/bootstrap.css.map',
            'node_modules/font-awesome/css/font-awesome.css',
            'node_modules/font-awesome/css/font-awesome.css.map',
          ],
          dest: '<%= config.ide.client.out %>/css'
        },{
          expand: true,
          flatten: true,
          src: [
            'node_modules/tether/dist/js/tether.js',
            'node_modules/requirejs/require.js',
            'node_modules/jquery/dist/jquery.js',
            'node_modules/underscore/underscore.js',
            'node_modules/socket.io-client/socket.io.js',
            '../ide/main.js',
          ],
          dest: '<%= config.ide.client.out %>/js'
        },{
          expand: true,
          cwd: 'node_modules/ace-builds/src-noconflict',
          src: ['**'],
          dest: '<%= config.ide.client.out %>/js/ace'
        },{
          src: '../ide/electron/main.js',
          dest: '<%= config.ide.electron.out %>/main.js'
        },{
          src: '../ide/server/main.js',
          dest: '<%= config.ide.server.out %>/main.js'
        },{
          src: 'package.json',
          dest: '<%= config.out %>/package.json'
        }]
      }
    },
    surround: {
      bootstrap: {
        options: {
          prepend: "define(['jquery', 'tether'], function (jQuery, Tether) { window.Tether = Tether;",
          append: '});'
        },
        files: [{ src: "node_modules/bootstrap/dist/js/bootstrap.js", dest: "<%= config.ide.client.out %>/js/bootstrap.js" }]
      },
      term: {
        options: {
          prepend: "define(function (require, exports, module) {",
          append: '});'
        },
        files: [{ src: "node_modules/term.js/src/term.js", dest: "<%= config.ide.client.out %>/js/term.js" }]
      },
    },
    //
    /////

    /////
    // JS Module merges
    requirejs: {
      ide: {
        options: {
          uglify: {

          },
          baseUrl: "<%= config.ide.client.out %>/js",
          mainConfigFile: "<%= config.ide.client.out %>/js/main.js",
          name: 'main',
          out: "<%= config.ide.client.out %>/ide.js"
        }
      }
    },
    //
    /////

    /////
    // CSS merges
    cssmin: {
      ide: {
        files: {
          '<%= config.ide.client.out %>/ide.css': [
            '<%= config.ide.client.out %>/css/font-awesome.css',
            '<%= config.ide.client.out %>/css/bootstrap.css',
            '<%= config.ide.client.out %>/css/ide.css'
          ]
        }
      }
    },
    //
    /////

    /////
    // Packaging
    compress: {
      'all': {
        options: {
          archive:'all-<%= config.date %>.zip'
        },
        files: [
          {src: ['../out/**', '../app.js', '../app_provider.js', '../ide.js', '../sysroots/darwin-10.10/**']},
          {src: (function() {
            var deps = [];
            for(var dep in pkgjson.dependencies) {
              deps.push("node_modules/" + dep + "/**");
            }
            return deps;
          })() },
          /*{src: [
            'sysroots/**',
          ]},*/
        ]
      },
    },
    electron: {
      osx: {
        options: {
          name: 'MicroStep IDE',
          dir: 'out',
          out: 'dist',
          version: '0.36.2',
          platform: 'darwin',
          arch: 'x64',
          asar: false,
          overwrite: true
        }
      }
    },
    //
    /////

    watch: {
      options:{
        livereload: true,
      },
      ide: {
        files: ['../ide/**', '../ide.js', '../buildsystem/**'],
        tasks: ['shell:ide:kill', 'ide', 'shell:ide'],
        options: {
          spawn: false
        }
      },
      electron: {
        files: ['../ide/**', '../ide.js', '../buildsystem/**'],
        tasks: ['shell:electron:kill', 'ide', 'shell:electron'],
        options: {
          spawn: false
        }
      }
    },
    shell: {
      'electron-modules': {
        command: 'cd out && npm install --production && npm prune --production'
      },
      'ide': {
        command: 'node --debug out/ide/server/main.js /Users/vincentrouille/Dev/MicroStep/MSFoundation',
        options: { async: true }
      },
      'electron': {
        command: 'electron --expose-gc out/ide/electron/main.js',
        options: { async: true }
      },
    }
  });

  grunt.registerTask('electron-modules', 'Create electron package.json', function() {
    var done = this.async();
    grunt.log.writeln('Creating electron package.json');
    require('fs').writeFile('out/package.json', JSON.stringify({
      name: "electron",
      "private": true,
      productName: "Electron",
      main: "ide/electron/main.js",
      dependencies: pkgjson.dependencies,
    }, null, 2), 'utf8', done);
  });

  grunt.loadNpmTasks('grunt-contrib-compress');
  grunt.loadNpmTasks('grunt-contrib-sass');
  grunt.loadNpmTasks('grunt-contrib-jade');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-requirejs');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-ts');
  grunt.loadNpmTasks('grunt-shell-spawn');
  grunt.loadNpmTasks('grunt-surround');
  grunt.loadNpmTasks('grunt-electron');
  grunt.loadNpmTasks('grunt-concurrent');

  grunt.registerTask('default', ['ide']);

  grunt.registerTask('package', [
    'ide-release',
    'buildsystem',
    'compress:all'
  ]);
  grunt.registerTask('electron-osx', [
    'ide',
    'electron-modules',
    'shell:electron-modules',
    'electron:osx',
  ]);
  grunt.registerTask('buildsystem', [
    'ts:nodejs', // JS
  ]);
  grunt.registerTask('ide', [
    'surround:bootstrap',
    'surround:term',
    'copy:ide',
    'concurrent:ide',
  ]);

  grunt.registerTask('run-ide-debug', [
    'ide',
    'shell:ide:kill',
    'shell:ide',
    'watch:ide',
  ]);
  grunt.registerTask('run-electron-debug', [
    'ide',
    'shell:electron:kill',
    'shell:electron',
    'watch:electron',
  ]);
  grunt.registerTask('ide-release', [
    'ide',
    'jade:ide-release', // Optimize HTML
    'requirejs:ide', // Optimize JS
    'cssmin:ide', // Optimize CSS
  ]);
};