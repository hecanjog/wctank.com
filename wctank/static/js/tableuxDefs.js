//TODO: cmgyk blink right away
// closely related to the last
// TODO: variations on vhs noise pattern

(function() {
    
var add = wctank.tableux.add;
var f = wctank.tableux.flags;

/*
 * Milwaukee Area
 */
// try a different highway one
add(43.035578033062414, -87.92508879368779, 20, f.PRINT_ANALOG);
// farmhouse + field
add(42.70103069787964, -87.99994131176345, 18, f.CAUSTIC_GLOW);
// 1/2 404 - try another 404 filled one?
add(41.73787991072762, -87.47784991638764, 16, f.CMGYK | f.CAUSTIC_GLOW); 
// runway 32 
add(42.75690051169562, -87.80957013350911, 20, f.VHS);
// asia, man 
add(46.60151342636234, 45.699610515664965, 4, f.PRINT_ANALOG | f.CAUSTIC_GLOW);
// some building? 
add(41.351808897930226, -89.22587973528789, 16, f.VHS | f.CAUSTIC_GLOW | f.PRINT_ANALOG);
// colorful building
add(43.04786791144118, -87.90162418859109, 19, f.PRINT_ANALOG);
// river, boats
add(43.01021208352276, 272.1016006032805, 20, f.FAUVIST | f.VHS);
// rows of working-class houses
add(42.99286263118931, -87.97206972615822, 18, f.PRINT_ANALOG | f.VHS | f.FAUVIST | f.CAUSTIC_GLOW);

/*
 * the bigger wider world
 */
// yves klein-ish - like this one
add(51.740833805621726, -259.4416938221475, 19, f.FAUVIST);
// another colorful mountain
add(50.728666177507385, 99.64364876389303, 18, f.FAUVIST | f.PRINT_ANALOG);
// '"painterly"' topology              
add(41.655883166693386, 114.55841367391989, 17, f.FAUVIST | f.PRINT_ANALOG);   
// a lake
add(47.446640175241484, 117.25771708887626, 16, f.FAUVIST | f.PRINT_ANALOG);
// a couple of a city in austrailia 
add(-38.233798810401765, -213.56086938040062, 18, f.FAUVIST);
add(-38.230836513895284, -213.57230631964012, 15, f.VHS);
// antartica
add(-76.25189561591111, 165.7761947222007, 6, f.PRINT_ANALOG | f.VHS);
add(-82.06481558476122, -180.5787857465493, 5, f.VHS | f.CMGYK | f.PRINT_ANALOG | f.VHS, 
    [function() {
        if (core.filters.current === 'cmgyk') wctank.filterDefs.cmgyk.setImmediateBlink();
    }]
);
// industrial agriculture - these are nice 
add(50.677401244851545, -111.73200775079476, 18, f.FAUVIST | f.PRINT_ANALOG | f.CAUSTIC_GLOW | 
    f.TROLLER | f.CMGYK | f.VHS);
add(50.684622622794876, -111.752220877931, 16, f.VHS | f.PRINT_ANALOG | f.FAUVIST | f.CMGYK);
add(50.683246001156895, -111.7443836219054, 16, f.CAUSTIC_GLOW);                

wctank.tableux.parse();

}())
