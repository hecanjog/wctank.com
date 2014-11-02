define(
    [
        'util',
        'gMap',
        'mapFilterCycle',
        'tableux',
        'audio',
        'audioElements',
        'audioActors',
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
         audio, audioElements, audioActors) { var sequencer = {};
    
    var current_stage = null;
    var stages = {
        0: function() {
            gMap.init();
            console.log(google);
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
            var noise = audioElements.Noise(); 
            var bank = [
                audioElements.Bandpass(262, 140),
                audioElements.Bandpass(327.5, 140),
                audioElements.Bandpass(393, 140),
                audioElements.Bandpass(500, 140),
            ];
            var censor_out_that_thanks = audioElements.Osc('triangle', 440, 0.6);
            censor_out_that_thanks.start();
            for (var i = 0; i < bank.length; i++) {
                noise.link(bank[i]);
                censor_out_that_thanks.link(bank[i]);
            }
            noise.start();
            for (var i = 0; i < bank.length; i++) {
                bank[i].link(audio.out);
            }             
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
                censor_out_that_thanks.setFrequency(freq, time);
            };
            google.maps.event.addListenerOnce(gMap.map, 'zoom_changed', function() {
               google.maps.event.addListener(gMap.map, 'zoom_changed', turnOff);
            }); 
            google.maps.event.addListener(gMap.map, 'drag', vibEve);
             
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

