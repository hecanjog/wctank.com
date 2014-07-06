/*
 * Trying gulp to manage build process
 * 
 * For the moment, not including npm devdependencies because
 * of path name length restrictions in windows, which makes dealing 
 * with deeply nested node_module folders a PITA in git. So, until I switch 
 * enviornments, let's leave that stuff out...
 * 
 * Requires gulp, gulp-concat, gulp-uglify
 * 
 * Then, just cd into this directory and run gulp
 * 
 */
var gulp = require('gulp');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');

gulp.task('default', function() {
	return gulp.src(['./lib/*.js','./js/*.js'])
		.pipe(concat('webgl.js'))
		.pipe(uglify())
		.pipe(gulp.dest('./build/'));
});