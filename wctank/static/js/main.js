import $ from "jquery";
import * as featureDetection from "./featureDetection";
import * as gMap from "./gMap";
import { markersStart, forceDataUpdate, initAllMarkers } from "./markerCore";
import * as renderLoop from "lib/rudy/renderLoop";
import { PrintAnalog } from "./effects";
import * as tableux from "./tableux";
import * as audioScene from "./audioScene"; 
import * as audioUI from "./audioUI";


// initalize google map
gMap.init();
var bounds = new google.maps.LatLngBounds(
    new google.maps.LatLng(42.96, -87.3159),
    new google.maps.LatLng(43.25, -86.9059)
);

var overlay = new google.maps.GroundOverlay(
    'static/assets/virgo-logo.png',
    bounds
);
overlay.setMap(gMap.map);

google.maps.event.addListenerOnce(gMap.map, 'tilesloaded', () => {
    // init delegated events
    gMap.events.initQueuedEvents('map');
    initAllMarkers(() => {
        markersStart();
        window.setTimeout(() => {
            $("#loading-container").fadeOut(1000, 'linear', function() {
                $(this).remove();
            });
        }, 5000);
        forceDataUpdate();
    });
});

// set up main map skin
let glow = new PrintAnalog();

let flags = tableux.flags;

let stock_list = [
    new tableux.TableuxData(43.00920829994793, -87.90464972035988, 18, flags.PrintAnalog),
    new tableux.TableuxData(43.00513089640196, -87.9199973203431, 18, flags.PrintAnalog),
];

tableux.pushData(stock_list);
glow.operate(true);
tableux.select(glow);


// if audio fails, reflect error in UI
if (!featureDetection.webaudio) { // TODO: create a new batch of fallbacks
    audioUI.disableMuteButton(); 
} else {
    audioScene.init();
    audioUI.init();
}
