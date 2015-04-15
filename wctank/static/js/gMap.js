define(
    
    [
        'posts', 
        'util',
        'jquery',
        'async!https://maps.googleapis.com/maps/api/js?'+
            'key=AIzaSyCBYz-Rg_pR_L56O4h2k8Nr31VidEjtfAQ&'+
            'sensor=false&'+
            'libraries=weather'+
            '!callback'
    ], 

function(posts, util, $) { gMap = {}; 

    // On init, provides ref to google.maps.Map obj
    gMap.map;
   
    gMap.events = (function(events) {
        var event_groups = {
            map: {},
            marker: {}
        }; 

        var events_added = false;

        // events queued before initQueuedEvents is called 
        // will have their functions delegated to a single
        // listener for each different event. However, events added
        // after this point will be added individually, so, try to
        // favor the former.
        
        // adds events before or after gMap is ready.
        events.queue = function(loc, event, fn, once) {
            if ((events_added && loc === "marker") || !events_added ) {
                var evObj = function(once, fn) {
                    this.once = once;
                    this.fn = fn;
                };
                var add1 = once ? once : false;
                if (event_groups[loc].hasOwnProperty(event)) {
                    var len = Object.keys(event_groups[loc][event]).length;
                    event_groups[loc][event][len] = new evObj(add1, fn); 
                } else {
                    event_groups[loc][event] = {};
                    event_groups[loc][event][0] = new evObj(add1, fn);  
                }
            } else {
                if (once) {
                    google.maps.event.addListenerOnce(gMap.map, event, fn);
                } else {
                    google.maps.event.addListener(gMap.map, event, fn);
                }
            }
        };
        
        events.initQueuedEvents = function(set, marker) {
            events_added = true; 
            
            var ev_set = set ? event_groups[set] : event_groups.map;
            util.objectLength.call(ev_set);
            
            var addSingleEvent = function(event, fn, once, marker) {
                var caller = marker ? marker : gMap.map;
                if (once) {
                    google.maps.event.addListenerOnce(caller, event, fn);
                } else {
                    google.maps.event.addListener(caller, event, fn);
                }
            };
           
            var caller = (function() {
                if (set === 'map') {
                    return gMap.map;
                } else if ( (set === 'marker') && marker) {
                    return marker;
                } else if (set === 'marker') {
                    throw new Error("Invalid gMap.events.addQueuedEvents param: "+
                        "if set === 'marker', a target marker object must be provided.");
                }             
            }());

            for (var evnt in ev_set) { 
                if (ev_set.hasOwnProperty(evnt)) {
                    util.objectLength.call(ev_set[evnt]);
                    (function() { 
                        var persist = [];
                        var once = [];
                        for (var i = 0; i < ev_set[evnt].length; i++) {
                            if (ev_set[evnt][i].once) {
                                once.push(ev_set[evnt][i].fn); 
                            } else {
                                persist.push(ev_set[evnt][i].fn);
                            }
                        }
                        if (persist.length > 0) {
                            addSingleEvent(evnt, function() {
                                for (var i = 0; i < persist.length; i++) {
                                    persist[i](caller);
                                } 
                            }, false, marker);
                        }
                        if (once.length > 0) {
                            addSingleEvent(evnt, function() {
                                for (var i = 0; i < once.length; i++) {
                                    once[i](caller);
                                } 
                            }, true, marker);
                        }
                    }());
                }
            }
        };

        return events;
    }({}));

    // for tableux dev 
    gMap.tool = function() {
        console.log(gMap.map.center.lat()+" "+gMap.map.center.lng());
        console.log(gMap.map.zoom);
    };

    gMap.goTo = function(lat_latLng, lng_zoom, zoom) {
        if ( ('lat' in lat_latLng) && ('lng' in lat_latLng) ) {
            gMap.map.setCenter(lat_latLng);
            gMap.map.setZoom(lng_zoom);
        } else {   
            gMap.map.setCenter(new google.maps.LatLng(lat_latLng, lng_zoom));
            gMap.map.setZoom(zoom);
        }
    };
    
    gMap.init = function() {
        var mapOptions = {
            center: new google.maps.LatLng(43.1, -87.107180),
            zoom: 11,
            mapTypeId: google.maps.MapTypeId.SATELLITE,
            disableDefaultUI: true,
            zoomControl: false,
            zoomControlOptions: {
                position: google.maps.ControlPosition.LEFT_BOTTOM
            }
        };
        gMap.map = new google.maps.Map(document.getElementById("map-canvas"), mapOptions);
    
        gMap.pxOverlay = new google.maps.OverlayView();
        gMap.pxOverlay.draw = function() {};
        gMap.pxOverlay.setMap(gMap.map);
    };

    /*
     * zoom controls
     */
    gMap.zoomControlsVisible = function(b) {
        var $zoomCtl = $(".gmnoprint").not(".gm-style-cc");
        b ? $zoomCtl.show() : $zoomCtl.hide();
    };

    var zoom_plus = document.getElementById("zoom-in");
    var zoom_minus = document.getElementById("zoom-out");

    function randHex() {
        return '#'+Math.floor(Math.random()*16777215).toString(16);
    }

    var plus_last;

    zoom_plus.addEventListener("click", function() {
        try {
            var z = gMap.map.getZoom();
            gMap.map.setZoom(++z);
            plus_last = randHex();
            zoom_plus.style.color = plus_last;
        } catch(e) {
            // will throw if map isn't ready, so cover that up.
        }
    });

    zoom_plus.addEventListener("mouseover", function() {
        zoom_plus.style.color = "#eb054c";
    });

    zoom_plus.addEventListener("mouseout", function() {
        zoom_plus.style.color = plus_last;
    });


    var minus_last;

    zoom_minus.addEventListener("click", function() {
        try {
            var z = gMap.map.getZoom();
            gMap.map.setZoom(--z);
            minus_last = randHex();
            zoom_minus.style.color = minus_last;
        } catch (e) {}
    });

    zoom_minus.addEventListener("mouseover", function() {
        zoom_minus.style.color = "#eb054c";
    });

    zoom_minus.addEventListener("mouseout", function() {
        zoom_minus.style.color = minus_last;
    });

return gMap; });
