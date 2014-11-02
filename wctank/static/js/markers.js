define(
    [
        'gMap',
        'posts',
        'visCore',
        'text!MarkerShaders.glsl',
        'sylvester'
    ],

function(gMap, posts, visCore, MarkerShaders, sylvester) { var markers = {};
    /*
     * rendering map markers in webgl      
     */
    var disp = (function(disp) {
        var getImageCanv = function(path) {
            var img = new Image();
            img.src = path;
            var can = document.createElement("canvas");
            img.onload = function() {
                can.width = img.width;
                can.height = img.height;
                ctx = can.getContext("2d");
                ctx.drawImage(img, 0, 0); 
            };
            return can;
        };
        
        disp.markCanv = document.getElementById("markers-a");
        disp.markCanv.width = window.innerWidth;
        disp.markCanv.height = window.innerHeight; 
       
        //optimize this - only do matrix math when necssary
        // - do not clear ARRAY_BUFFER on every frame, 
        // only translate until vertices are changed

        // a square
        var m_marker = 
            [ -1.0, -1.0,
               1.0, -1.0,
              -1.0,  1.0,
              -1.0,  1.0,
               1.0, -1.0,
               1.0,  1.0  ];
        
        var window2Viewport = function(point) {
            var x, y;
            var off_x = 25;
            var off_y = 10;
            x = ( (point.x + off_x) / disp.markCanv.width) * 2 - 1;
            y = ( (point.y + off_y) / disp.markCanv.height * -2) + 1;
            return new google.maps.Point(x, y);   
        };
        // called on window resize
        var getScaledMarkerMat = function() {
            // dimen of marker images in pixels
            var mark_x = 50;
            var mark_y = 50;

            var v_sc = [mark_x / disp.markCanv.width, mark_y / disp.markCanv.height],
                m_sc = [];
            for (var j = 0; j < (m_marker.length / 2); j++) {
                var row = [];
                row[0] = m_marker[j * 2] * v_sc[0];
                row[1] = m_marker[j * 2 + 1] * v_sc[1];
                m_sc.push(row);
            }
            return $M(m_sc);
        };
        var getTranslatedVertices = function($mat, px) {
            var arr = [];
            for (var i = 0; i < (m_marker.length / 2); i++) {
                arr.push([px.x, px.y]);
            }
            return $mat.add( $M(arr) );
        };
        
        var flatten$M = function($mat) {
            var r = [];
            for (var i = 0; i < $mat.elements.length; i++) {
                for (var j = 0; j < $mat.elements[i].length; j++) {
                    r.push($mat.elements[i][j]);
                }
            }
            return r;
        }

        var vertices = [];
        var addMarker = function(mark_obj) { //{type: , px: {x: y:}
            vertices = vertices.concat( flatten$M(getTranslatedVertices(
                getScaledMarkerMat(disp.markCanv.width, disp.markCanv.height),
                window2Viewport(mark_obj.px)
            )));
        };    

        var z = visCore.webgl.setup(disp.markCanv, MarkerShaders, true);
        
        //var markPos = z.gl.getUniformLocation(z.program, 'markPos');
        //z.gl.uniform2f(markPos, 0.0, 0.0);
        
        z.gl.drawArrays(z.gl.TRIANGLES, 0, vertices.length / 2); 

        (function resizeC() {
            disp.markCanv.width = window.innerWidth;
            disp.markCanv.height =  window.innerHeight;
             window.addEventListener('resize', function() {
                resizeC();
            });
        }())
        var imgs = {
            video: getImageCanv('static/assets/colorbars.png'),
            stumble: getImageCanv('static/assets/rap.png'),
            random: getImageCanv('static/assets/rand.png')
        };
        var markerLoc;
        var a_position;
        disp.drawCycle = function(px_arr) {
            if (px_arr) {
                vertices = []; 
                z.gl.clear(z.gl.COLOR_BUFFER_BIT | z.gl.DEPTH_BUFFER_BIT);
                for (var i = 0; i < px_arr.length; i++) {
                    addMarker(px_arr[i]);
                    markerLoc = z.gl.createBuffer();
                    z.gl.bindBuffer(z.gl.ARRAY_BUFFER, markerLoc);
                    z.gl.bufferData(z.gl.ARRAY_BUFFER, 
                        new Float32Array(vertices), z.gl.STATIC_DRAW);
                }

                a_position = z.gl.getAttribLocation(z.program, 'a_position');
                z.gl.enableVertexAttribArray(a_position);
                z.gl.vertexAttribPointer(a_position, 2, z.gl.FLOAT, false, 0, 0);
                z.gl.drawArrays(z.gl.TRIANGLES, 0, vertices.length / 2);

                z.gl.deleteBuffer(markerLoc);
            }
        };
        return disp;
    }({}))          
    
    var marks = (function(marks) {
        var stk = [];
        var lats = [];
        var lngs = [];
        var overflow = 20;
        marks.isDuplicate = function(m) {
            var pos = m.getPosition();
            var lat_idx =  lats.indexOf( pos.lat() );
            if ( lat_idx !== -1 ) {
                var lng_idx = lngs.indexOf( pos.lng() );
                if ( lng_idx !== -1 ) 
                    return (lat_idx === lng_idx) ? lat_idx : false;
            }
        };
        marks.pushMark = function(m) {
            var pos = m.getPosition();
            stk.push(m);
            lats.push( pos.lat() );
            lngs.push( pos.lng() );
        };      
        marks.rmMark = function(m) {
            var idx = marks.isDuplicate(m);
            if (idx) {
                stk.splice(idx, 1);
                lats.splice(idx, 1);
                lngs.splice(idx, 1);
            }
        };
        var getMarkXY = function(m, pjkt) { 
            var pos = m.getPosition();
            var px = pjkt.fromLatLngToContainerPixel(pos); 
            for (var dim in px) {
                if (px.hasOwnProperty(dim) ) {
                    if ( px[dim] < (overflow * -1) ) return false;
                }
            }
            px.x -= 27;
            px.y -= 35;
            return px;
        };
        marks.getDrawingInfo = function() { //returns [ ['type', px: {x: y:}],  ]
            if (stk.length > 0) {   
                var r = [];
                var pjkt = gMap.pxOverlay.getProjection();
                for (var i = 0; i < stk.length; i++) {
                    var px = getMarkXY(stk[i], pjkt);
                    if (px) r.push({type: stk[i].markerType, px: px});   
                }
                return r;
            }
        };  
        return marks;
    }({}))
    //animate in main render loop instead, but only while dragging
    var update = function() {
        disp.drawCycle( marks.getDrawingInfo() );
    };
    gMap.events.push(gMap.events.MAP, 'bounds_changed', update);
    
    markers.addMarker = function(m) {
        if ( !marks.isDuplicate(m) ) {
            marks.pushMark(m);
            update();         
        }
    };
    markers.setVisibility = function(bool) {
        var vis = bool ? 'visible' : 'hidden';
        disp.markCanv.style.visibility = vis;
    };

    gMap.events.push(gMap.events.MAP, 'tilesloaded', function() {
        posts.get(gMap.map.getBounds(), function(data) {
            $.each(data, function(i, post) {
                var m,
                    loc = new google.maps.LatLng(post.lat, post.long);
                m = new google.maps.Marker({
                    position: loc,
                    map: gMap.map,
                    icon: "static/assets/blank.png"
                });
                m.markerType = post.markerType;
                markers.addMarker(m);
                gMap.events.addHeapEvents(gMap.events.MARKER, m);
                google.maps.event.addListener(m, 'click', function() { posts.display(post); });
            });
        });
    });
     
return markers; });
