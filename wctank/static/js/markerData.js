define(
    [
        'markerMapPosition',
    ],

function(markerMapPosition) { var markerData = {};
    var vertices = 0,
        last_length = 0,
        last_alive = [],
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
  
        var y_bin = y_dimen / 10;

        var x = (Math.random() * x_dimen) - marker_side,
            y = (function() {
                var s = Math.random() * 100;
                if (s < 7) return y_dimen - (y_bin * 5);
                if ( (s >= 7) && (s < 14) ) return y_dimen - (y_bin * 4);
                if ( (s >= 14) && (s < 30) ) return y_dimen - (y_bin * 3);
                if ( (s >= 30) && (s < 50) ) return y_dimen - (y_bin * 2);
                if ( (s >= 50) && (s < 75) ) return y_dimen - (y_bin * 1); 
                if ( (s >= 75) && (s < 100) ) return y_dimen; 
            }())

        return {x: x, y: y};
    };
    var generateParticleAngles = function() {
        var angle = function() {
            return Math.random() * Math.PI * 2 * 
                ( (Math.random() < 0.5) ? -1 : 1 );
        };
       
        return {x: angle(), y: angle()}; 
    }; 

    var pushNewMarkerData = function(MarkerData, targetArr) {
        // push marker block
        for (var j = 0; j < marker_sq.length / 2; j++) {
            targetArr.push(MarkerData.hash, markerTypes[MarkerData.type.toUpperCase()], 
                           marker_sq[j * 2], marker_sq[j * 2 + 1],
                           MarkerData.x, MarkerData.y, 
                           uv[j * 2], uv[j * 2 + 1],
                           0, 0);
        }
        // push cloud blocks
        for (var k = 0; k < numberOfCloudParticles; k++) {
            (function() {
                var vec = generateParticleVector(); 
                var angle = generateParticleAngles();
                for (var l = 0; l < cloud_sq.length / 2; l++) {
                    targetArr.push(MarkerData.hash, markerTypes.CLOUD,
                                   cloud_sq[l * 2] + vec.x, cloud_sq[l * 2 + 1] + vec.y - 25,
                                   MarkerData.x, MarkerData.y,
                                   uv[l * 2], uv[l * 2 + 1],
                                   angle.x, angle.y); 
                }
            }())
        }
    };
    
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
    markerData.NUMBER_OF_PARTICLES = numberOfCloudParticles;
    markerData.BLOCK_ITEMS = 10;
    markerData.BLOCK_SIZE = 40;
    markerData.HASH_ITEMS = 1;
    markerData.HASH_OFFSET = 0;
    markerData.TYPE_ITEMS = 1;
    markerData.TYPE_OFFSET = 4    
    markerData.MODEL_VER_ITEMS = 2;
    markerData.MODEL_VER_OFFSET = 8;
    markerData.LOCATION_VEC_ITEMS = 2;
    markerData.LOCATION_VEC_OFFSET = 16;
    markerData.VUV_ITEMS = 2;
    markerData.VUV_OFFSET = 24;
    markerData.VELOCITY_ITEMS = 2;
    markerData.VELOCITY_OFFSET = 32;

    // get current marker state, compare to cache, push data blocks
    markerData.getData = function() {
        //clear last
        var data = [];

        var state = markerMapPosition.getCurrentState();
        
        last_length = vertices;
        vertices = state.length * 12; 

        state.forEach(function(val) {
            pushNewMarkerData(val, data);
        });
        return data;
    }; 

return markerData; });
