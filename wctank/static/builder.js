#! /usr/bin/env node

var fs = require('fs'),
    less = require('less'),
    jspm = require('jspm'),
    cli = require('cli');


cli.parse({
    production: ['p', 'builds minified and mangled static resources to ./dist'],
    debug: ['d', 'builds static resources to ./dist']
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
    jspm.bundleSFX("js/main", "dist/main.js", {minify: minify, mangle: minify}).then(function(err) {
        if (err) throw err;
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


cli.main(function(args, options) {
    if (options.production) {
        doBuild(true); 
    }
    if (options.debug) {
        doBuild(false); 
    }
});
