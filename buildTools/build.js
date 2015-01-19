({
    paths: {
        async: '../lib/async',
        font: '../lib/font',
        propertyParser: '../lib/propertyParser',
        text: '../lib/text',
        jquery: '../lib/jquery-2.1.1.min',
        modernizr: '../lib/modernizr-latest',
        froogaloop2: '../lib/froogaloop2.min',
        tween: '../lib/tween.min',
        filterXML: '../map_filters',
        VHSShaders: '../glsl/vhs',
        MarkerShaders: '../glsl/markers',
        AlphaStrutShaders: '../glsl/alphaStrut',
        SquaresShaders: '../glsl/squares',
        AngularShaders: '../glsl/angular',
        SpriteIntervals: '../assets/wes',
        moduleLoader: '../lib/require'
    },
    shim: {
        'froogaloop2': {
            deps: ['jquery'],
            exports: '$f'
        },
        'tween': {
            exports: 'TWEEN'
        }
    },
    appDir: "../wctank/static/",
    baseUrl: "js",
    dir: "../appbuildingspace",
    name: "main",
    include: ["moduleLoader"],
    insertRequire: ["main"]
})
