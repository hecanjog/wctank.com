wctank = wctank || {}; 
/*
 * tableux determines starting center and zoom level depending on what filter is selected first.
 */
wctank.tableux = (function(tableux) {
    wctank.util.aliasNamespace.call(tableux.prototype);
    tableux.flags = {};
    var dat = (function(dat) {
        dat.sets = {};
        dat.locs = [];
        var bit = 0x40000000;
        for (var i = 0; i < filterDefs.names.length; i++) {
            var name = filterDefs.names[i];
            dat.sets[ name ] = [];
            tableux.flags[ name.toUpperCase() ] = bit;
            bit = bit >>> 1;    
        }
        return dat; 
    }({})); 

    var pickTableux = function(filter) {
        var s = dat.sets[filter];
        var i = (Math.random() * s.length) | 0;
        gMap.map.setCenter(s[i].loc);
        gMap.map.setZoom(s[i].zoom);
    }; 
    var makeTableuxData = function(lat, lng, zoom, flag) {
        return {
            loc: new google.maps.LatLng(lat, lng),
            zoom: zoom,
            flag: flag
        };
    };
    tableux.pickTableux = function() {
        pickTableux(core.filters.current);
    };
    tableux.addTableux = function(lat, lng, zoom, flags) {
        dat.locs.push(makeTableuxData(lat, lng, zoom, flags));
    };
    tableux.parseTableux = function() {
        for (var i = 0; i < dat.locs.length; i++) {
            for (var t in tableux.flags) {
                if ( util.hasBit(dat.locs[i].flag, tableux.flags[t]) ) 
                   dat.sets[t.toLowerCase()]
                    .push({ loc: dat.locs[i].loc, zoom: dat.locs[i].zoom }); 
            }
        }  
    };
    return tableux;
}({}))
