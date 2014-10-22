wctank = wctank || {};

// TODO: UTILITY FUNCTION TO GET CURRENT EVENTS
wctank.gMap = (function(gMap) {
    wctank.util.aliasNamespace.call(gMap.prototype); 
    
    // On init, provides ref to google.maps.Map obj
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
        evHeap.addHeapEvents = function(set, marker) {
            var ev_set = set ? heap[set] : heap.map_events;
            util.objectLength.call(ev_set);
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
            for (var ev in ev_set) { 
                if ( ev_set.hasOwnProperty(ev) ) {
                    util.objectLength.call(ev_set[ev]);
                    (function() { //I'm so ready for let
                        var persist = [];
                        var once = [];
                        for (var i = 0; i < ev_set[ev].length; i++) {
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
    
    // public evHeap members
    gMap.events = {
        MAP: evHeap.MAP,
        MARKER: evHeap.MARKER,
        initHeapEvents: evHeap.addHeapEvents,
        push: evHeap.push
    };
    gMap.tool = function() {
        console.log(gMap.map.center.lat()+" "+gMap.map.center.lng());
        console.log(gMap.map.zoom);
    };
    
    gMap.init = function() {
        var mapOptions = {
            center: new google.maps.LatLng(43.1, -87.107180),
            zoom: 11,
            mapTypeId: google.maps.MapTypeId.SATELLITE,
            disableDefaultUI: true,
            zoomControl: true,
            zoomControlOptions: {
                position: google.maps.ControlPosition.LEFT_BOTTOM
            }
        };
        gMap.map = new google.maps.Map(document.getElementById("map-canvas"), mapOptions);
    
        var m_px = new google.maps.OverlayView();
        m_px.draw = function() {};
        m_px.setMap(gMap.map);
        markers.setOverlay(m_px);
         
        google.maps.event.addListener(gMap.map, 'tilesloaded', function() {
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

    gMap.zoomControlsVisible = function(b) {
        var $zoomCtl = $(".gmnoprint").not(".gm-style-cc");
        b ? $zoomCtl.show() : $zoomCtl.hide(); 
    };

    return gMap;
}({}));
