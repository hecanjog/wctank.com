wctank = wctank || {}; 
/*
 * tableux determines starting center and zoom level depending on what filter is selected first.
 */
wctank.tableux = (function(tableux) {
    var util = wctank.util;
    var gMap = wctank.gMap;
    var defs = wctank.mapFilters.defs;
    var instances = wctank.mapFilters.instances;

    tableux.flags = {};
    var filter_names = (function() {
        var list = [];
        for (var filter in defs) {
            if ( defs.hasOwnProperty(filter) )
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
    
    var TableuxDataTuple = function TableuxDataTuple(lat, lng, zoom, flag, exes) {
        this.loc = new google.maps.LatLng(lat, lng);
        this.zoom = zoom;
        this.flag = flag;
        exes = exes;
    };
    tableux.add = function(lat, lng, zoom, flags, exes) {
        dat.locs.push( new TableuxDataTuple(lat, lng, zoom, flags, exes) );
    };
    
    tableux.pick = function(filter) {
        var s = dat.sets[filter];
        var i = (Math.random() * s.length) | 0;
        gMap.goTo(s[i].loc, s[i].zoom);
        if (s[i].exes) {
            for (var j = 0; j < s[i].exes.length; j++) {
                s[i].exes[j]();
            }
        }
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
