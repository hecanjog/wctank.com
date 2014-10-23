wctank = wctank || {}; 

/*
 * tableux determines starting center and zoom level depending on what filter is selected first.
 */
wctank.tableux = (function(tableux) {
    wctank.util.aliasNamespace.call(tableux.prototype);
    var dat = (function(dat) {
        dat.sets = {};
        var flags =  {};
        
        var bit = 0x40000000;
        for (var i = 0; i < filterDefs.names.length; i++) {
            var name = filterDefs.names[i];
            dat.sets[ name ] = [];
            flags[ name.toUpperCase() ] = bit;
            bit = bit >>> 1;    
        }

        var makeTableuxData = function(lat, lng, zoom, flag) {
            return {
                loc: new google.maps.LatLng(lat, lng),
                zoom: zoom,
                flag: flag
            };
        };
        dat.locs = [
            // try another highway one
            makeTableuxData(43.035578033062414, -87.92508879368779, 20, 
                            flags.PRINT_ANALOG),
            // farmhouse + field
            makeTableuxData(42.70103069787964, -87.99994131176345, 18, 
                            flags.CAUSTIC_GLOW),
            // 1/2 404 - try another 404 filled one?
            makeTableuxData(41.73787991072762, -87.47784991638764, 16, 
                            flags.CMGYK | flags.CAUSTIC_GLOW), 
            // runway 32 
            makeTableuxData(42.75690051169562, -87.80957013350911, 20, 
                            flags.VHS),
            // asia, man 
            makeTableuxData(57.1222173898899, -264.905858234335, 4, 
                            flags.PRINT_ANALOG | flags.CAUSTIC_GLOW),
            // some building? 
            makeTableuxData(41.351808897930226, -89.22587973528789, 16, 
                            flags.VHS | flags.CAUSTIC_GLOW | flags.PRINT_ANALOG),
            // this one is nice consider maing fauvist a start
            makeTableuxData(50.677401244851545, -111.73200775079476, 18, 
                            flags.FAUVIST | flags.PRINT_ANALOG | flags.CAUSTIC_GLOW | 
                            flags.TROLLER | flags.CMGYK | flags.VHS),
            // colorful building
            makeTableuxData(43.04786791144118, -87.90162418859109, 19,
                            flags.PRINT_ANALOG)
            // yves klein-ish - like this one
            makeTableuxData(51.740833805621726, -259.4416938221475, 19,
                            flags.FAUVIST)
            // another colorful mountain
            makeTableuxData(50.728666177507385, 99.64364876389303, 18,
                            flags.FAUVIST | flags.PRINT_ANALOG)
            // '"painterly"' topology              
            makeTableuxData(41.655883166693386, 114.55841367391989, 17,
                            flags.FAUVIST | flags.PRINT_ANALOG)   
            // a lake
            makeTableuxData(47.446640175241484 117.25771708887626, 16,
                            flags.FAUVIST | flags.PRINT_ANALOG)
            // river, boats
            makeTableuxData(43.01021208352276, 272.1016006032805, 20,
                            flags.FAUVIST | flags.VHS) 
        ];
        
        for (var i = 0; i < dat.locs.length; i++) {
            for (var t in flags) {
                if ( util.hasBit(dat.locs[i].flag, flags[t]) ) 
                   dat.sets[t.toLowerCase()]
                    .push({ loc: dat.locs[i].loc, zoom: dat.locs[i].zoom }); 
            }
        }   
        
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


