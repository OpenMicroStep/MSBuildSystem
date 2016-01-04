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
        server : {
          out : "<%= config.out %>/ide/server",
        },
      },
      buildsystem : {
        out : "<%= config.out %>/buildsystem",
      },
    },

    /////
    // HTML Compilation
    jade: {
      ide: {
        options: {
          pretty: true,
          data: { debug: true },
        },
        files: {"<%= config.ide.client.out %>/index-debug.html": ["ide/views/index.jade"]}
      },
      "ide-release": {
        files: {"<%= config.ide.client.out %>/index.html": ["ide/views/index.jade"]}
      }
    },
    //
    /////

    /////
    // CSS Compilation
    sass: {
      options: {
        style: "compressed",
        sourcemap: "inline",
      },
      ide: {
        files: [{src: 'ide/views/ide.scss', dest: '<%= config.ide.client.out %>/css/ide.css'}]
      }
    },
    //
    /////

    /////
    // Typescript Compilation
    typescript: {
      options: {
        noLib: true,
        target: 'es5',
        sourceMap: true
      },
      ide: {
        src: ['ide/client/**/*.ts', 'ide/core/**/*.ts', 'ide/views/**/*.ts'],
        dest: '<%= config.ide.client.out %>/js',
        options: { module: 'amd' }
      },
      nodejs: {
        src: ['buildsystem/**/*.ts', 'ide/server/**/*.ts'],
        dest: '<%= config.out %>',
        options: { module: 'commonjs' }
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
            'bower_components/bootstrap/fonts/*',
            'node_modules/font-awesome/fonts/*',
          ],
          dest: '<%= config.ide.client.out %>/fonts'
        },{
          expand: true,
          flatten: true,
          src: [
            'bower_components/bootstrap/dist/css/bootstrap.css',
            'bower_components/bootstrap/dist/css/bootstrap.css.map',
            'node_modules/font-awesome/css/font-awesome.css',
            'node_modules/font-awesome/css/font-awesome.css.map',
          ],
          dest: '<%= config.ide.client.out %>/css'
        },{
          expand: true,
          flatten: true,
          src: [
            'bower_components/requirejs/require.js',
            'bower_components/jquery/dist/jquery.js',
            'node_modules/underscore/underscore.js',
            'bower_components/socket.io-client/socket.io.js',
            'ide/main.js',
          ],
          dest: '<%= config.ide.client.out %>/js'
        },{
          expand: true,
          cwd: 'bower_components/ace-builds/src-noconflict',
          src: ['**'],
          dest: '<%= config.ide.client.out %>/js/ace'
        }]
      }
    },
    surround: {
      bootstrap: {
        options: {
          prepend: "define(['jquery'], function (jQuery) {",
          append: '});'
        },
        files: [{ src: "bower_components/bootstrap/dist/js/bootstrap.js", dest: "<%= config.ide.client.out %>/js/bootstrap.js" }]
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
          {src: ['out/**', 'app.js', 'app_provider.js', 'ide.js', 'sysroots/darwin-10.10/**']},
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
    //
    /////

    watch: {
      options:{
        livereload: true,
      },
      ide: {
        files: ['ide/**', 'ide.js', 'buildsystem/**'],
        tasks: ['shell:ide:kill', 'ide', 'shell:ide'],
        options: {
          spawn: false
        }
      },
      electron: {
        files: ['ide/**', 'ide.js', 'buildsystem/**'],
        tasks: ['shell:electron:kill', 'ide', 'shell:electron'],
        options: {
          spawn: false
        }
      }
    },
    shell: {
      'ide': {
        command: 'node --expose-gc ide.js',
        options: { async: true }
      },
      'electron': {
        command: 'electron --expose-gc main.js',
        options: { async: true }
      },
    }
  });

  grunt.loadNpmTasks('grunt-contrib-compress');
  grunt.loadNpmTasks('grunt-contrib-sass');
  grunt.loadNpmTasks('grunt-contrib-jade');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-requirejs');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-typescript');
  grunt.loadNpmTasks('grunt-shell-spawn');
  grunt.loadNpmTasks('grunt-surround');

  grunt.registerTask('default', ['ide', 'buildsystem']);

  grunt.registerTask('package', [
    'ide-release',
    'buildsystem',
    'compress:all'
  ]);
  grunt.registerTask('buildsystem', [
    'typescript:nodejs', // JS
  ]);
  grunt.registerTask('ide', [
    'surround:bootstrap',
    'copy:ide', // Dependencies & Setup
    'jade:ide', // HTML
    'sass:ide', // CSS
    'typescript:ide', // JS
    'typescript:nodejs', // JS
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