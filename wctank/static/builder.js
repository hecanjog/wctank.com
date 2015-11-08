#! /usr/bin/env node

var fs = require('fs'),
    less = require('less'),
    jspm = require('jspm'),
    cli = require('cli'),
    static = require('node-static');

cli.parse({
    production: ['p', 'builds minified and mangled static resources to ./dist'],
    debug: ['d', 'builds static resources to ./dist'],
    serve: ['s', 'runs a test server, which can be handy for debugging']
});

 
function compile_less(lesspath, outputpath, startmess, endmess)
{
    console.log(startmess);
    var lessfile = fs.readFileSync(lesspath, "utf8");
    less.render(lessfile, {paths: ["./less", "."], compress: true}) 
    .then(function(output) {
            fs.writeFile(outputpath, output.css, {flag: 'w+'}, function(err) {
                if (err) throw err;
                console.log(endmess);
            });
        },
        function(err) { if (err) throw err; }
    );
}


function doBuild(minify)
{
    console.log("compiling js...");
    jspm.setPackagePath('.');
    jspm.bundleSFX("js/main", "dist/main.js", {minify: minify, mangle: minify}).then(function() {
        console.log("done compiling js."); 

    });

    compile_less(
        "./less/fail.less", 
        "./dist/fail.css", 
        "compiling fail less...", 
        "done compiling fail less."
    );
    compile_less(
        "./less/styles.less", 
        "./dist/styles.css", 
        "compiling styles less...", 
        "done compiling styles less."
    );
}

function doServe()
{
    console.log("starting static server...");
    var server = new static.Server('.');
    require('http').createServer(function(req, res) {
        req.addListener('end', function() {
            server.serve(req, res);
        }).resume();
    }).listen(8080);
    console.log("server listening on port 8080.");
}


cli.main(function(args, options) {
    if (options.production) {
        doBuild(true); 
    }
    if (options.debug) {
        doBuild(false); 
    }
    if (options.serve) {
        doServe();
    }
});
