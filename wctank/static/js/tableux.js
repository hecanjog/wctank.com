/*
 * tableux determines a map center and zoom level depending on what filter is passed to .select
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
            tableux.flags[mv] = bit;
            bit = bit >>> 1;
    }
    tableux.flags.ALL = 0xFFFFFFFF;
    
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
                    if (tableux.flags.hasOwnProperty(t)) {
                        if ( util.hasBit(data.flag, tableux.flags[t]) ) {
                            if (!Array.isArray(sets[t])) sets[t] = [];
                            sets[t].push(data);
                        }
                    }
                }
            });
        };

        this.select = function(mutexFilterObj) {
            var s = sets[mutexFilterObj.name];
            var i = (Math.random() * s.length) | 0;
            gMap.goTo(s[i].loc, s[i].zoom);
            if (s[i].exes) {
                for (var j = 0; j < s[i].exes.length; j++) {
                    s[i].exes[j](mutexFilterObj);
                }
            }
        };
    };
   
    var tdt = tableux.TableuxDataTuple,
        f = tableux.flags; 
   
    /*
     *  N.B. - It feels weird not to have constants in all caps,
     *  but normalizing them against the prop names in mutexVisualEffects
     *  makes this easier.
     */

    tableux.stockList = [
        /*
         * Milwaukee Area
         */
        // try a different highway one
        new tdt(43.035578033062414, -87.92508879368779, 20, f.PrintAnalog),
        // farmhouse + field
        new tdt(42.70103069787964, -87.99994131176345, 18, f.CausticGlow),
        // 1/2 404 - try another 404 filled one?
        new tdt(41.73787991072762, -87.47784991638764, 16, f.Cmgyk | f.CausticGlow), 
        // runway 32 
        new tdt(42.75690051169562, -87.80957013350911, 20, f.Vhs),
        // asia, man 
        //new tdt(46.60151342636234, 45.699610515664965, 4, f.PrintAnalog | f.CausticGlow | f.Vhs),
        // some building? 
        new tdt(41.351808897930226, -89.22587973528789, 16, f.Vhs | f.CausticGlow | f.PrintAnalog),
        // colorful building
        new tdt(43.04786791144118, -87.90162418859109, 19, f.PrintAnalog),
        // river, boats
        new tdt(43.01021208352276, 272.1016006032805, 20, f.Fauvist | f.Vhs),
        // rows of working-class houses
        new tdt(42.99286263118931, -87.97206972615822, 18, f.PrintAnalog | f.Vhs | f.Fauvist | f.CausticGlow),
        // over lake michigan somewhere
        new tdt(33.62344395619926, -118.12228629350284, 13, f.CausticGlow | f.Vhs | f.Cmgyk | f.Fauvist, 
            [function(filterObj) {
                if (filterObj.hasOwnProperty('setImmediateBlink')) filterObj.setImmediateBlink();
            }]
        ),
        /*
         * the bigger wider world
         */
        // yves klein-ish - like this one
        new tdt(51.740833805621726, -259.4416938221475, 19, f.Fauvist),
        // another colorful mountain
        new tdt(50.728666177507385, 99.64364876389303, 18, f.Fauvist | f.PrintAnalog),
        // '"painterly"' topology              
        new tdt(41.655883166693386, 114.55841367391989, 17, f.Fauvist | f.PrintAnalog),   
        // a lake
        new tdt(47.446640175241484, 117.25771708887626, 16, f.Fauvist | f.PrintAnalog),
        // a couple of a city in austrailia 
        new tdt(-38.233798810401765, -213.56086938040062, 18, f.Fauvist),
        new tdt(-38.230836513895284, -213.57230631964012, 15, f.Vhs),
        // antartica
        //new tdt(-76.25189561591111, 165.7761947222007, 6, f.PrintAnalog | f.Vhs),
        new tdt(-82.06481558476122, -180.5787857465493, 5, f.Vhs | f.Cmgyk | f.PrintAnalog | f.VHS, 
            [function(filterObj) {
                if (filterObj.hasOwnProperty('setImmediateBlink')) filterObj.setImmediateBlink();
            }]
        ),
        // industrial agriculture - these are nice 
        new tdt(50.677401244851545, -111.73200775079476, 18, f.ALL), 
        new tdt(50.684622622794876, -111.752220877931, 16, f.Vhs | f.PrintAnalog | f.Fauvist | f.Cmgyk),
        new tdt(50.683246001156895, -111.7443836219054, 16, f.CausticGlow),                
        // a port near so cal
        new tdt(33.74546214254659, -118.22587598936661, 18, f.ALL),
        // a world map
        //new tdt(46.81244726322789, 16.65002231745169, 2, f.PrintAnalog | f.Fauvist | f.CausticGlow), 
        // a road somewhere
        new tdt(50.60152354612505, -111.64077556435313, 18, f.Vhs | f.Fauvist), 
        // i don't remember what this is
        new tdt(47.45747901459409, 117.24761052530815, 13, f.Vhs | f.Fauvist | f.CausticGlow), 
        // coastline near LA I think idk
        new tdt(34.06611259362441, -118.91275543937081, 13, f.CausticGlow), 
        // don't remember what this is
        new tdt(43.01995881560774, -87.89964248960314, 20, f.CausticGlow | f.PrintAnalog),
        new tdt(38.51647228621493, -121.64318988084415, 11, f.CausticGlow) 
    ];

return tableux; });
