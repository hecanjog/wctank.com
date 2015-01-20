require.config({
    baseUrl: '/static/js',
    paths: {
        async: '/static/lib/async',
        font: '/static/lib/font',
        propertyParser: '/static/lib/propertyParser',
        text: '/static/lib/text',
        jquery: ['http://code.jquery.com/jquery-2.1.1.min',
                '/static/lib/jquery-2.1.1.min'],
        modernizr: '/static/lib/modernizr.custom',   
        froogaloop2: '/static/lib/froogaloop2.min',
        tween: '/static/lib/tween.min',
        filterXML: '/static/map_filters',
        VHSShaders: '/static/glsl/vhs',
        MarkerShaders: '/static/glsl/markers',
        AlphaStrutShaders: '/static/glsl/alphaStrut',
        SquaresShaders: '/static/glsl/squares',
        SpriteIntervals: '/static/assets/wes'
    },

    shim: {
        'froogaloop2': {
            deps: ['jquery'],
            exports: '$f'
        },
        'tween': {
            exports: 'TWEEN'
        },
        'modernizr': {
            exports: 'Modernizr'
        }
    }
});

define(
    [
        'featureDetectionMain',
        'gMap',
        'scenes',
        'sceneCore',
        'markerMain',
        'audioUIMain',
        ['font!custom,families:',
            '[',
                'timeless',
                'timelessbold',
                'frutigerlight',
                'timelessitalic',
                'frutigerlightitalic',
                'frutigerbold',
                'wes-fa-subset',
            ']'
        ].join('/n')
    ],
function(featureDetectionMain, gMap, sceneGraphs, sceneGraphCore) {
   
    // TODO: 
    // envelope looping mechanism
    // two breakpoints in Sustain or one?
    // more generic envelope generator?
    // nix pushing on absoluteEnvelope.valueSequence set in favor of explicit push
    // move tweenUtil into sceneGraph module, not audioUtil

    gMap.init();
    var bounds = new google.maps.LatLngBounds(
        new google.maps.LatLng(42.96, -87.3159),
        new google.maps.LatLng(43.25, -86.9059)
    );

    var overlay = new google.maps.GroundOverlay(
        'static/assets/virgo-logo.png',
        bounds
    );
    overlay.setMap(gMap.map);
    var clouds = new google.maps.weather.CloudLayer();
    clouds.setMap(gMap.map);
    
    google.maps.event.addListener(overlay, 'click', function() {
        gMap.map.setZoom(9);
    });
    gMap.events.initQueuedEvents('map');

    sceneGraphCore.apply(sceneGraphs.NoMages); 

    // suddenly remove loading screen - no transition!
    var loading = document.getElementById("loading-container");
    document.body.removeChild(loading);
});
