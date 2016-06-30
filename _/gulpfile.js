const gulp = require('gulp');
const sass = require('gulp-sass');
function exec(what, cb) {
    require('child_process').exec(what, function(err, stdout, stderr) {
        if (stdout) console.log(stdout);
        //if (stderr) console.log(stderr);
        cb(err);
    });
}
gulp.task('buildsystem:tsc', function(cb) {
    exec('./node_modules/.bin/tsc -p ../buildsystem/tsconfig.json', cb);
});
gulp.task('buildsystem:copy-test-data', function() {
    gulp.src('../buildsystem/*.tests/data/**')
        .pipe(gulp.dest('out/buildsystem'));
});
gulp.task('buildsystem:tests', ['buildsystem:tsc', 'buildsystem:copy-test-data'], function(cb) {
    exec('./node_modules/.bin/mocha  --inline-diffs  --colors out/buildsystem/tests.js', cb);
});
gulp.task('buildsystem:debug', ['buildsystem:tsc', 'buildsystem:copy-test-data'], function(cb) {
    exec('./node_modules/.bin/mocha  --inline-diffs --nolazy --debug-brk --colors out/buildsystem/tests.js', cb);
});
gulp.task('buildsystem', ['buildsystem:tests']);
