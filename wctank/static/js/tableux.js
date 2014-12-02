/*
 * tableux determines starting center and zoom level depending on what filter is selected first.
 */
define(
    [
        'util',
        'gMap',
        'mutexVisualEffects'
    ],

function(util, gMap, mutexVisualEffects) { var tableux = {};

    tableux.flags = {};
    var bit = 0x40000000;
    for (var mv in mutexVisualEffects) {
        if ( mutexVisualEffects.hasOwnProperty(mv) ) 
            tableux.flags[mv.toUpperCase()] = bit;
            bit = bit >>> 1;
    }
    tableux.ALL_FLAGS = 0xFFFFFFFF;
    
    tableux.TableuxDataTuple = function TableuxDataTuple(lat, lng, zoom, flag, exes) {
        this.loc = new google.maps.LatLng(lat, lng);
        this.zoom = zoom;
        this.flag = flag;
        exes = exes;
    };

    tableux.Engine = function() {
        var sets = {};
       
        this.parseData = function(tableuxDataArray) {
            tableuxDataArray.forEach(function(data) {    
                for (var t in tableux.flags) {
                    if ( util.hasBit(data.flag, tableux.flags(t)) )
                        sets[t.toLowerCase()].push(data);
                }
            });
        };

        this.select = function(mutexFilterObj) {
            var s = sets[mutexFilterObj.css_class];
            var i = (Math.random() * s.length) | 0;
            gMap.goTo(s[i].loc, s[i].zoom);
            if (s[i].exes) {
                for (var j = 0; j < s[i].exes.length; j++) {
                    s[i].exes[j](mutexFilterObj);
                }
            }
        };
    };
   
    var tdt = tableux.TableuxDataTuple; 
    tableux.stockList = [
        /*
         * Milwaukee Area
         */
        // try a different highway one
        new tdt(43.035578033062414, -87.92508879368779, 20, f.PRINT_ANALOG),
        // farmhouse + field
        new tdt(42.70103069787964, -87.99994131176345, 18, f.CAUSTIC_GLOW),
        // 1/2 404 - try another 404 filled one?
        new tdt(41.73787991072762, -87.47784991638764, 16, f.CMGYK | f.CAUSTIC_GLOW), 
        // runway 32 
        new tdt(42.75690051169562, -87.80957013350911, 20, f.VHS),
        // asia, man 
        new tdt(46.60151342636234, 45.699610515664965, 4, f.PRINT_ANALOG | f.CAUSTIC_GLOW | f.VHS),
        // some building? 
        new tdt(41.351808897930226, -89.22587973528789, 16, f.VHS | f.CAUSTIC_GLOW | f.PRINT_ANALOG),
        // colorful building
        new tdt(43.04786791144118, -87.90162418859109, 19, f.PRINT_ANALOG),
        // river, boats
        new tdt(43.01021208352276, 272.1016006032805, 20, f.FAUVIST | f.VHS),
        // rows of working-class houses
        new tdt(42.99286263118931, -87.97206972615822, 18, f.PRINT_ANALOG | f.VHS | f.FAUVIST | f.CAUSTIC_GLOW),
        // over lake michigan somewhere
        new tdt(33.62344395619926, -118.12228629350284, 13, f.CAUSTIC_GLOW | f.VHS | f.CMGYK | f.FAUVIST, 
            [function(filterObj) {
                if (filterObj.hasOwnProperty(setImmediateBlink)) filterObj.setImmediateBlink();
            }]
        ),
        /*
         * the bigger wider world
         */
        // yves klein-ish - like this one
        new tdt(51.740833805621726, -259.4416938221475, 19, f.FAUVIST),
        // another colorful mountain
        new tdt(50.728666177507385, 99.64364876389303, 18, f.FAUVIST | f.PRINT_ANALOG),
        // '"painterly"' topology              
        new tdt(41.655883166693386, 114.55841367391989, 17, f.FAUVIST | f.PRINT_ANALOG),   
        // a lake
        new tdt(47.446640175241484, 117.25771708887626, 16, f.FAUVIST | f.PRINT_ANALOG),
        // a couple of a city in austrailia 
        new tdt(-38.233798810401765, -213.56086938040062, 18, f.FAUVIST),
        new tdt(-38.230836513895284, -213.57230631964012, 15, f.VHS),
        // antartica
        new tdt(-76.25189561591111, 165.7761947222007, 6, f.PRINT_ANALOG | f.VHS),
        new tdt(-82.06481558476122, -180.5787857465493, 5, f.VHS | f.CMGYK | f.PRINT_ANALOG | f.VHS, 
            [function(filterObj) {
                if (filterObj.hasOwnProperty(setImmediateBlink)) filterObj.setImmediateBlink();
            }]
        ),
        // industrial agriculture - these are nice 
        new tdt(50.677401244851545, -111.73200775079476, 18, ALL_FLAGS), 
        new tdt(50.684622622794876, -111.752220877931, 16, f.VHS | f.PRINT_ANALOG | f.FAUVIST | f.CMGYK),
        new tdt(50.683246001156895, -111.7443836219054, 16, f.CAUSTIC_GLOW),                
        // a port near so cal
        new tdt(33.74546214254659, -118.22587598936661, 18, ALL_FLAGS),
        // a world map
        new tdt(46.81244726322789, 16.65002231745169, 2, f.PRINT_ANALOG | f.FAUVIST | f.CAUSTIC_GLOW), 
        // a road somewhere
        new tdt(50.60152354612505, -111.64077556435313, 18, f.VHS | f.FAUVIST), 
        // i don't remember what this is
        new tdt(47.45747901459409, 117.24761052530815, 13, f.VHS | f.FAUVIST | f.CAUSTIC_GLOW), 
        // coastline near LA I think idk
        new tdt(34.06611259362441, -118.91275543937081, 13, f.CAUSTIC_GLOW), 
        // don't remember what this is
        new tdt(43.01995881560774, -87.89964248960314, 20, f.CAUSTIC_GLOW | f.PRINT_ANALOG)
    ];

return tableux; });
