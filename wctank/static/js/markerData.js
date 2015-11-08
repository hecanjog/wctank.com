/**
 * @module markerData
 * serves as an interface to the markerDataWorker
 */ 
import * as markerMapPosition from "./markerMapPosition";


/*
 * interleaved block structure: (f = 32 bit float)
 * marker hash, texture, model ver, location vec, UV   velocity
 * f            f        f, f       f, f          f, f  f, f
 *
 * marker hash: unique ID
 * texture: what image to use, enum'd in worker
 * model coord: vertex coordinates (in pixels) where (0, 0) is the center of each marker.
 * container coord: absolute location of marker in container pixels
 * UV: texture coordinates
 * velocity: angular velocity (x, y) in radians (for cloud particles)
 */
export const NUMBER_OF_PARTICLES = 20,
             BLOCK_ITEMS = 10,
             BLOCK_SIZE = 40,
             HASH_ITEMS = 1,
             HASH_OFFSET = 0,
             TYPE_ITEMS = 1,
             TYPE_OFFSET = 4,
             MODEL_VER_ITEMS = 2,
             MODEL_VER_OFFSET = 8,
             LOCATION_VEC_ITEMS = 2,
             LOCATION_VEC_OFFSET = 16,
             UV_ITEMS = 2,
             UV_OFFSET = 24,
             VELOCITY_ITEMS = 2,
             VELOCITY_OFFSET = 32;


let markerDataWorker = new Worker("/static/js/markerDataWorker.js");


export function makeData(override, callback)
{
    let state = markerMapPosition.getCurrentState();
    state.push(NUMBER_OF_PARTICLES);
    state.push(override);
    markerDataWorker.postMessage(state); 
    markerDataWorker.onmessage = e => {
        callback(e.data);
    };
} 
