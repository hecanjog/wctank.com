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
        'gMap',
        'audioElements',
        'asdr',
        'envelopeCore',
        'instrument',
        'mutexVisualEffects',
        'sceneGraphCore',
        'audio',
        'rhythm',
        'instrumentDefs',
        ['font!custom,families:',
            '[',
                'timeless',
                'timelessbold',
                'frutigerlight',
                'timelessitalic',
                'frutigerlightitalic',
                'frutigerbold',
            ']'
        ].join('/n')
    ],
function(gMap, audioElements, asdr, envelopeCore, instrument, mutexVisualEffects,
            sceneGraphCore, audio, rhythm, instrumentDefs) {
   
    // TODO: 
    // envelope looping mechanism
    // bubble changes through envelopes so that asdr can recalc if any properties have changed
    // calc asdr on set, not get
    // two breakpoints in Sustain or one?
    // more generic envelope generator?
    // nix pushing on absoluteEnvelope.valueSequence set in favor of explicit push
    // testing for audio things
    // move tweenUtil into sceneGraph module, not audioUtil
    // throw error objects, not strings
    // rhythmGen.execute should start ref'd clock.?
    // instrument.Instrument.getTarget helper and rhythm callbacks
    // instrument.ParameterizedAction helper for value setters

    /*
     * map init work
     */    
    gMap.init();
    var bounds = new google.maps.LatLngBounds(
        new google.maps.LatLng(42.96, -87.3159),
        new google.maps.LatLng(43.25, -86.9059)
    );

    // TODO: Change to animated version?
    var overlay = new google.maps.GroundOverlay(
        'static/assets/virgo-logo.png',
        bounds
    );
    overlay.setMap(gMap.map);
    var clouds = new google.maps.weather.CloudLayer();
    clouds.setMap(gMap.map);
    
    //TODO: Do something special?
    google.maps.event.addListener(overlay, 'click', function() {
        gMap.map.setZoom(9);
    });
    gMap.events.initHeapEvents(gMap.events.MAP);

    
    var bass = new instrumentDefs.noiseBass();    

    var clock = new rhythm.Clock(60);
    var rhythmGen = new rhythm.Generator(clock, {
        targets: {
            nb: bass.playAction
        },
        seq: {
            //0: { subd: 0.9, val: {nb: ""} },
            //1: { subd: 0.207, val: {nb: ""} },
            //2: { subd: 0.111, val: {nb: ""} },
            //3: { subd: 0.5, val: {nb: ""} },
            4: { subd: 0.10, val: {nb: ""} }
        }
    });
    rhythmGen.loop = true;
    rhythmGen.locked = 0;
window.it = clock;
        clock.start();
        rhythmGen.execute(); 
});

