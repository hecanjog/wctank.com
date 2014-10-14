wctank = wctank || {};

//incorporate alpha strut
//make class for tableux
wctank.sequencer = (function(sequencer) {
    wctank.aliasNamespace.call(sequencer.prototype);
    
    var current_stage = null;
    var stages = {
        0: function() {
            WebFont.load({custom: {families: [
                        'timeless',
                        'timelessbold',
                        'frutigerlight',
                        'timelessitalic',
                        'frutigerlightitalic',
                        'frutigerbold'
                    ]
                }
            });
            var startMap = function() {
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
            };
            google.maps.event.addDomListener(window, 'load', startMap);
            filterDefs.addReadyListener(core.filters.start);
        },
    };
    stages.length =  Object.keys(stages).length;
    
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
    return sequencer;
}({}))

wctank.sequencer.goTo(0);
