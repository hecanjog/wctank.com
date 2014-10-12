// UTILITY FUNCTION TO GET CURRENT EVENTS
var gMap = (function(gMap) {
    gMap.map; 
    
    /*
     * the event heap is used to init events associated with google map objects;
     * after initial load, this interface should only be used to hook into marker events
     * while others should be added dynamically using google.maps.event.addListener 
     * with the map (gMap.map) object directly
     */
    var evHeap = function(evHeap) {
        evHeap.MAP = 'map_events';
        evHeap.MARKER = 'marker_events';
        var heap = {
            map_events: {},
            marker_events: {}
        }; 
        evHeap.push = function(loc, event, fn, once) {
            //console.log(loc+" "+event+" "+fn.toString()+" "+once);
            var makeEvObj = function(once, fn) {
                return { once: once, fn: fn } 
            };
            var add1 = once ? once : false;
            if ( heap[loc].hasOwnProperty(event) ) {
                var len = Object.keys(heap[loc][event]).length;
                heap[loc][event][len] = makeEvObj(add1, fn); 
            } else {
                heap[loc][event] = {};
                heap[loc][event][0] = makeEvObj(add1, fn);  
            }
        };
        var addSingleEvent = function(event, fn, once, marker) {
            var caller = marker ? marker : gMap.map;
            if (once) {
                google.maps.event.addListenerOnce(caller, event, fn);
            } else {
                google.maps.event.addListener(caller, event, fn);
            }
        };
        evHeap.dBug = function() {
            console.log(heap);
        };
        evHeap.addHeapEvents = function(set, marker) {
            var ev_set = set ? heap[set] : heap.map_events;
            var caller = (function() {
                if (set === evHeap.MAP) {
                    return gMap.map;
                } else if ( (set === evHeap.MARKER) && marker) {
                    return marker;
                } else if (set === evHeap.MARKER) {
                    throw "for marker events, must provide marker as target!";
                } else {
                    throw "err: events could not be added";
                }
            }())
            var nOfChildKeys = function(obj) {
                var n = 0;
                for (var p in obj) {
                    if ( obj.hasOwnProperty(p) ) {
                        n++;
                    }
                }
                return n;
            }; 
            for (var ev in ev_set) { 
                if ( ev_set.hasOwnProperty(ev) ) {
                    (function() {
                        var persist = [];
                        var once = [];
                        for (var i = 0; i < nOfChildKeys(ev_set[ev]); i++) {
                            if (ev_set[ev][i].once) {
                                once.push(ev_set[ev][i].fn); 
                            } else {
                                persist.push(ev_set[ev][i].fn)
                            }
                        }
                        if (persist.length > 0) {
                            addSingleEvent(ev, function() {
                                for (var i = 0; i < persist.length; i++) {
                                    persist[i](caller);
                                } 
                            }, false, marker);
                        }
                        if (once.length > 0) {
                            addSingleEvent(ev, function() {
                                for (var i = 0; i < once.length; i++) {
                                    once[i](caller);
                                } 
                            }, true, marker);
                        }
                    }())
                }
            }
        };
        return evHeap;
    }({});
    
    // public events members
    gMap.events = {
        MAP: evHeap.MAP,
        MARKER: evHeap.MARKER,
        push: evHeap.push,
        dBug: evHeap.dBug
    };
    
    gMap.init = function() {
        gMap.map = new google.maps.Map(document.getElementById("map-canvas"), {
            center: new google.maps.LatLng(43.1, -87.107180),
            zoom: 11,
            mapTypeId: google.maps.MapTypeId.SATELLITE,
            disableDefaultUI: true,
            zoomControl: true,
            zoomControlOptions: {
                position: google.maps.ControlPosition.LEFT_BOTTOM
            }
        });
        // refactor overlays to main?
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
        var m_px = new google.maps.OverlayView();
        m_px.draw = function() {};
        m_px.setMap(gMap.map);
        markers.setOverlay(m_px);

        //TODO: Do a little something special?
        // factor this out
        google.maps.event.addListener(overlay, 'click', function() {
            gMap.map.setZoom(9);
        });

        // Any events in submodules that need access to the map object
        // should be instantiated here
        (function initEvents() {
            window.setTimeout(function() {
                try {
                    evHeap.addHeapEvents(evHeap.MAP);
                } catch(err) {
                    initEvents();
                }
            }, 250);
        }())

        google.maps.event.addListener(gMap.map, 'idle', function() {
            posts.get(gMap.map.getBounds(), function(data) {
                $.each(data, function(i, post) {
                    var m;
                    var loc = new google.maps.LatLng(post.lat, post.long);
                    var markerOptions = {
                        position: loc,
                        map: gMap.map,
                        icon: "static/assets/blank.png"
                    };
                    m = new google.maps.Marker(markerOptions);
                    m.markerType = post.markerType;
                    markers.addMarker(m);
                    evHeap.addHeapEvents(evHeap.MARKER, m);
                    google.maps.event.addListener(m, 'click', function() { posts.display(post); });
                });
            });
        });
    }; 
    return gMap;
}({}));
