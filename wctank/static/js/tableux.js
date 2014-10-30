wctank = wctank || {}; 
/*
 * tableux determines starting center and zoom level depending on what filter is selected first.
 */
wctank.tableux = (function(tableux) {
    var _ = wctank;
    var util = _.util;
    var gMap = _.gMap;
    var mapFilterDefs = _.mapFilterDefs;
    var mapFilters = _.mapFilters;

    tableux.flags = {};
    var filter_names = (function() {
        var list = [];
        for (var filter in mapFilterDefs.filters) {
            if ( mapFilterDefs.filters.hasOwnProperty(filter) )
                list.push( filter.toLowerCase() );
        }
        return list;
    }())
    var dat = (function(dat) {
        dat.sets = {};
        dat.locs = [];
        var bit = 0x40000000;
        for (var i = 0; i < filter_names.length; i++) {
            var name = filter_names[i];
            dat.sets[ name ] = [];
            tableux.flags[ name.toUpperCase() ] = bit;
            bit = bit >>> 1;    
        }
        return dat; 
    }({})); 
    var makeTableuxData = function(lat, lng, zoom, flag, exes) {
        return {
            loc: new google.maps.LatLng(lat, lng),
            zoom: zoom,
            flag: flag,
            exes: exes
        };
    };
    tableux.pick = function(filter) {
        var s = dat.sets[filter];
        var i = (Math.random() * s.length) | 0;
        gMap.map.setCenter(s[i].loc);
        gMap.map.setZoom(s[i].zoom);
        if (s[i].exes) {
            for (var j = 0; j < s[i].exes.length; j++) {
                s[i].exes[j]();
            }
        }
    };
    tableux.add = function(lat, lng, zoom, flags, exes) {
        dat.locs.push(makeTableuxData(lat, lng, zoom, flags, exes));
    };
    tableux.parse = function() {
        for (var i = 0; i < dat.locs.length; i++) {
            for (var t in tableux.flags) {
                if ( util.hasBit(dat.locs[i].flag, tableux.flags[t]) ) 
                   dat.sets[t.toLowerCase()]
                    .push({ loc: dat.locs[i].loc, zoom: dat.locs[i].zoom, exes: dat.locs[i].exes }); 
            }
        }  
    };
    return tableux;
}({}))
