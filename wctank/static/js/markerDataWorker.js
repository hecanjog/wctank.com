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

var angle = function() {
    return Math.random() * Math.PI * 2 * (Math.random() < 0.5 ? -1 : 1);
};

var x_dimen = 2 * marker_side,
    y_dimen = 1.25 * marker_side;

var y_bin = y_dimen / 10;


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
        var p_vec_x = (Math.random() * x_dimen) - marker_side,
            p_vec_y = 0;
            
        var s = Math.random() * 100;

        if (s < 7) p_vec_y = y_dimen - (y_bin * 5);
        else if (s >= 7 && s < 14) p_vec_y = y_dimen - (y_bin * 4);
        else if (s >= 14 && s < 30) p_vec_y = y_dimen - (y_bin * 3);
        else if (s >= 30 && s < 50) p_vec_y = y_dimen - (y_bin * 2);
        else if (s >= 50 && s < 75) p_vec_y = y_dimen - (y_bin * 1); 
        else if (s >= 75 && s < 100) p_vec_y = y_dimen; 

        for (var l = 0; l < cloud_sq.length / 2; l++) {
            targetArr.push(MarkerData.hash, markerTypes.CLOUD,
                           cloud_sq[l * 2] + p_vec_x, cloud_sq[l * 2 + 1] + p_vec_y - 20,
                           MarkerData.x, MarkerData.y,
                           uv[l * 2], uv[l * 2 + 1],
                           angle(), angle()); 
        }
    }
};

var emptyArray = function(r) {
    while (r.length > 0) {
        r.pop();r.pop();r.pop();r.pop();r.pop();r.pop();r.pop();
        r.pop();r.pop();r.pop();r.pop();r.pop();r.pop();r.pop();
        r.pop();r.pop();r.pop();r.pop();r.pop();r.pop();r.pop();
        r.pop();r.pop();r.pop();r.pop();r.pop();r.pop();r.pop();
        r.pop();r.pop();r.pop();r.pop();r.pop();r.pop();r.pop();
    }
};

var r = [];

// message passing
onmessage = function(e) {
    emptyArray(r);

    var dat = e.data,
        override;

    override = dat.pop();
    numberOfCloudParticles = dat.pop();

    // history
    last_length = vertices;
    vertices = dat.length * 12; //?

    emptyArray(living);
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
    
    emptyArray(last_alive);
    living.forEach(function(v) {
        last_alive.push(v);
    });

    if (!same || override) {
        dat.forEach(function(v) {
            pushNewMarkerData(v, r);
        });
        postMessage(r);
    } else {
        postMessage(false);
    }
};
