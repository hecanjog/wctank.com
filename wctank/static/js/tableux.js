wctank = wctank || {}; 

/*
 * tableux determines starting center and zoom level depending on what filter is selected first.
 */
wctank.tableux = (function(tableux) {
    wctank.util.aliasNamespace.call(tableux.prototype);
    var dat = (function(dat) {
        dat.sets = {
            print_analog: [],
            caustic_glow: [],
            cmgyk: [],
            vhs: []
        };
        var tags = {
            PRINT_ANALOG: 0x0F000000,
            CAUSTIC_GLOW: 0x00F00000,
            CMGYK:        0x000F0000,
            VHS:          0x0000F000,
        };
        var makeTableuxData = function(lat, lng, zoom, tag) {
            return {
                loc: new google.maps.LatLng(lat, lng),
                zoom: zoom,
                tag: tag
            };
        };
        dat.locs = [
            makeTableuxData(43.035578033062414, -87.92508879368779, 20, tags.PRINT_ANALOG),
            makeTableuxData(42.70103069787964, -87.99994131176345, 18, tags.CAUSTIC_GLOW),
            makeTableuxData(41.73787991072762, -87.47784991638764, 16, tags.CMGYK | tags.CAUSTIC_GLOW), 
            makeTableuxData(42.75690051169562, -87.80957013350911, 20, tags.VHS),
            makeTableuxData(57.98276027896727, -122.41318245308503, 4, tags.PRINT_ANALOG | tags.CAUSTIC_GLOW),
            makeTableuxData(41.73788064076405, -87.54661773794578, 20, tags.PRINT_ANALOG),
            makeTableuxData(41.351808897930226, -89.22587973528789, 16, 
                            tags.VHS | tags.CAUSTIC_GLOW | tags.PRINT_ANALOG),
            makeTableuxData(1.31960789248782, -89.7875060971246, 20, tags.VHS),
            makeTableuxData(41.3207838120689, -89.8110525395141, 16, tags.VHS | tags.PRINT_ANALOG | tags.CMGYK),
            // this one is nice consider maing fauvist a start
            makeTableuxData(50.67774455640808, -111.7312581585038, 19, 
                            tags.PRINT_ANALOG | tags.CAUSTIC_GLOW | tags.CMGYK | tags.VHS) 
        ];
        (function() {
            for (var i = 0; i < dat.locs.length; i++) {
                for (var t in tags) {
                    if ( util.hasBit(dat.locs[i].tag, tags[t]) ) 
                       dat.sets[t.toLowerCase()]
                        .push({ loc: dat.locs[i].loc, zoom: dat.locs[i].zoom }); 
                }
            }   
        }())
        return dat; 
    }({})); 

    var pickTableux = function(filter) {
        var s = dat.sets[filter];
        var i = (Math.random() * s.length) | 0;
        gMap.map.setCenter(s[i].loc);
        gMap.map.setZoom(s[i].zoom);
    }; 
    tableux.pickTableux = function() {
        pickTableux(core.filters.current);
    }; 

    return tableux;
}({}))


