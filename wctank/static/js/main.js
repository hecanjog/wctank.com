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
        loadingSVG: '/static/assets/loading_cur',
        VHSShaders: '/static/glsl/vhs',
        MarkerShaders: '/static/glsl/markers',
        AlphaStrutShaders: '/static/glsl/alphaStrut',
        SquaresShaders: '/static/glsl/squares',
        bassDrumSprites: '/static/assets/bass_drum_sprites',
        wesSprites: '/static/assets/wes'
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
        'gMap',
        'scenes',
        'sceneCore',
        'audioUIMain',
        'markerMain',
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
function(gMap, scenes, sceneCore, audioUIMain) {
   
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
    
    google.maps.event.addListener(overlay, 'click', function() {
        gMap.map.setZoom(9);
    });

    sceneCore.apply(scenes.NoMages); 

    // tail end of fake mute button click
    //audioUIMain.muteButton.click();

    gMap.events.initQueuedEvents('map');

    // suddenly remove loading screen - no transition!
    var loading = document.getElementById("loading-container");
    document.body.removeChild(loading);
});
