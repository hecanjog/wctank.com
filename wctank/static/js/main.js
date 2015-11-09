import * as featureDetection from "./featureDetection";
import * as gMap from "./gMap";
import { markersStart, forceDataUpdate } from "./markerCore";
import * as renderLoop from "lib/rudy/renderLoop";
import { PrintAnalog } from "./effects";
import * as tableux from "./tableux";
import * as audioScene from "./audioScene"; 


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


// start markers!
markersStart();


// start audio scene
audioScene.init();



// init delegated events
gMap.events.initQueuedEvents('map');

// suddenly remove loading screen - no transition!
var loading = document.getElementById("loading-container");
document.body.removeChild(loading);
window.setTimeout(forceDataUpdate, 2000);
