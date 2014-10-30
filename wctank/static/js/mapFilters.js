wctank = wctank || {};
//unique lengths for each filter ... interval/timeout multiplier
wctank.mapFilters = (function(mapFilters) {
    mapFilters._mapFiltersReady = new Event('mapFiltersReady');
    mapFilters.addReadyListener = function(fn) { 
        document.addEventListener('mapFiltersReady', function() {
            fn();
            document.removeEventListener('mapFiltersReady', fn);
        }); 
    };

    mapFilters.FilterType = function Filter() { /// change this!!!
        this.usage = 0x00000000; // from flags in .usage
        this.css_class = '';
        this.preInit = null; //function() {};
        this.init = null; //function() {};
        this.animate = null; //function() {};
        this.preTeardown = null; //function() {};
        this.teardown = null //function() {};
    };

    mapFilters.usageFlags = {
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
        NONE:           0x00000000
    };

    return mapFilters;
}({}))

