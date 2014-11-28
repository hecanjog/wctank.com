require.config({
    baseUrl: '/static/js',
    paths: {
        async: '/static/lib/async',
        font: '/static/lib/font',
        propertyParser: '/static/lib/propertyParser',
        text: '/static/lib/text',
        jquery: ['http://code.jquery.com/jquery-2.1.1.min',
                '/static/lib/jquery-2.1.1.min'],
        froogaloop2: '/static/lib/froogaloop2.min',
        tween: '/static/lib/tween.min',
        filterXML: '/static/map_filters',
        VHSShaders: '/static/glsl/vhs',
        MarkerShaders: '/static/glsl/markers',
        AlphaStrutShaders: '/static/glsl/alphaStrut',
        SquaresShaders: '/static/glsl/squares',
        AngularShaders: '/static/glsl/angular',
        SpriteIntervals: '/static/assets/wes'
    },

    shim: {
        'froogaloop2': {
            deps: ['jquery'],
            exports: '$f'
        },
        'tween': {
            exports: 'TWEEN'
        }
    }
});

define(
    [
        'sequencer',
        'specialCoord',
        'specialDefs',
        'tableuxList',
        'markerEvents',
        'sceneGraphCore'
    ],
function(sequencer, specialCoord, specialDefs) {
    sequencer.goTo(0);
    window.applySquares = function() {
        specialCoord.apply(specialDefs.squares);
    };
    window.rmSquares = function() {
        specialCoord.rm(specialDefs.squares);
    };
    window.applyAlphaStrut = function() {
        specialCoord.apply(specialDefs.alphaStrut);
    };
    window.rmAlphaStrut = function() {
        specialCoord.rm(specialDefs.alphaStrut);
    };
});

