var allTestFiles = [];
var TEST_REGEXP = /(spec|test)\.js$/i;

var pathToModule = function(path) {
  return path.replace(/^\/base\//, '').replace(/\.js$/, '');
};

Object.keys(window.__karma__.files).forEach(function(file) {
  if (TEST_REGEXP.test(file)) {
    // Normalize paths to RequireJS module names.
    allTestFiles.push(pathToModule(file) + ".js");
  }
});

//TODO: figure out why relative config paths are failing
var lib_path = '/home/paul/Desktop/dev/wctank.com/wctank/static/lib/';

require.config({
    // Karma serves files under /base, which is the basePath from your config file
    baseUrl: '/base',

    paths: {
        'tween': lib_path+'tween.min',
        'modernizr': lib_path+'modernizr.custom',
        'jquery': lib_path+'jquery-2.1.1.min'
    },

    shim: {
        'tween': {
            exports: 'TWEEN'
        },
        'modernizr': {
            exports: 'Modernizr'
        },
        'jquery': {
            exports: '$'
        }

    },

    // dynamically load all test files
    deps: allTestFiles,

    // we have to kickoff jasmine, as it is asynchronous
    callback: window.__karma__.start
});
