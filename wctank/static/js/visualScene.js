import * as renderLoop from "lib/rudy/renderLoop";
import { PrintAnalog } from "./effects";
import * as gMap from "./gMap";
import * as tableux from "./tableux";

// visuals
let glow = new PrintAnalog();

let flags = tableux.flags;
let stock_list = [
    // colorful building
    new tableux.TableuxData(43.04003854259038 -87.91071553604706, 19, flags.PrintAnalog),
    new tableux.TableuxData(43.04786791144118, -87.90162418859109, 19, flags.PrintAnalog),
];

/*
gMap.events.queue('map', 'zoom_changed', function() {
    let zoom = gMap.map.getZoom(),
        thresh = 0,
        scale = thresh - zoom,
        do_blur = zoom > thresh;

    glow.animated_post_blur_duration = do_blur ? 0 : scale * 100 + 100;
    glow.animated_post_blur_radius = do_blur ? 0 : Math.log10(scale) * 12;
});
*/

export function start()
{
    tableux.pushData(stock_list);
    glow.operate(true);
    tableux.select(glow);
}
