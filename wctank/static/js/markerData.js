define(
    [
        'markerMapPosition',
        'jStat'
    ],

function(markerMapPosition, jStat) { var markerData = {};
    var data = [],
        last_data_length = 0,
        additions = [];
        diffs = [];
        obj_cache = {},
        numberOfCloudParticles = 20;

    var rect_vertices = 
        [ -1.0, -1.0,
           1.0, -1.0,
          -1.0,  1.0,
          -1.0,  1.0,
           1.0, -1.0,
           1.0,  1.0  ];

    var uv = 
        [ 0.0,  0.0,
          1.0,  0.0,
          0.0,  1.0,
          0.0,  1.0,
          1.0,  0.0,
          1.0,  1.0  ];

    var marker_sq = [],
        marker_side = 50,
        cloud_sq = [],
        cloud_side = 30;
   
    // generate squares (in pixels) for each component centered around (0, 0) 
    for (var i = 0; i < rect_vertices.length; i++) {
        marker_sq[i] = rect_vertices[i] * marker_side * 0.5;
        cloud_sq[i] = rect_vertices[i] * cloud_side * 0.5;
    }      

    // returns a set of vertices (in pixels)
    // representing a cloud particle centered around (0, 0)
    var generateParticleVector = function() {
        // dimensions of cloud
        var x_dimen = 2 * marker_side,
            y_dimen = 1.25 * marker_side;
        
        var x = (Math.random() * x_dimen) - marker_side,
            y = jStat.lognormal.sample( 0.2 * y_dimen, 0.3 ) - marker_side; 
       
        return {x: x, y: y};
    };
    var generateParticleAngles = function() {
        var angle = function() {
                return Math.random() * Math.PI * 2 * 
                    ( (Math.random() < 0.5) ? -1 : 1 );
            };
           
            return {x: angle(), y: angle()); 
    }; 

    var pushBlock = function(hash, type, modelX, modelY, contX, contY, 
                             vUvX, vUvY, radX, radY) {
        data.push(hash, type, modelX, modelY, contX, contY, 
                    vUvX, vUvYi, radX, radY);
        additions.push(hash, type, modelX, modelY, contX, contY,
                       vUvX, vUvY, radX, radY);
    };
    var clearArray = function(arr) {
        while (arr.length > 0) {
            // pop a block at a time
            arr.pop(); arr.pop(); arr.pop(); arr.pop(); arr.pop();
            arr.pop(); arr.pop(); arr.pop(); arr.pop(); arr.pop(); arr.pop();
        }
    };

    function Diff(idx, signal, location_x, location_y) {
        this.idx = idx;
        this.signal = signal;
        this.location_x = location_x;
        this.location_y = location_y;
    }

    // parse type
    var markerTypes = {
        RANDOM: 0,
        VIDEO: 1,
        STUMBLE: 2,
        CLOUD: 3
    };

    /*
     * interleaved block structure: (f = 32 bit float)
     * marker hash, texture, model ver, location vec, vUv   velocity
     * f            f        f, f       f, f          f, f  f, f
     *
     * marker hash: unique 32 bit int marker ID
     * texture: what image to use, 'enum"'d above in markerTypes
     * model vec: vertex coordinates in container pixels centered around (0, 0)
     * location vec: absolute location of marker in container pixels
     * vUv: vertex texture coordinates
     * velocity: x, y in radians (for cloud particles)
     */
    markerData.BLOCK_ITEMS = 10;
    markerData.BLOCK_SIZE = 40;
    markerData.HASH_ITEMS = 1;
    //markerData.NEW_MARKER_ITEMS = 1;
    markerData.TYPE_ITEMS = 1;
    markerData.MODEL_VER_ITEMS = 2;
    markerData.LOCATION_VEC_ITEMS = 2;
    markerData.VUV_ITEMS = 2;
    markerData.VELOCITY_ITEMS = 2;
    markerData.HASH_OFFSET = 0;
    //markerData.NEW_MARKER_OFFSET = 4;
    markerData.TYPE_OFFSET = 4    
    markerData.MODEL_VER_OFFSET = 8;
    markerData.LOCATION_VEC_OFFSET = 16;
    markerData.VUV_OFFSET = 24);
    markerData.VELOCITY_OFFSET = 32;
    
    // get current marker state, compare to cache, push data blocks
    markerData.getData = function() {
        //clear last
        clearArray(additions);
        clearArray(diff);
        
        var state = markerMapPosition.getCurrentState();
     
        // copy last data to data_cache ??
        last_data_length = data.length; 

        for (var i = 0; i < state.length; i++) {
            if ( !(state[i].hash in obj_cache) ) {
                //marker is new

                // push marker data to cache
                obj_cache[state[i].hash] = state[i];
                
                // push marker blocks
                for (var j = 0; j < marker_sq.length / 2; j++) {
                    pushBlock(state[i].hash, markerTypes[state[i].type.toUpperCase()], 
                              marker_sq[j * 2], marker_sq[j * 2 + 1],
                              state[i].x, state[i].y, 
                              uv[j * 2], uv[j * 2 + 1],
                              0, 0);
                }
                
                // push cloud blocks
                for (var k = 0; k < numberOfCloudParticles; k++) {
                    (function() {
                        var vec = generateParticleVector(); 
                        var angle = generateParticleAngles();
                        for (var l = 0; l < cloud_sq.length / 2; l++) {
                            pushBlock(state[i].hash, markerTypes.CLOUD,
                                    cloud_sq[l * 2] + vec.x, cloud_sq[l * 2 + 1] + vec.y,
                                    state[i].x, state[i].y,
                                    uv[l * 2], uv[l * 2 + 1],
                                    angle.x, angle.y); 
                        }
                    }())
                }

            } else if (state[i].hash in obj_cache) {
                //marker is alive, so just needs to be translated

                //update obj_cache
                obj_cache[state[i].hash].x = state[i].x; 
                obj_cache[state[i].hash].y = state[i].y; 
               
                // update new, location in data 
                var idx = data.indexOf(state[i].hash);
                //data[idx + 1] = 0;
                data[idx + 4] = state[i].x;
                data[idx + 5] = state[i].y;  

                // add change to diff [idx, 0, x, y] or [idx, 9, 0, 0]
                diffs.push(new Diff(idx, 0, state[i].x, state[i].y));
                // dynamically update with bufferSubData  - array w instructions
            } else {
                // marker is dead
                delete obj_cache[state[i].hash];
                var dead = data.indexOf(state[i].hash);
                data.splice(dead, markerData.BLOCK_ITEMS);
                diffs.push(new Diff(idx, 9, 0, 0)); 
            }
        }
        return { vertices: data.length / 11, last_length: last_length,
                 additions: additions, diffs: diffs };
    }; 

    // projective transformation for window x, y to gl coords 
    markerData.getProjection = function() {
        var sx = (1 / window.innerWidth) * 2 - 1,
            sy = (1 / window.innerHeight) * -2 + 1;
        return [ sx, 0,  0, 0,
                 0,  sy, 0, 0,
                 0,  0,  1, 0, 
                 0,  0,  0, 1 ];
    };

return markerData; });
