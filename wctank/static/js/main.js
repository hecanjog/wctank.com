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
        sylvester: '/static/lib/sylvester',
        jStat: '/static/lib/jStat',
        filterXML: '/static/map_filters',
        VHSShaders: '/static/glsl/white_noise',
        MarkerShaders: '/static/glsl/markers',
        AlphaStrutShaders: '/static/glsl/alphaStrut',
        SquaresShaders: '/static/glsl/squares',
        AngularShaders: '/static/glsl/angular'
    },

    shim: {
        'froogaloop2': {
            deps: ['jquery'],
            exports: '$f'
        },
        'tween': {
            exports: 'TWEEN'
        },
        'sylvester': {
            exports: 'sylvester'
        },
        'jStat': {
            exports: 'jStat'
        }
    }
});

define(
    [
        'sequencer',
        'tableuxList',
        'specialDefs',
        //'markerEvents'
    ],
function(sequencer) {
    sequencer.goTo(0);
});

