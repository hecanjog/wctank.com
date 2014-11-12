define(
    [
        'markerData',
        'visCore',
        'text!MarkerShaders.glsl'
    ],

function(markerData, visCore, MarkerShaders) { var markerCore = {};

    var canv = document.getElementById("markers"),
        projection;

    var updateProjection = function() {
        canv.width = window.innerWidth;
        canv.height = window.innerHeight;
        projection = new Float32Array(markerData.getProjection());
    }();
    window.addEventListener('resize', updateProjection);

    var z = visCore.webgl.setup(canv, MarkerShaders, true);
    z.gl.blendFunc(z.gl.SRC_ALPHA, z.gl.ONE);
    z.gl.disable(z.gl.DEPTH_TEST);
    z.gl.enable(z.gl.BLEND);    
    
    var buffer = z.gl.createBuffer(),
        buffer_array = new Float32Array(6000), // ?? we'll need to setup a dynamic buffer later.
        u_clock = 0, u_projectionMatrix, u_stumble, u_video, u_random, u_cloud, 
        u_blackout, u_mouseover;

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
            z.gl.bindTexture(z.gl.TEXTURE_2D, tex);
            z.gl.texParameteri(z.gl.TEXTURE_2D, z.gl.TEXTURE_MIN_FILTER, z.gl.LINEAR);
            z.gl.texParameteri(z.gl.TEXTURE_2D, z.gl.TEXTURE_WRAP_S, z.gl.CLAMP_TO_EDGE); 
            z.gl.texParameteri(z.gl.TEXTURE_2D, z.gl.TEXTURE_WRAP_T, z.gl.CLAMP_TO_EDGE);
            z.gl.texParameteri(z.gl.TEXTURE_2D, z.gl.TEXTURE_MAG_FILTER, z.gl.NEAREST);
            z.gl.pixelStorei(z.gl.UNPACK_FLIP_Y_WEBGL, true);
            z.gl.texImage2D(z.gl.TEXTURE_2D, 0, z.gl.RGBA, z.gl.RGBA, z.gl.UNSIGNED_BYTE, can);
        };

        this.update = function() {
            z.gl.activeTexture(TEXTUREID);
            z.gl.bindTexture(z.gl.TEXTURE_2D, this.texture);
            z.gl.texSubImage2D(z.gl.TEXTURE_2D, 0, 0, 0, z.gl.RGBA, z.gl.UNSIGNED_BYTE, this.image);
            z.gl.uniform1i( z.gl.getUniformLocation(z.program, name), index );
        };
    };

    var textures = {
        u_stumble: new Texture('u_stumble', 'static/assets/rap.png', z.gl.TEXTURE0, 0),
        u_video: new Texture('u_video', 'static/assets/colorbars.png', z.gl.TEXTURE1, 1),
        u_random: new Texture('u_random', 'static/assets/rand.png', z.gl.TEXTURE2, 2),
        u_cloud: new Texture('u_cloud', 'static/assets/cloud.png', z.gl.TEXTURE3, 3)
    };
  
    z.gl.bindBuffer(z.gl.ARRAY_BUFFER, buffer);
    z.gl.bufferData(z.gl.ARRAY_BUFFER, buffer_array, z.gl.DYNAMIC_DRAW);

    var vertices = 0; // total number of living vertices

    // list of byte indices where we have removed a block and did not immediately fill
    // with a block from additions
    var notches = [];
    var pickBlock = function(arr) {
        var item = [];
        for (var i = 0; i < markerData.BLOCK_ITEMS; i++) {
            item.push(arr[i]);
        }
        for (var j = 0; j < markerData.BLOCK_ITEMS; j++) {
            arr.unshift();
        }
        return item;
    };
    var nothing = [];
    for (var p = 0; p < markerData.BLOCK_ITEMS; p++) [
        nothing.push(0);
    }
    var zero = new Float32Array(nothing);

    markerCore.draw = function() {
        z.gl.clear(z.gl.COLOR_BUFFER_BIT | z.gl.DEPTH_BUFFER_BIT);
        // any additional mouseover uniform things go here
        z.gl.uniformMatrix4fv( z.gl.getUniformLocation(z.program, 'u_projectionMatrix'), 
                              z.gl.FALSE, projection );
        z.gl.uniform1i( z.gl.getUniformLocation(z.program, 'u_clock'), u_clock++;
        z.gl.drawArrays(z.gl.TRIANGLES, 0, vertices); 
    };

    markerCore.updateDataAndDraw = function() {
        // call marker data, cache to locals except for vertices
        var data = markerData.getData();
    
        vertices = data.vertices;

        // list of byte indices where we have removed a block and can insert a new one
        var nothing = [];

        z.gl.bindBuffer(z.gl.ARRAY_BUFFER, buffer);

        if (data.diffs.length > 0) {
            data.diffs.forEach(function(diff) {
                var offset = diff.idx * markerData.BLOCK_SIZE; 
                if (diff.signal === 0) {
                    z.gl.bufferSubData( z.gl.ARRAY_BUFFER, offset + markerData.LOCATION_VEC_OFFSET, 
                                       new Float32Array(diff.location_x, diff.location_y) );
                } else if (diff.signal === 9) {
                    if (data.additions.length > 0) {
                        z.gl.bufferSubData( z.gl.ARRAY_BUFFER, offset, 
                                           new Float32Array(pickBlock(data.additions)) );
                    } else {
                        z.gl.bufferSubData(z.gl.ARRAY_BUFFER, offset, zero);
                        notches.push(offset);
                    }                   
                }
            });
        }
        if ( (data.additions.length > 0) && (notches.length > 0) ) {
            notches.forEach(function(notch) {
                z.gl.bufferSubData( z.gl.ARRAY_BUFFER, notch, 
                                   new Float32Array(pickBlock(data.additions)) );            
            });
        }
        if (data.additions.length > 0) {
            z.gl.bufferSubData( z.gl.ARRAY_BUFFER, data.last_length, new Float32Array(additions) );
        }

        for (texture in textures) {
            if (textures.hasOwnProperty(texture)) {
                textures[texture].update();
            }
        }

        // setup attributes
        // hash
        z.gl.vertexAttribPointer( z.gl.getAttribLocation(z.program, 'a_hash'), 
            markerData.HASH_ITEMS, z.gl.FLOAT, false, markerData.BLOCK_SIZE, 
            markerData.HASH_OFFSET );
        // type
        z.gl.vertexAttribPointer( z.gl.getAttribLocation(z.program, 'a_type'), 
            markerData.TYPE_ITEMS, z.gl.FLOAT, false, markerData.BLOCK_SIZE, 
            markerData.TYPE_OFFSET );
        // model view coordinates 
        z.gl.vertexAttribPointer( z.gl.getAttribLocation(z.program, 'a_modelCoord'),
            markerData.MODEL_VER_ITEMS, z.gl.FLOAT, false, markerData.BLOCK_SIZE, 
            markerData.MODEL_VER_OFFSET ); 
        // container coordinates
        z.gl.vertexAttribPointer( z.gl.getAttribLocation(z.program, 'a_containerPosition'),
            markerData.LOCATION_VEC_ITEMS, z.gl.FLOAT, false, markerData.BLOCK_SIZE, 
            markerData.LOCATION_VEC_OFFSET );
        // vUv
        z.gl.vertexAttribPointer( z.gl.getAttribLocation(z.program, 'a_vUv'),
            markerData.VUV_ITEMS, z.gl.FLOAT, false, markerData.BLOCK_SIZE,
            markerData.VUV_OFFSET );
        // angular velocity
        z.gl.vertexAttribPointer( z.gl.getAttribLocation(z.program, 'a_angularVelocity'),
            markerData.VELOCITY_ITEMS, z.gl.FLOAT, false, markerData.BLOCK_SIZE,
            markerData.VELOCITY_SIZE );

        markerCore.draw();
    };

return markerCore; });
