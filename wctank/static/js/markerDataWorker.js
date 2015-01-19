var vertices = 0,
    last_length = 0,
    last_alive = [],
    living = [],
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

// parse type
var markerTypes = {
    RANDOM: 0,
    VIDEO: 1,
    STUMBLE: 2,
    CLOUD: 3
};

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
            if (s >= 7 && s < 14) return y_dimen - (y_bin * 4);
            if (s >= 14 && s < 30) return y_dimen - (y_bin * 3);
            if (s >= 30 && s < 50) return y_dimen - (y_bin * 2);
            if (s >= 50 && s < 75) return y_dimen - (y_bin * 1); 
            if (s >= 75 && s < 100) return y_dimen; 
        }());

    return {x: x, y: y};
};
var generateParticleAngles = function() {
    var angle = function() {
        return Math.random() * Math.PI * 2 * 
            (Math.random() < 0.5 ? -1 : 1 );
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
                               cloud_sq[l * 2] + vec.x, cloud_sq[l * 2 + 1] + vec.y - 20,
                               MarkerData.x, MarkerData.y,
                               uv[l * 2], uv[l * 2 + 1],
                               angle.x, angle.y); 
            }
        }());
    }
};

// message passing
onmessage = function(e) {
    var r = [],
        dat = e.data,
        override;

    override = dat.pop();
    numberOfCloudParticles = dat.pop();

    // history
    last_length = vertices;
    vertices = dat.length * 12; //?

    living = [];
    var same = true;

    dat.forEach(function(v) {
        living.push(v.hash);
        if (last_alive.indexOf(v.hash) === -1) {
            same = false;
        }
    });
    if (living.length !== last_alive.length) {
        same = false;
    }
    last_alive = [];
    living.forEach(function(v) {
        last_alive.push(v);
    });

    if (!same || override) {
        dat.forEach(function(v) {
            pushNewMarkerData(v, r);
        });
    } else {
        r = false;
    }
    
    postMessage(r);
};
