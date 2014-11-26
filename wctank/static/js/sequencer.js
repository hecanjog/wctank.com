define(
    [
        'util',
        'gMap',
        'mapFilterCycle',
        'tableux',
        'audio',
        'audioElements',
        'audioActors',
        'text!SpriteIntervals.TextGridIntervals',
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

function(util, gMap, mapFilterCycle, tableux, 
         audio, audioElements, audioActors, SpriteIntervals) { var sequencer = {};
    
    var current_stage = null;
    var stages = {
        0: function() {
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
            tableux.pick(mapFilterCycle.start()); 

            /*
             * audio dev whateves
             */
            //var noise = audioElements.Noise(); 
            var vox = audioElements.SpritePlayer('/static/assets/wes.mp3', SpriteIntervals); 
            var verb = audioElements.SchroederReverb();
            var conv = audioElements.Convolution('/static/assets/jla.mp3');
            window.convwet = conv.wetDry;
            //var verb2 = audioElements.SchroederReverb();
            //var verb3 = audioElements.SchroederReverb();
            //verb3.wetDry(80);
            //verb3.setFeedbackCoeffMultiplier(1.15);
            var bank = [
                audioElements.Bandpass(262, 140),
                audioElements.Bandpass(327.5, 140),
                audioElements.Bandpass(393, 140),
                audioElements.Bandpass(500, 140),
            ];
            //var tri = audioElements.Osc('triangle', 440, 0.8);
            //tri.start();
            //noise.start();
            for (var i = 0; i < bank.length; i++) {
           //     noise.link(bank[i]);
            }
            //vox.link(verb);
            //verb.link(audio.out);
            vox.link(conv).link(verb).link(audio.out);
            
            //noise.start();
            for (var i = 0; i < bank.length; i++) {
             //   bank[i].link(conv);
                //bank[i].link(verb2);
            } 
            //tri.link(conv);
            //conv.link(audio.out);
            //noise.start();

            var vibEve = function() {
                for (var i = 0; i < bank.length; i++) {
                    bank[i].accent();
                }
            };
            var turnOff = function() {
                for (var i = 0; i < bank.length; i++) {
                    bank[i].fadeInOut(2000);//util.smudgeNumber(10000, 50));
                }
            };
            var whatever = 0;
            window.glissDbg = function(freq, time) {
                whatever = freq * 0.75;
                for (var i = 0; i < bank.length; i++) {
                    bank[i].setFrequency(whatever, time);
                    whatever *= 1.10;
                }
                //censor_out_that_thanks.setFrequency(freq, time);
            };
            google.maps.event.addListenerOnce(gMap.map, 'zoom_changed', function() {
               google.maps.event.addListener(gMap.map, 'zoom_changed', turnOff);
            }); 
            google.maps.event.addListener(gMap.map, 'drag', vibEve);
            google.maps.event.addListener(gMap.map, 'dragstart', function() {
                vox.playRandomSprite();
            }); 
        },
    };
    util.objectLength.call(stages);
    
    var callStage = function(n) {
        current_stage = n;
        stages[n]();
    };
    sequencer.goTo = function(n) {
        callStage(n);
    };
    sequencer.forward = function() {
        var next = current_stage + 1;
        if (next < stages.length) {
            callStage(next);
        } else {
            throw "stage undefined!";
        }
    };
    sequencer.back = function() {
        var next = current_stage - 1;
        if (next >= 0) {
            callStage(next);
        } else {
            throw "stage undefined!";
        }
    };
    sequencer.getCurrentStage = function() {
        return current_stage;
    };
return sequencer; });

