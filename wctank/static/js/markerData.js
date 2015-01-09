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
     * marker hash: unique 32 bit int marker ID
     * texture: what image to use, "enum"'d above in markerTypes
     * model vec: vertex coordinates in container pixels centered around (0, 0)
     * location vec: absolute location of marker in container pixels
     * UV: texture coordinates
     * velocity: x, y in radians (for cloud particles)
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
    markerData.VUV_ITEMS = 2;
    markerData.VUV_OFFSET = 24;
    markerData.VELOCITY_ITEMS = 2;
    markerData.VELOCITY_OFFSET = 32;

    var markerDataWorker = new Worker("/static/js/markerDataWorker.js");

    // get current marker state, compare to cache, push data blocks
    var timeout = false,
        cleared = false;

    var makeDataDelay = function() {
        timeout = window.setTimeout(function() {
            timeout = false;
            cleared = false;         
        }, 150);
    };

    markerData.makeData = function(override, callback) {
        if (!timeout && !cleared) {
            var state = markerMapPosition.getCurrentState();
            state.push(markerData.NUMBER_OF_PARTICLES);
            state.push(override);
            markerDataWorker.postMessage(state); 
            markerDataWorker.onmessage = function(e) {
                callback(e.data);
            };
            // TODO: this is just a monkey patch! Come back and fix this!
            if (!override) {
                makeDataDelay();
            } else {
                window.clearTimeout(timeout);
                cleared = true;
                makeDataDelay();                
            }
        }
    }; 

return markerData; });
