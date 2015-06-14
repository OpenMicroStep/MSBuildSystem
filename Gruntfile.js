/**
 * Created by vincentrouille on 24/05/15.
 */
var pkgjson = require('./package.json');

module.exports = function (grunt) {

  // Configuration
  grunt.initConfig({
    config: {
      pkg: pkgjson,
      app: 'src',
      dist: 'dist'
    },
    pkg: pkgjson,
    jade: {
      options: {pretty: true},
      ide: {
        files: {"out/ide/index.html": ["lib/ide/views/index.jade"]}
      }
    },
    copy: {
      ide: {
        files: [{
          expand: true,
          cwd: 'bower_components/bootstrap',
          src: 'fonts/*',
          dest: 'out/ide'
        },{
          expand: true,
          flatten: true,
          src: [
            'bower_components/jquery/dist/jquery.js',
            'bower_components/bootstrap/dist/js/bootstrap.js',
            'bower_components/underscore/underscore.js',
            'bower_components/ace-builds/src-noconflict/ace.js',
            'lib/ide/ide.js'
          ],
          dest: 'out/ide/js'
        },{
          expand: true,
          flatten: true,
          src: [
            'bower_components/bootstrap/dist/css/bootstrap.css',
            'bower_components/bootstrap/dist/css/bootstrap.css.map',
            'lib/ide/views/ide.css'
          ],
          dest: 'out/ide/css'
        }]
      }
    },
    uglify: {
      options: {
        beautify: true,
        mangle: false,
        sourceMap: true
      },
      ide: {
        files: {
          'out/ide/js/ide.min.js':[
            'out/ide/js/jquery.js',
            'out/ide/js/bootstrap.js',
            'out/ide/js/underscore.js',
            'out/ide/js/ace.js',
            'out/ide/js/ide.js'
          ]
        }
      },
    },
    cssmin: {
      options : {
        sourceMap: true
      },
      ide: {
        files: {
          'out/ide/css/ide.min.css': [
            'out/ide/css/bootstrap.css',
            'out/ide/css/ide.css'
          ]
        }
      }
    },
    watch: {
      options:{
        interrupt: true
      },
      ide: {
        files: ['lib/ide/*'],
        tasks: ['ide']
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jade');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-watch');

  grunt.registerTask('default', ['ide']);
  grunt.registerTask('ide', [
    'jade:ide',
    'copy:ide',
    'uglify:ide',
    'cssmin:ide'
  ]);
};