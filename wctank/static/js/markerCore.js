define(
    [
        'util',
        'markerData',
        'visCore',
        'text!MarkerShaders.glsl'
    ],

function(util, markerData, visCore, MarkerShaders) { var markerCore = {};

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
        buffer_array = new Float32Array(30000), // ?? I'll need to setup a dynamic buffer later.
        buffer_mirror = [],// ordered array of hashes
        objects = 1 + markerData.NUMBER_OF_PARTICLES;
        buffer_zero_id = 999,
        u_clock = 0; 

    z.gl.bindBuffer(z.gl.ARRAY_BUFFER, buffer);
    z.gl.bufferData(z.gl.ARRAY_BUFFER, buffer_array, z.gl.DYNAMIC_DRAW);

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
            z.gl.pixelStorei(z.gl.UNPACK_FLIP_Y_WEBGL, true);
            z.gl.texImage2D(z.gl.TEXTURE_2D, 0, z.gl.RGBA, z.gl.RGBA, z.gl.UNSIGNED_BYTE, c);
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

    var vertices = 0; // total number of living vertices

    // list of byte indices where we have removed a block and did not immediately fill
    // with a block from additions
    var pickBlock = function(arr) {
        var item = [];
        for (var i = 0; i < markerData.BLOCK_ITEMS * (markerData.NUMBER_OF_PARTICLES + 1); i++) {
            item.push(arr[0]);
            arr.shift();
        }
        return item;
    };
  window.hashCode = util.hashCode; 
    var bufferOffset = function(hash) {
        var offset;
        if (typeof hash !== 'undefined') {
            offset = buffer_mirror.indexOf(hash) * markerData.NUMBER_OF_PARTICLES *
                markerData.BLOCK_SIZE;
        } else {
            offset = buffer_mirror.length * markerData.NUMBER_OF_PARTICLES *
                markerData.BLOCK_SIZE;
        }
        return offset;
    };
    var bufferWriteMarker = function(data, hash, block_offset) {
        // if changing a value in an existing block
        if (typeof block_offset !== 'undefined') {
            var offset = bufferOffset(hash);
            for (var i = 0; i < markerData.NUMBER_OF_PARTICLES + 1; i++) {
                var c = offset + block_offset + (i * markerData.BLOCK_SIZE); 
                z.gl.bufferSubData( z.gl.ARRAY_BUFFER, c, new Float32Array(data) );
            }
        // if overwriting a set of existing blocks 
        } else if (typeof hash !== 'undefined') {
            z.gl.bufferSubData( z.gl.ARRAY_BUFFER, bufferOffset(hash), new Float32Array(data) );
        } else { // if adding a new set of marker blocks
            var offset = bufferOffset(buffer_zero_id),
                idx = buffer_mirror.indexOf(buffer_zero_id);
            if (offset > 0) {
                z.gl.bufferSubData( z.gl.ARRAY_BUFFER, offset, new Float32Array(data) );
                buffer_mirror[idx] = data[0];
            } else {
                z.gl.bufferSubData( z.gl.ARRAY_BUFFER, bufferOffset(), new Float32Array(data) );
                buffer_mirror.push(data[0]);
            }
        }
    };
    
    var blank = [buffer_zero_id];
    for (var p = 0; p < markerData.BLOCK_ITEMS - 1; p++) {
        blank.push(0);
    }

    var bufferZeroMarker = function(hash) {
        bufferWriteMarker(blank, hash, 0);
        var idx = buffer_mirror.indexOf(hash);
        buffer_mirror[idx] = buffer_zero_id;   
    };

    markerCore.draw = function() {
        //console.log(vertices);
        z.gl.clear(z.gl.COLOR_BUFFER_BIT | z.gl.DEPTH_BUFFER_BIT);
        // any additional mouseover uniform things go here
        for (tex in textures) {
            if (textures.hasOwnProperty(tex)) {
                textures[tex].update();
            }
        }
        z.gl.uniformMatrix4fv( z.gl.getUniformLocation(z.program, 'u_projectionMatrix'), 
                              z.gl.FALSE, projection );
        z.gl.uniform1i( z.gl.getUniformLocation(z.program, 'u_clock'), u_clock++);
        z.gl.drawArrays(z.gl.TRIANGLES, 0, vertices); 
    };

    var a_hash = z.gl.getAttribLocation(z.program, 'a_hash'),
        a_type = z.gl.getAttribLocation(z.program, 'a_type'),
        a_modelCoord = z.gl.getAttribLocation(z.program, 'a_modelCoord'),
        a_containerPosition = z.gl.getAttribLocation(z.program, 'a_containerPosition'),
        a_vUv = z.gl.getAttribLocation(z.program, 'a_vUv'),
        a_angularVelocity = z.gl.getAttribLocation(z.program, 'a_angularVelocity');

    markerCore.updateDataAndDraw = function() {
        // call marker data, cache to locals except for vertices
        var data = markerData.getData();
        vertices = data.vertices;

        if (data.diffs.length > 0) {
            data.diffs.forEach(function(diff) {
                if (diff.signal === 0) {
                    bufferWriteMarker([diff.location_x, diff.location_y], diff.hash,
                                        markerData.LOCATION_VEC_OFFSET); 
                } else if (diff.signal === 9) {
                    if (data.additions.length > 0) {
                        bufferWriteMarker(pickBlock(data.additions), diff.hash);
                    } else {
                        bufferZeroMarker(diff.hash);
                    }                   
                }
            });
        }
        if ( (data.additions.length > 0) ) {
            while (data.additions.length > 0) {
                bufferWriteMarker(pickBlock(data.additions));        
            }
        }

        for (texture in textures) {
            if (textures.hasOwnProperty(texture)) {
                textures[texture].update();
            }
        }

        // setup attributes
        // hash
        z.gl.vertexAttribPointer(a_hash, markerData.HASH_ITEMS, z.gl.FLOAT, false, 
                                 markerData.BLOCK_SIZE, 0 );
        z.gl.enableVertexAttribArray(a_hash);

        // type
        z.gl.vertexAttribPointer( a_type, markerData.TYPE_ITEMS, z.gl.FLOAT, false, 
                                 markerData.BLOCK_SIZE, markerData.TYPE_OFFSET );
        z.gl.enableVertexAttribArray(a_type);
        // model view coordinates 
        z.gl.vertexAttribPointer( a_modelCoord,markerData.MODEL_VER_ITEMS, z.gl.FLOAT, false, 
                                 markerData.BLOCK_SIZE, markerData.MODEL_VER_OFFSET ); 
        z.gl.enableVertexAttribArray(a_modelCoord);
        // container coordinates
        z.gl.vertexAttribPointer( a_containerPosition, markerData.LOCATION_VEC_ITEMS, z.gl.FLOAT, 
                                 false, markerData.BLOCK_SIZE, markerData.LOCATION_VEC_OFFSET );
        z.gl.enableVertexAttribArray(a_containerPosition);
        // vUv
        z.gl.vertexAttribPointer( a_vUv, markerData.VUV_ITEMS, z.gl.FLOAT, false, 
                                 markerData.BLOCK_SIZE, markerData.VUV_OFFSET );
        z.gl.enableVertexAttribArray(a_vUv);
        // angular velocity
        z.gl.vertexAttribPointer( a_angularVelocity, markerData.VELOCITY_ITEMS, z.gl.FLOAT, false, 
                                 markerData.BLOCK_SIZE, markerData.VELOCITY_SIZE );
        z.gl.enableVertexAttribArray(a_angularVelocity);

        markerCore.draw();
    };
    
    markerCore.setVisibility = function(bool) {
        canv.style.visibility = bool ? 'visible' : 'hidden'; 
    };

return markerCore; });
