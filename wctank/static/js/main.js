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
            sceneGraphCore, audio) {
    
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
        // asdr.Generator separate gets for first half and second half?
        // envelope looping mechanism
        var noiseAsdr = new asdr.Generator();
        
        noiseAsdr.attack = new asdr.ComponentEnvelope(50, 'linear', null,
            [ 0, 0,    1, 50,    0.3, 99 ].envelopeValues);
        
        noiseAsdr.sustain = new asdr.Sustain(1000, 0.3);
        
        noiseAsdr.decay = new asdr.ComponentEnvelope(100, 'linear', null, 
            [ 0.3, 0,    0.8, 20,    0.1, 99 ].envelopeValues);
        
        noiseAsdr.release = new asdr.ComponentEnvelope(50, 'linear', null, 
            [ 0.1, 0,    0, 99 ].envelopeValues);

        var trigger = new instrument.ParameterizedAction(noise.gain.gain);

        this.play = function(msec) {
            trigger.envelope = noiseAsdr.getASDR(msec);
            trigger.execute(10); 
        };
    };
    test.prototype = new instrument.Instrument();

    var ohman = new test();

    window.playInstrument = ohman.play;
});

