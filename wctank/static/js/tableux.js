wctank = wctank || {}; 

/*
 * tableux determines starting center and zoom level depending on what filter is selected first.
 */
wctank.tableux = (function(tableux) {
    wctank.aliasNamespace.call(tableux.prototype);
    var makeTableuxData = function(lat, lng, zoom) {
        var r = {};
        r.loc = new google.maps.LatLng(lat, lng);
        r.zoom = zoom;
        return r;
    };

    var dat = {
        print_analog: [
            makeTableuxData(43.035578033062414, -87.92508879368779, 20)
        ],
        caustic_glow: [
            makeTableuxData(42.70103069787964, -87.99994131176345, 18)
        ],
        cmgyk: [
            makeTableuxData(41.73787991072762, -87.47784991638764, 16)
        ],
        vhs: [
            makeTableuxData(42.75690051169562, -87.80957013350911, 20)
        ]  
    };

    var pickTableux = function(filter) {
        var set = dat[filter];
        var idx = (Math.random() * set.length) | 0;
        var center = set[idx].loc;
        var zoom = set[idx].zoom;
        gMap.map.setCenter(center);
        gMap.map.setZoom(zoom);
    }; 
    
    tableux.pickTableux = function() {
        pickTableux(core.filters.current);
    }; 

    return tableux;
}({}))


