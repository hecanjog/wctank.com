define(
    [
        'markerMapPosition',
    ],

function(markerMapPosition) { var markerData = {};

    /*
     * interleaved block structure: (f = 32 bit float)
     * marker hash, texture, model ver, location vec, UV   velocity
     * f            f        f, f       f, f          f, f  f, f
     *
     * marker hash: unique ID
     * texture: what image to use, enum'd above in markerTypes obj
     * model coord: vertex coordinates (in pixels) where (0, 0) is the center of each marker.
     * container coord: absolute location of marker in container pixels
     * UV: texture coordinates
     * velocity: angular velocity (x, y) in radians (for cloud particles)
     */
    markerData.NUMBER_OF_PARTICLES = 20;
    markerData.BLOCK_ITEMS = 10;
    markerData.BLOCK_SIZE = 40;
    markerData.HASH_ITEMS = 1;
    markerData.HASH_OFFSET = 0;
    markerData.TYPE_ITEMS = 1;
    markerData.TYPE_OFFSET = 4;
    markerData.MODEL_VER_ITEMS = 2;
    markerData.MODEL_VER_OFFSET = 8;
    markerData.LOCATION_VEC_ITEMS = 2;
    markerData.LOCATION_VEC_OFFSET = 16;
    markerData.UV_ITEMS = 2;
    markerData.UV_OFFSET = 24;
    markerData.VELOCITY_ITEMS = 2;
    markerData.VELOCITY_OFFSET = 32;

    var markerDataWorker = new Worker("/static/js/markerDataWorker.js");

    // no timeout on force, bind to tilesloaded
    markerData.makeData = function(override, callback) {
        var state = markerMapPosition.getCurrentState();
        var ovr = override ? override : false;
        state.push(markerData.NUMBER_OF_PARTICLES);
        state.push(ovr);
        markerDataWorker.postMessage(state); 
        markerDataWorker.onmessage = function(e) {
            callback(e.data);
        };
    }; 

return markerData; });
