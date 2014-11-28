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
            conv.wetDry(100);
            var sub = new audioActors.SubtractiveSynthesis(false);
            //sub.start();
            
            vox.link(sub, null, 0).link(verb).link(audio.out);
            vox.link(conv).link(sub, 0, 1);
            
            conv.link(audio.out);
            conv.gain.value = 0.1;
            window.supdate = sub.updateFromSound;
            sub.wetDry(100);

            var vibEve = function() {
                //for (var i = 0; i < bank.length; i++) {
              //      bank[i].accent();
                //}
            };
            var turnOff = function() {
                //for (var i = 0; i < bank.length; i++) {
                //    bank[i].fadeInOut(2000);//util.smudgeNumber(10000, 50));
                //}
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

