import $ from "jquery";
import google from "google-maps";
import * as renderLoop from "lib/rudy/renderLoop";
import CausticGlow from "./effects";
import * as gMap from "./gMap";


// visuals
let glow = new CausticGlow();
glow.apply();

tableux.registerEffect(glow);

//! whoops need to expose tableux data
let stock_list = [
    // try a different highway one
    new tdt(42.70103069787964, -87.99994131176345, 18, f.CausticGlow),
    // 1/2 404 - try another 404 filled one?
    new tdt(41.73787991072762, -87.47784991638764, 16, f.Cmgyk | f.CausticGlow), 
    // runway 32 
    new tdt(41.351808897930226, -89.22587973528789, 16, f.Vhs | f.CausticGlow | f.PrintAnalog),
    // rows of houses
    new tdt(42.99286263118931, -87.97206972615822, 18, f.PrintAnalog | f.Vhs | f.Fauvist | f.CausticGlow),
    // industrial agriculture - these are nice 
    new tdt(50.677401244851545, -111.73200775079476, 18, f.ALL), 
    new tdt(50.683246001156895, -111.7443836219054, 16, f.CausticGlow),                
];

tableux.pushData(stock_list);
tableux.select(glow);

gMap.events.queue('map', 'zoom_changed', function() {
    let zoom = gMap.map.getZoom(),
        thresh = 0,
        scale = thresh - zoom,
        do_blur = zoom > thresh;

    glow.animated_post_blur_duration = do_blur ? 0 : scale * 100 + 100;
    glow.animated_post_blur_radius = do_blur ? 0 : Math.log10(scale) * 12;
});

