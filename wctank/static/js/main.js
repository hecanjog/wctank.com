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
        'util',
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
            sceneGraphCore, audio, rhythm, instrumentDefs, util) {
   
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

    var clock = new rhythm.Clock(100);
    
    var config = {
        opt: {
            loop: true
        },
        targets: {
            nb: bass
        },
        seq: { 
            //0: { subd: 0.1, val: {nb: ""}, rep: 10, smudge: 0 }, // implement indiv subd smudge
            //1: { subd: 0.5, val: {nb: ""}, rep: 1 },
            //2: { subd: 0.25, val: {nb: ""}, rep: 1 },
            //3: { subd: 0.07, val: {nb: ""}},
            4: { subd: 0.25, val: {nb: ""}},
            5: { subd: 0.25, val: {nb: ""}}
        },
        callbacks: function() {
            console.log('all done!!!');
        }
         
        //TODO: sequence repeats
        // transitioning between rhythmic patterns
        // indiv subd smudge
        //TODO: facilitate easy bpm changes
    };
   
    //TEST: swap config

    var rhythmGen = new rhythm.Generator(clock, config);
    
window.clock = clock;
    clock.start();
    rhythmGen.execute(); 
});

