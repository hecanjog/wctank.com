#!/bin/env node

var Builder = require('systemjs-builder'),
    path = require('path'),
    uglifyJs = require("uglify-js"),
    less = require('less'),
    exec = require("child_process").exec,
    fs = require('fs');

var googKey = process.env.GOOG_MAPS_KEY;

console.log("* * * compiling js...");
var build = new Builder({
    transpiler: 'babel',
    babelOptions: {
        experimental: true,
        optional: ["es6.symbols"],
    },
    baseURL: path.resolve('./'),
    paths: {
        "google-maps": "https://maps.googleapis.com/maps/api/js?key="+googKey+"&libraries=weather&sensor=false!callback",
        "lib/jquery": "lib/jquery-2.1.1.min.js",
    },
    map: {
        "xml": "system_plugins/text",
        "json": "system_plugins/json",
        "glsl": "system_plugins/text"
    },
    meta: {
        "google-maps": {
            "build": false,
            "loader": "systemjs-googlemaps"
        }
    }
})
.buildSFX('./js/main', './dist/main.js')
.then(function() {
    console.log("* * * uglifying js...");
    
    var uglified = uglifyJs.minify('./dist/main.js', {
        warnings: true
    });

    fs.writeFile("./dist/main.min.js", uglified.code, {flag: 'w+'}, function(err) {
        if (err) throw err;
    });
    
    console.log("* * * compiling and minifying less");

    var options = {
        paths: ["./less", '.'], 
        compress: true
    };

    var style_path = "./less/styles.less";
    var sty = fs.readFileSync(style_path, "utf8");
    less.render(sty, options) 
    .then(function(output) {
            fs.writeFile("./dist/styles.less", output.css, {flag: 'w+'}, function(err) {
                if (err) throw err;
            });
        },
        function(err) { if (err) throw err; }
    );
    
    var fail_path = "./less/fail.less";
    var fail = fs.readFileSync(fail_path, "utf8");
    less.render(sty, options) 
    .then(function(output) {
            fs.writeFile("./dist/fail.css", output.css, {flag: 'w+'}, function(err) {
                if (err) throw err;
            });
        },
        function(err) { if (err) throw err; }
    );
});
