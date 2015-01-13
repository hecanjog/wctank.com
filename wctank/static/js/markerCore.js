define(
    [
        'util',
        'markerMapPosition',
        'markerData',
        'visualCore',
        'render',
        'text!MarkerShaders.glsl'
    ],

function(util, markerMapPosition, markerData, visualCore, 
         render, MarkerShaders) { var markerCore = {};

    var canv = document.getElementById("markers"),
        projection;
    
    var z = visualCore.webgl.setup(canv, MarkerShaders, true);

    var updateViewport = function() {
        canv.width = window.innerWidth;
        canv.height = window.innerHeight;
        z.gl.viewport(0, 0, window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', updateViewport);
    
    updateViewport();
    
    z.gl.blendFunc(z.gl.SRC_ALPHA, z.gl.ONE);
    z.gl.disable(z.gl.DEPTH_TEST);
    z.gl.enable(z.gl.BLEND);    
    
    var buffer = z.gl.createBuffer(),
        clock = 0,
        beNoise = 0;
   
    z.gl.bindBuffer(z.gl.ARRAY_BUFFER, buffer);

    var a_hash = z.gl.getAttribLocation(z.program, 'a_hash'),
        a_type = z.gl.getAttribLocation(z.program, 'a_type'),
        a_model = z.gl.getAttribLocation(z.program, 'a_model'),
        a_container = z.gl.getAttribLocation(z.program, 'a_container'),
        a_uv = z.gl.getAttribLocation(z.program, 'a_uv'),
        a_velocity = z.gl.getAttribLocation(z.program, 'a_velocity');

    // setup attributes
    // hash
    z.gl.vertexAttribPointer(a_hash, markerData.HASH_ITEMS, z.gl.FLOAT, false, 
                             markerData.BLOCK_SIZE, 0 );
    z.gl.enableVertexAttribArray(a_hash);

    // type
    z.gl.vertexAttribPointer(a_type, markerData.TYPE_ITEMS, z.gl.FLOAT, false, 
                             markerData.BLOCK_SIZE, markerData.TYPE_OFFSET);
    z.gl.enableVertexAttribArray(a_type);
    // model view coordinates 
    z.gl.vertexAttribPointer(a_model, markerData.MODEL_VER_ITEMS, z.gl.FLOAT, false, 
                             markerData.BLOCK_SIZE, markerData.MODEL_VER_OFFSET ); 
    z.gl.enableVertexAttribArray(a_model);
    // container coordinates
    z.gl.vertexAttribPointer(a_container, markerData.LOCATION_VEC_ITEMS, z.gl.FLOAT, 
                             false, markerData.BLOCK_SIZE, markerData.LOCATION_VEC_OFFSET);
    z.gl.enableVertexAttribArray(a_container);
    // vUv
    z.gl.vertexAttribPointer(a_uv, markerData.UV_ITEMS, z.gl.FLOAT, false, 
                             markerData.BLOCK_SIZE, markerData.UV_OFFSET);
    z.gl.enableVertexAttribArray(a_uv);
    // angular velocity
    z.gl.vertexAttribPointer(a_velocity, markerData.VELOCITY_ITEMS, z.gl.FLOAT, false, 
                             markerData.BLOCK_SIZE, markerData.VELOCITY_OFFSET);
    z.gl.enableVertexAttribArray(a_velocity);

    // setup textures
    function Texture(name, path, TEXTUREID, index) {
        this.image;
        this.texture;

        var img = new Image();
        img.src = path;
        img.onload = function() {
            var c = document.createElement('canvas');
            c.width = img.width;
            c.height = img.height;
            ctx = c.getContext('2d');
            ctx.drawImage(img, 0, 0);
            this.image = c;

            this.texture = z.gl.createTexture();
            z.gl.activeTexture(TEXTUREID);
            z.gl.bindTexture(z.gl.TEXTURE_2D, this.texture);
            z.gl.texParameteri(z.gl.TEXTURE_2D, z.gl.TEXTURE_MIN_FILTER, z.gl.LINEAR);
            z.gl.texParameteri(z.gl.TEXTURE_2D, z.gl.TEXTURE_WRAP_S, z.gl.CLAMP_TO_EDGE); 
            z.gl.texParameteri(z.gl.TEXTURE_2D, z.gl.TEXTURE_WRAP_T, z.gl.CLAMP_TO_EDGE);
            z.gl.texParameteri(z.gl.TEXTURE_2D, z.gl.TEXTURE_MAG_FILTER, z.gl.NEAREST);
            z.gl.texImage2D(z.gl.TEXTURE_2D, 0, z.gl.RGBA, z.gl.RGBA, z.gl.UNSIGNED_BYTE, c);
            z.gl.uniform1i( z.gl.getUniformLocation(z.program, name), index );
        };
    }

    var textures = {
        u_stumble: new Texture('u_stumble', 'static/assets/cat.png', z.gl.TEXTURE0, 0),
        u_video: new Texture('u_video', 'static/assets/colorbars.png', z.gl.TEXTURE1, 1),
        u_random: new Texture('u_random', 'static/assets/warning.png', z.gl.TEXTURE2, 2),
        u_cloud: new Texture('u_cloud', 'static/assets/cloud.png', z.gl.TEXTURE3, 3)
    };

    var vertices = 0; // total number of living vertices
    
    var u_viewport = z.gl.getUniformLocation(z.program, 'u_viewport'),
        u_clock = z.gl.getUniformLocation(z.program, 'u_clock'),
        u_translate = z.gl.getUniformLocation(z.program, 'u_translate'),
        u_beNoise = z.gl.getUniformLocation(z.program, 'u_beNoise');

    var start = {x: 0, y: 0},
        delta = {x: 0, y: 0};
    
    var zeroPositions = function() {
        start.x = start.y = 0;
        delta.x = delta.y = 0;
    };
    
    var current_anchor = null;
    
    var queryMarkerPosition = function() {
        if (!current_anchor) {
            var markers = markerMapPosition.markers,
                keys = markerMapPosition.livingKeys;
            if (keys.length > 0) {    
                for (var i = 0; i < keys.length; i++) {
                    markers[keys[i]].update();
                    if (markers[keys[i]].isAlive) {
                        current_anchor = markers[keys[i]];   
                        break;
                    }         
                }
                if (current_anchor) {
                    return queryMarkerPosition();
                } else {
                    return false;
                }
            } else {
                return false;
            }        
        } else {
            current_anchor.update();
            if (current_anchor.isAlive) {
                return current_anchor.getDrawingData();
            } else {
                current_anchor = null;
                return queryMarkerPosition();
            }
        }
    };
    
    var updateDelta = function() {
        var pos = queryMarkerPosition();
        if (pos) {
            delta.x = pos.x - start.x;
            delta.y = pos.y - start.y;
        }    
    };
    var updateStart = function() {
        var pos = queryMarkerPosition();
        if (pos) {
            start.x = pos.x;
            start.y = pos.y;
        }
    };
    
    markerCore.draw = function() {
        z.gl.clear(z.gl.COLOR_BUFFER_BIT | z.gl.DEPTH_BUFFER_BIT);
        z.gl.uniform2f(u_viewport, window.innerWidth, window.innerHeight);
        z.gl.uniform2f(u_translate, delta.x, delta.y);
        z.gl.uniform1i(u_clock, clock++);
        z.gl.uniform1i(u_beNoise, beNoise);
        z.gl.drawArrays(z.gl.TRIANGLES, 0, vertices); 
    };
    
    var glDataUpdate = function(data) {
        zeroPositions();
        updateStart();

        vertices = data.length / markerData.BLOCK_ITEMS;
        z.gl.bindBuffer(z.gl.ARRAY_BUFFER, buffer);
        z.gl.bufferData(z.gl.ARRAY_BUFFER, new Float32Array(data), z.gl.DYNAMIC_DRAW);
    };
    
    gMap.events.queue('map', 'dragstart', function() {
        render.push(updateDelta);
        render.push(markerCore.tryDataUpdate);
    });

    gMap.events.queue('map', 'dragend', function() {
        window.setTimeout(function() {
            render.rm(updateDelta);
            render.rm(markerCore.tryDataUpdate);
        }, 1200); 
    });
// kill timeout early if interrupted by another click!!!

    // only call update data when histories are different
    markerCore.tryDataUpdate = function() {
        markerData.makeData(false, function(data) {
            if (data) {
                glDataUpdate(data);
            } 
        });
        markerCore.draw();
    };

    markerCore.forceDataUpdate = function() {
        markerData.makeData(true, function(data) {
            glDataUpdate(data);
        });
        markerCore.draw();
    };

    markerCore.setVisibility = function(bool) {
        canv.style.visibility = bool ? 'visible' : 'hidden'; 
    };

    markerCore.beNoise = function(bool) {
        beNoise = bool;    
    };

    document.addEventListener('post_overlay', function(e) {
        markerCore.beNoise(e.detail.data);
    });

    render.push(markerCore.draw);

return markerCore; });
