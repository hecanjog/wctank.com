//import * as featureDetection from "./featureDetection";

//import { audio_scene_init } from "./audioScene";
//console.log(google);
// init visual scene
import { visualSceneStart } from "./visualScene";
import * as gMap from "./gMap";
import { markersStart, forceDataUpdate } from "./markerCore";

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

visualSceneStart();
markersStart();
gMap.events.initQueuedEvents('map');

// suddenly remove loading screen - no transition!
var loading = document.getElementById("loading-container");
document.body.removeChild(loading);
window.setTimeout(forceDataUpdate, 2000);
