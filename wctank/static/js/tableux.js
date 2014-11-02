/*
 * tableux determines starting center and zoom level depending on what filter is selected first.
 */
define(
    [
        'util',
        'gMap',
        'mapFilterDefs'
    ],

function(util, gMap, mapFilterDefs) { var tableux = {};

    var filter_names = (function() {
        var names = [];
        for (var cycledFilter in mapFilterDefs) {
            if ( mapFilterDefs.hasOwnProperty(cycledFilter) ) 
                names.push( cycledFilter.toLowerCase() )
        }
        return names;
    }())

    tableux.flags = {};
    var sets = {};
   
    var bit = 0x40000000;
    for (var i = 0; i < filter_names.length; i++) {
        var name = filter_names[i];
        sets[ name.toLowerCase() ] = [];
        tableux.flags[ name.toUpperCase() ] = bit;
        bit = bit >>> 1;    
    }
    
    var TableuxDataTuple = function TableuxDataTuple(lat, lng, zoom, flag, exes) {
        this.loc = new google.maps.LatLng(lat, lng);
        this.zoom = zoom;
        this.flag = flag;
        exes = exes;
    };
    tableux.add = function(lat, lng, zoom, flags, exes) {
        var data = new TableuxDataTuple(lat, lng, zoom, flags, exes);
        for (var t in tableux.flags) {
            if ( util.hasBit(data.flag, tableux.flags[t]) ) 
                sets[t.toLowerCase()].push(data); 
        }
    };
    
    tableux.pick = function(filter) {
        var s = sets[filter.css_class];
        var i = (Math.random() * s.length) | 0;
        gMap.goTo(s[i].loc, s[i].zoom);
        if (s[i].exes) {
            for (var j = 0; j < s[i].exes.length; j++) {
                s[i].exes[j]();
            }
        }
    };
    
return tableux; });
