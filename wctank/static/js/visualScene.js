import * as renderLoop from "lib/rudy/renderLoop";
import { CausticGlow } from "./effects";
import * as gMap from "./gMap";
import * as tableux from "./tableux";

// visuals
let glow = new CausticGlow();

let flags = tableux.flags;
let stock_list = [
    // try a different highway one
    new tableux.TableuxData(42.70103069787964, -87.99994131176345, 18, flags.CausticGlow),
    // 1/2 404 - try another 404 filled one?
    new tableux.TableuxData(41.73787991072762, -87.47784991638764, 16, flags.CausticGlow), 
    // runway 32 
    new tableux.TableuxData(41.351808897930226, -89.22587973528789, 16, flags.CausticGlow),
    // rows of houses
    new tableux.TableuxData(42.99286263118931, -87.97206972615822, 18, flags.CausticGlow),
    // industrial agriculture - these are nice 
    new tableux.TableuxData(50.677401244851545, -111.73200775079476, 18, flags.CausticGlow), 
    new tableux.TableuxData(50.683246001156895, -111.7443836219054, 16, flags.CausticGlow),                
];

gMap.events.queue('map', 'zoom_changed', function() {
    let zoom = gMap.map.getZoom(),
        thresh = 0,
        scale = thresh - zoom,
        do_blur = zoom > thresh;

    glow.animated_post_blur_duration = do_blur ? 0 : scale * 100 + 100;
    glow.animated_post_blur_radius = do_blur ? 0 : Math.log10(scale) * 12;
});


export function start()
{
    tableux.pushData(stock_list);
    console.log(glow);
    glow.operate(true);
    tableux.select(glow);
}
