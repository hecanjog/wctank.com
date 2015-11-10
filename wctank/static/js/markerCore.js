/**
 * @module markerCore
 * init marker data, export some useful functionality, attach to map/marker events
 */ 
import * as rudy from "lib/rudy/rudy";
import * as markerMapPosition from "./markerMapPosition";
import * as markerData from "./markerData";
import * as featureDetection from "./featureDetection";
import * as posts from "./posts";
import * as gMap from "./gMap";
import * as util from "lib/rudy/util";
import markershaders from "glsl/markers.glsl!systemjs/plugin-text";


//////////////////////////////////////////////////////////////// module private and init

let marker_canvas = document.getElementById("markers"),
    projection = null;

let z = rudy.visualCore.webglSetup(marker_canvas, markershaders, false, true);

/*
 * The modernizer webgl test is 'soft', i.e., if the ability to create a context
 * exists, then it passes. However, this excludes situations where using webgl may 
 * not be enabled for other reasons, e.g., if it is not enabled in the browser, 
 * misbehaving drivers, etc. webgl.setup not returning at this point turns out to be 
 * a good determinant of whether or not using webgl is possible.
 */
if (typeof z === 'undefined') featureDetection.redirect_fatal('webgl');

let updateViewport = () => 
{
    marker_canvas.width = window.innerWidth;
    marker_canvas.height = window.innerHeight;
    z.gl.viewport(0, 0, window.innerWidth, window.innerHeight);
};

window.addEventListener('resize', updateViewport);
updateViewport();

z.gl.blendFunc(z.gl.SRC_ALPHA, z.gl.ONE);
z.gl.disable(z.gl.DEPTH_TEST);
z.gl.enable(z.gl.BLEND);    

let buffer = z.gl.createBuffer(),
    clock = 0,
    be_noise = 0,
    beColoredNoise = 0;

z.gl.bindBuffer(z.gl.ARRAY_BUFFER, buffer);


///////////// setup attributes that are drawn from our interleaved buffer

// id associating this block with a particular marker 
let a_hash = z.gl.getAttribLocation(z.program, 'a_hash');
    
// what image to use
let a_type = z.gl.getAttribLocation(z.program, 'a_type');
    
// vertex coordinates for each marker relative to 0, 0
let a_model = z.gl.getAttribLocation(z.program, 'a_model');

// location of marker relative to container
let a_container = z.gl.getAttribLocation(z.program, 'a_container');

// texture coordinates
let a_uv = z.gl.getAttribLocation(z.program, 'a_uv');

// angular velocity (used for cloud particles)
let a_velocity = z.gl.getAttribLocation(z.program, 'a_velocity');

// setup attribute pointers
z.gl.vertexAttribPointer(
    a_hash, 
    markerData.HASH_ITEMS, 
    z.gl.FLOAT, 
    false, 
    markerData.BLOCK_SIZE, 
    0
);
z.gl.enableVertexAttribArray(a_hash);

z.gl.vertexAttribPointer(
    a_type, 
    markerData.TYPE_ITEMS, 
    z.gl.FLOAT, 
    false, 
    markerData.BLOCK_SIZE, 
    markerData.TYPE_OFFSET
);
z.gl.enableVertexAttribArray(a_type);

z.gl.vertexAttribPointer(
    a_model, 
    markerData.MODEL_VER_ITEMS, 
    z.gl.FLOAT, 
    false, 
    markerData.BLOCK_SIZE, 
    markerData.MODEL_VER_OFFSET
); 
z.gl.enableVertexAttribArray(a_model);

z.gl.vertexAttribPointer(
    a_container, 
    markerData.LOCATION_VEC_ITEMS, 
    z.gl.FLOAT, 
    false, 
    markerData.BLOCK_SIZE, 
    markerData.LOCATION_VEC_OFFSET
);
z.gl.enableVertexAttribArray(a_container);

z.gl.vertexAttribPointer(
    a_uv, 
    markerData.UV_ITEMS, 
    z.gl.FLOAT, 
    false, 
    markerData.BLOCK_SIZE, 
    markerData.UV_OFFSET
);
z.gl.enableVertexAttribArray(a_uv);

z.gl.vertexAttribPointer(
    a_velocity, 
    markerData.VELOCITY_ITEMS, 
    z.gl.FLOAT, 
    false, 
    markerData.BLOCK_SIZE, 
    markerData.VELOCITY_OFFSET
);
z.gl.enableVertexAttribArray(a_velocity);


// buffer image in a canvas element,
// bind texture to webgl contect
class Texture
{
    constructor(name, path, texture_id, index) 
    {
        this.image = null;
        this.texture = null;
        
        let img = new Image();
        img.src = path;
        img.onload = () => {
            let canv = document.createElement('canvas');
            canv.width = img.height;  
            canv.width = img.width;
            canv.height = img.height;
            let ctx = canv.getContext('2d');
            ctx.drawImage(img, 0, 0);
            this.image = canv;
            
            this.texture = z.gl.createTexture();
            z.gl.activeTexture(texture_id);
            z.gl.bindTexture(z.gl.TEXTURE_2D, this.texture);
            z.gl.texParameteri(z.gl.TEXTURE_2D, z.gl.TEXTURE_MIN_FILTER, z.gl.LINEAR);
            z.gl.texParameteri(z.gl.TEXTURE_2D, z.gl.TEXTURE_WRAP_S, z.gl.CLAMP_TO_EDGE); 
            z.gl.texParameteri(z.gl.TEXTURE_2D, z.gl.TEXTURE_WRAP_T, z.gl.CLAMP_TO_EDGE);
            z.gl.texParameteri(z.gl.TEXTURE_2D, z.gl.TEXTURE_MAG_FILTER, z.gl.NEAREST);
            z.gl.texImage2D(z.gl.TEXTURE_2D, 0, z.gl.RGBA, z.gl.RGBA, z.gl.UNSIGNED_BYTE, canv);
            z.gl.uniform1i( z.gl.getUniformLocation(z.program, name), index );
        };
    } 
}

let textures = {
    u_stumble: new Texture('u_stumble', 'static/assets/cat.png', z.gl.TEXTURE0, 0),
    u_video: new Texture('u_video', 'static/assets/colorbars.png', z.gl.TEXTURE1, 1),
    u_random: new Texture('u_random', 'static/assets/warning.png', z.gl.TEXTURE2, 2),
    u_cloud: new Texture('u_cloud', 'static/assets/cloud.png', z.gl.TEXTURE3, 3)
};

// dimensions of the window
let u_viewport = z.gl.getUniformLocation(z.program, 'u_viewport');

// counter we increment on each frame
let u_clock = z.gl.getUniformLocation(z.program, 'u_clock');

// delta x, y of the markers
let u_translate = z.gl.getUniformLocation(z.program, 'u_translate');

// 1 or 0 depending on if we want to markers to be shaded with white noise
let u_beNoise = z.gl.getUniformLocation(z.program, 'u_beNoise');

// 1 or 0 depending on if we want the markers to be shaded with colored noise
let u_beColoredNoise = z.gl.getUniformLocation(z.program, 'u_beColoredNoise');


// total number of living vertices
let vertices = 0;

// a ref to the current marker that we are using 
// to track the current delta <x, y> of all 
// markers on screen
let current_anchor = null;

let start = {x: 0, y: 0};
let delta = {x: 0, y: 0};

let zeroPositions = () => 
{
    start.x = start.y = 0;
    delta.x = delta.y = 0;
};

let queryMarkerPosition = () => 
{
    if (!current_anchor) {
        let markers = markerMapPosition.markers,
            keys = markerMapPosition.livingKeys;

        for (let key of keys) {
            markers[key].update();
            if (markers[key].is_alive) {
                current_anchor = markers[key];
                break;
            }
        }

        if (current_anchor) {
            return queryMarkerPosition();
        } else {
            return false;
        }

    } else {
        current_anchor.update();
        if (current_anchor.is_alive) {
            return current_anchor.getDrawingData();
        } else {
            current_anchor = null;
            return queryMarkerPosition();
        }
    }
};

let updateDelta = () => 
{
    let pos = queryMarkerPosition();
    if (pos) {
        delta.x = pos.x - start.x;
        delta.y = pos.y - start.y;
    }    
};

let updateStart = () => 
{
    let pos = queryMarkerPosition();
    if (pos) {
        start.x = pos.x;
        start.y = pos.y;
    }
};


//// gl data updating

// transfer data from a normal js list 
// into a typed array
let data32Arr,
    blank = new Float32Array([0]);

let getDataArray = data => 
{
    if (!data32Arr || data.length > data32Arr.length) {
        data32Arr = new Float32Array(data); 
        return data32Arr;
    } else if (data.length > 0 && data.length <= data32Arr.length) {
        data32Arr.set(data);
        return data32Arr.subarray(0, data.length);
    } else {
        return blank;
    } 
}; 

let glDataUpdate = data => 
{
    zeroPositions();
    updateStart();
    vertices = data.length / markerData.BLOCK_ITEMS;
    z.gl.bindBuffer(z.gl.ARRAY_BUFFER, buffer);
    z.gl.bufferData(z.gl.ARRAY_BUFFER, getDataArray(data), z.gl.DYNAMIC_DRAW);
};


// basically force the markers to reload if something goes awry
let markerPositionFailsafe = () => 
{
    let pos = queryMarkerPosition();
    if (pos) {
        let mark_x = delta.x + start.x,
            mark_y = delta.y + start.y;

        let err = 1.75;
        if (pos.x > mark_x + err || pos.x < mark_x - err ||
                pos.y > mark_y + err || pos.y < mark_y - err) {
            forceDataUpdate();
            return true;
        } else {
            return false;
        }
    }
};

///////////////////////////////////////////////////////////////////////////////

// before, we were doing a request for all visible markers when the map moved. 
// Now, just do one big one, and cache this in memory on the server-side.
export function initAllMarkers(callback) {
    posts.getAll(data => {
        data.forEach(post => {
            if (!markerMapPosition.markerExists(post.lat, post.long)) {
                let loc = new google.maps.LatLng(post.lat, post.long);
                let m = new google.maps.Marker({
                    position: loc,
                    map: gMap.map,
                    icon: "static/assets/blank.png"
                });
                m.markerType = post.markerType;
                markerMapPosition.push(m);
                gMap.events.initQueuedEvents('marker', m);
                google.maps.event.addListener(m, 'click', () => { 
                    posts.display(post);
                });
            }
        });
        tryDataUpdate();
        callback();
    });
};

// update uniforms, interleaved array on each frame
export function draw() 
{
    z.gl.clear(z.gl.COLOR_BUFFER_BIT | z.gl.DEPTH_BUFFER_BIT);
    z.gl.uniform2f(u_viewport, window.innerWidth, window.innerHeight);
    z.gl.uniform2f(u_translate, delta.x, delta.y);
    z.gl.uniform1i(u_clock, clock++);
    z.gl.uniform1i(u_beNoise, be_noise);
    z.gl.uniform1i(u_beColoredNoise, beColoredNoise);
    z.gl.drawArrays(z.gl.TRIANGLES, 0, vertices); 
}

 // only call update data when histories are different
export function tryDataUpdate()
{
    markerData.makeData(false, data => {
        if (data) {
            glDataUpdate(data);
        } 
    });
    draw();
}

export function forceDataUpdate()
{
    markerData.makeData(true, data => {
        glDataUpdate(data);
    });
    draw();
}
window.forceData = forceDataUpdate;
export function setVisibility(bool) 
{
    marker_canvas.style.visibility = bool ? 'visible' : 'hidden'; 
}

export function beNoise(bool, isColored) 
{
    be_noise = bool;
    beColoredNoise = isColored;
}


/////////// tie data updates to map UI events

gMap.events.queue('map', 'dragstart', () => {
    rudy.renderLoop.add(updateDelta);
    rudy.renderLoop.add(tryDataUpdate);
});

gMap.events.queue('map', 'dragend', () => {
    for (var i = 100; i <= 400; i += 100) {
        window.setTimeout(markerPositionFailsafe, i);
    }
   
    for (var j = 500; i <= 2000; i += 100) {
        window.setTimeout(() => {
            if (markerPositionFailsafe()) {
                beNoise(true, true);
                window.setTimeout(beNoise, util.smudgeNumber(30, 20));
            }
        }, i);
    }
     
    window.setTimeout(() => {
        rudy.renderLoop.remove(updateDelta);
        rudy.renderLoop.remove(tryDataUpdate);
    }, 500);
});

// turn to white noise when a post is displayed
document.addEventListener('post_overlay', e => {
    beNoise(e.detail.visible);
});

gMap.events.queue('map', 'zoom_changed', forceDataUpdate);


export function markersStart()
{
    rudy.renderLoop.add(draw);
}
