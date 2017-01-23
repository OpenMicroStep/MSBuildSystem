const gulp = require('gulp');
const sass = require('gulp-sass');

const msbuildsystem_src = "../@msbuildsystem";
const msbuildsystem_out = "out-buildsystem/node_modules/@msbuildsystem";

function exec(what, cb) {
    require('child_process').exec(what, function(err, stdout, stderr) {
        if (stdout) console.log(stdout);
        if (stderr) console.log(stderr);
        cb(err);
    });
}
gulp.task('buildsystem:tsc', function(cb) {
    exec(`./node_modules/.bin/tsc -p ${msbuildsystem_src}/tsconfig.json`, cb);
});
gulp.task('buildsystem:packages', function() {
    gulp.src(`${msbuildsystem_src}/*/package.json`)
        .pipe(gulp.dest(msbuildsystem_out));
});
gulp.task('buildsystem:copy-test-data', function() {
    gulp.src(`${msbuildsystem_src}/*/tst/data/**`)
        .pipe(gulp.dest(msbuildsystem_out));
});
gulp.task('buildsystem:build', ['buildsystem:tsc', 'buildsystem:packages', 'buildsystem:copy-test-data']);

gulp.task('buildsystem:tests', ['buildsystem:build'], function(cb) {
    exec('./node_modules/.bin/mocha --colors test-buildsystem.js', cb);
});
gulp.task('buildsystem:debug', ['buildsystem:tsc', 'buildsystem:copy-test-data'], function(cb) {
    exec('./node_modules/.bin/mocha --nolazy --debug-brk --colors test-buildsystem.js', cb);
});
gulp.task('buildsystem:perf', ['buildsystem:tsc', 'buildsystem:copy-test-data'], function(cb) {
    exec('./node_modules/.bin/mocha --slow 10 --prof --inline-diffs --colors test-buildsystem.js', cb);
});
gulp.task('buildsystem', ['buildsystem:tests']);
