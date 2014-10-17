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
            VHS:          0x0000F000
        };
        var makeTableuxData = function(lat, lng, zoom, tag) {
            var r = {};
            r.loc = new google.maps.LatLng(lat, lng);
            r.zoom = zoom;
            r.tag = tag;
            return r;
        };
        dat.locs = [
            makeTableuxData(43.035578033062414, -87.92508879368779, 20, tags.PRINT_ANALOG),
            makeTableuxData(42.70103069787964, -87.99994131176345, 18, tags.CAUSTIC_GLOW),
            makeTableuxData(41.73787991072762, -87.47784991638764, 16, tags.CMGYK), 
            makeTableuxData(42.75690051169562, -87.80957013350911, 20, tags.VHS)
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


