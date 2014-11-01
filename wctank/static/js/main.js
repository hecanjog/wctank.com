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
        VHSglsl: '/static/glsl/white_noise'
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
        'tableuxList',
    ],
function(sequencer) {
    sequencer.goTo(0);
});

