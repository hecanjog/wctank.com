//unique lengths for each filter ... interval/timeout multiplier
// TODO: remove fn / constructor / css_class tangle
// -38.23189840361451 146.42333777291972 gMap.js:103
// 15 
define(
    [
        'util',
        'div',
        'visCore',
        'gMap'
    ],

function(util, div, visCore, gMap) { var mapFilterCycle = {};
    
    mapFilterCycle.CycledFilter = function CycledFilter() {
        this.usage = 0x0;
    };
    mapFilterCycle.CycledFilter.prototype = new visCore.MapFilter(); 

    mapFilterCycle.usageFlags = {
        // filter can be called on an /idle_interval setInterval
        GENERAL:        0x40000000,             
        // filter can be called when zoom level >= 17
        ZOOMED:         0x20000000,             
        // if filter called on zoom >= 17 event, persists when zoom < 17
        TAKEOVER_DOWN:  0x10000000,
        // if filter already called, zoom >= 17 event has no effect
        TAKEOVER_UP:    0x08000000,             
        // filter can be called on load
        START:          0x04000000, 
    };
   
    mapFilterCycle.current = null;
     
    var sets = {
        general: [],
        zoomed: [],
        takeover_down: [],
        takeover_up: [],
        start: [],
        webgl: []
    };
     
    mapFilterCycle.parse = function(cycledFilter) {
        uses = mapFilterCycle.usageFlags;
        for (var flag in uses) {
            if ( uses.hasOwnProperty(flag) ) {
                if ( util.hasBit(cycledFilter.usage, uses[flag]) ) 
                    sets[flag.toLowerCase()].push(cycledFilter);
            }
        }
        if (cycledFilter.webgl) sets.webgl.push(cycledFilter);
    };

    mapFilterCycle.pushCategory = function(filter, category) {
        var usageFlags = mapFilterCycle.usageFlags;
        for (var flag in usageFlags) {
            if ( usageFlags.hasOwnProperty(flag) ) {
                if (category === usageFlags[flag]) 
                    sets[flag.toLowerCase()].push(filter);
            }
        }
    };


    mapFilterCycle.rm = function(filter) {
        for (var cat in sets) {
            if ( sets.hasOwnProperty(cat) && (cat !== "webgl") ) {
            var idx = sets[cat].indexOf(filter);
                if (idx > -1) sets[cat].splice(idx, 1);
            }
        }
    };

    // if webgl init fails, disable filters dependent on it.
    if (!visCore.webgl.success) sets.webgl.forEach(mapFilterCycle.rm); 

    // TODO: consider displaying message to encourage WebGl use
    var was_in_close = false,
        new_filter,
        old_filter;

    mapFilterCycle.apply = function(filter) {
        mapFilterCycle.current = filter;
        if (new_filter) new_filter.operate('teardown');
        filter.operate('init');
        old_filter = new_filter;
        new_filter = filter;
        if ( sets.takeover_down.indexOf(filter) !== -1 ) old_filter = filter;   
    };

    var applyRndFilter = function(arr) {
        var nf = util.getRndItem(arr);
        (function checkDup() {
            if (nf === new_filter) {
                nf = util.getRndItem(arr);
                checkDup();
            }
        }())
        mapFilterCycle.apply(nf);
    };

    mapFilterCycle.forceApply = function() {
        applyRndFilter(sets.general);
    };

    var close_thresh = 17;
    var onZoom = function(map_obj) {
        if ( was_in_close && (map_obj.zoom <= close_thresh) ) {
            mapFilterCycle.apply(old_filter);
            was_in_close = false;
        } else if ( !was_in_close && (map_obj.zoom > close_thresh) 
                   && (sets.takeover_up.indexOf(new_filter) === -1) ) {
            applyRndFilter(sets.zoomed);
            was_in_close = true;
        }       
    };
    gMap.events.push(gMap.events.MAP, 'zoom_changed', onZoom);

    /*
     * mainTime coordinates setTimeout-driven filter changes
     */
    //TODO: consider enforcing maximum pause - 4 min or something
    var mainTime = (function(mainTime) {
        var interval_base = 30000,
            interval,
            start,
            cease = 0,
            elapsed,
            id,
            first = true,
            is_engaged = false;
        
        var update = function() {
            start = Date.now();
            if (first) {
                applyRndFilter(sets.start);
                first = false;
            } else {
                applyRndFilter(sets.general);
            }
        };
        //dep setInterval
        mainTime.setInterval = function(n) {
            mainTime.pause();
            mainTime.start(n);
        };
        
        mainTime.start = function(n) {
            var setAndUpdateInterval = function(n) {
                if (n) interval_base = n;
                interval = util.smudgeNumber(interval_base, 10);
            };
            
            n ? setAndUpdateInterval(n) : setAndUpdateInterval();
           
            function updateAndLoop() {
                update();
                loop();
            }
            function clearPausedParams() {
                elapsed = 0;
                cease = 0;
            }
            function loop() {
                id = window.setTimeout(function() {
                    setAndUpdateInterval();
                    updateAndLoop();
                }, interval);
            }
                            
            if (is_engaged) {
                mainTime.pause();
                is_engaged = false;
                mainTime.start();
            } else {
                is_engaged = true;
                if (cease !== 0) {
                    if ( (Date.now() - cease) > interval ) {
                        updateAndLoop();
                        clearPausedParams();
                    } else {
                        id = window.setTimeout(function() {
                            updateAndLoop();
                            clearPausedParams();
                        }, interval - elapsed);
                    }
                } else {
                    setAndUpdateInterval();
                    updateAndLoop();
                }
            }
            return mapFilterCycle.current;
        };
        
        mainTime.pause = function() {
            cease = Date.now();
            elapsed = cease - start;
            window.clearInterval(id);
            window.clearTimeout(id);
        };
        return mainTime;
    }({}))

    // alias .engage() so that it can be called during filter init
    mapFilterCycle.start = mainTime.start;
    mapFilterCycle.pause = mainTime.pause;

    /* 
     * events
     */
    var marker_clicked = false;

    var onMarkerClick = function() {
        marker_clicked = true;
        window.setTimeout(function() {
            marker_clicked = false;
        }, 100);
        if ( div.$overlay.is(":hidden") ) mainTime.pause();
    };
    gMap.events.push(gMap.events.MARKER, 'click', onMarkerClick);

    var onMapClick = function() {
        if ( !div.$overlay.is(":hidden") ) {
            window.setTimeout(function() {
                if (!marker_clicked) mainTime.start();
            }, 50);
        }
    };
    gMap.events.push(gMap.events.MAP, 'click', onMapClick);  

return mapFilterCycle; });

