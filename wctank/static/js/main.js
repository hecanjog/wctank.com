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
            sceneGraphCore, audio, rhythm) {
    
    window.rhythm = rhythm; 
    
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

    var test = function() {
        var noise = audioElements.Noise();
        noise.gain.gain.value = 0.0;
        noise.link(audio.out);
        noise.start();
        
        // envelope looping mechanism
        // bubble changes through envelopes so that asdr can recalc if any properties have changed
        // calc asdr on set, not get
        // two breakpoints in Sustain or one?
        // more generic envelope generator?
        // nix pushing on absoluteEnvelope.valueSequence set in favor of explicit push
        // testing for audio things
        // move tweenUtil into sceneGraph module, not audioUtil
        // throw error objects, not strings
        // Generator setter in shorthand syntax
        // rhythmGen.execute should start ref'd clock.
        var noiseAsdr = new asdr.Generator({
            a: {
                dur: 200,
                inter: {
                    type: 'linear'
                },
                val: [ 0, 0,  1, 50,  0.3, 99 ]
            },
            s: {
                dur: 1000,
                val: 0.3
            },
            d: {
                dur: 100,
                inter: {
                    type: 'linear'
                },
                val: [ 0.3, 0,  0.8, 20,  0.1, 99 ]  
            },
            r: {
                dur: 200,
                inter: {
                    type: 'linear'
                },
                val: [ 0.1, 0,  0, 99 ]
            }
        });

        

        var trigger = new instrument.ParameterizedAction(noise.gain.gain);
        trigger.envelope = noiseAsdr.getASDR(1000);

        var clock = new rhythm.Clock(60);
        var rhythmGen = new rhythm.Generator(clock, {
            targets: {
                noise: trigger
            },
            seq: {
                1: {
                    subd: 1.3,
                    val: {
                        noise: ""
                    }
                }

            }
        });

        window.rhythmGen = rhythmGen;
        
        this.on = function() {
            trigger.envelope = noiseAsdr.getAS();
            trigger.execute();
        };
        this.off = function() {
            trigger.envelope = noiseAsdr.getDR();
            trigger.execute();
        };

        this.play = function(msec) {
            trigger.envelope = noiseAsdr.getASDR(msec);
            trigger.execute(); 
        };

    };
    test.prototype = new instrument.Instrument();

    var ohman = new test();
    window.sustain = ohman.on;
    window.off = ohman.off;
    window.playInstrument = ohman.play;
});

