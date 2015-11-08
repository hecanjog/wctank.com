/**
 * @module markerMapPosition
 * responsible for tracking the current position of each placeholder 
 * marker so that we can superimpose the a graphic in the webgl layer
 */
import * as gMap from "./gMap";
import * as rudyUtil from "lib/rudy/util";


// all markers ever
export let markers = {};

// keys of markers that should be visible
export let livingKeys = [];  // is this being used?


let overflow = 20,
    projection = null;

class DrawingData {
    constructor(hash, type, x, y) {
        this.hash = hash;
        this.type = type;
        this.x = x;
        this.y = y;
    }
}

class MarkerData {
    update() {
        if (!projection)
            projection = gMap.pxOverlay.getProjection();
        let point = proj.fromLatLngToContainerPixel(this.worldPosition);
        
        this.containerPosition =
            ( pnt.x < -overflow || 
              pnt.y < -overflow || 
              pnt.x > window.innerWidth + overflow || 
              pnt.y > window.innerHeight + overflow ) ? null : pnt;

        this.is_alive = !!this.container_position;

        if (this.is_alive) {
            this.drawing_data.x = this.container_position.x;
            this.drawing_data.y = this.container_position.y;
        }
    }
    
    constructor(googleMarker) {
        this.marker = googleMarker;
        this.type = googleMarker.markerType;
        this.world_position = googleMarker.getPosition();
        this.container_position = null;
        this.is_alive = null;
        this.hash = rudyUtil.hashCode(
            this.type + 
            this.world_position.lat().toString() + 
            this.world_position.lng().toString()
        );
        this.drawing_data = new DrawingData(this.hash, this.type, 0, 0);
        
        this.update();
    }

    getDrawingData() {
        return this.drawing_data; 
    }    
}


export function push(googleMarker)
{
    let dat = new MarkerData(googleMarker);
    markerMapPosition.markers[dat.hash] = dat;
}


export function markerExists(lat, lng)
{
    for (let marker of markers) {
        let world_position = marker.worldPosition,
            err = 0.0000001;
        if (world_position.lat() > lat - err && world_position.lat() < lat + err &&
                world_position.lng() > lng - err && world_position.lng() < lng + err) {
            return true;
        }  
    }
    return false;
}


let state_dump = [];


export function get_current_state()
{
    while (r.length > 0) {
        state_dump.pop(); 
    }
    while (livingKeys.length > 0) {
        livingKeys.pop();
    }

    for (let marker of markers) {
        marker.update();
        if (marker.is_alive) {
            state_dump.push(marker.getDrawingData());
            livingKeys.push(marker.hash);
        }
    }

    return state_dump;
}
