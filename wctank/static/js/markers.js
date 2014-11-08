// before we fix the translation, fix mouseover

define(
    [
        'div',
        'gMap',
        'posts',
        'visCore',
        'text!MarkerShaders.glsl'
    ],

function(div, gMap, posts, visCore, MarkerShaders) { var markers = {};
    /*
     * rendering map markers in webgl      
     */
    var disp = (function(disp) {
        
        disp.markCanv = document.getElementById("markers");
        disp.markCanv.width = window.innerWidth;
        disp.markCanv.height = window.innerHeight; 
     

        // verticies representing a square or rectangle 
        var norm_rect = 
            [ -1.0, -1.0,
               1.0, -1.0,
              -1.0,  1.0,
              -1.0,  1.0,
               1.0, -1.0,
               1.0,  1.0  ];
        
        // texture u, v 
        var tex_rect = 
            [ 0.0,  0.0,
              1.0,  0.0,
              0.0,  1.0,
              0.0,  1.0,
              1.0,  0.0,
              1.0,  1.0  ];


        // states of all living markers
        var markers = []; // for webGl consumption
        var collection = []; // frendlier for js processing
        
        // scales normal rect to square 50x50px in gl coords @ size of current window;
        // only need to do this once before first marker add;
        // abstracted out to avoid if in critical loop
        var marker_rect = [];
        var cloud_rect = [];
        var calculateScaledRect = function(x, y, arr) {
            var v_sc_x = x / disp.markCanv.width, 
                v_sc_y = y / disp.markCanv.height;
            for (var i = 0; i < 6; i++) {
                arr[i * 2] = norm_rect[i * 2] * v_sc_x;
                arr[i * 2 + 1] = norm_rect[i * 2 + 1] * v_sc_y;
            }
        }
       
        var vertexID = 0; 
        
        var addMarker = function(markObj) { 
            // consts used in fragment shader to determine
            // what texture to use 
            var RANDOM = 0.0,
                VIDEO = 1.0,
                STUMBLE = 2.0,
                CLOUD = 3.0,
                type;
            
            // parse marker type to const
            switch (markObj.type) {
                case 'stumble':
                    type = STUMBLE;
                    break;
                case 'video':
                    type = VIDEO;
                    break;
                case 'random':
                    type = RANDOM;
                    break;
            } 
            
            // convert from window to WebGl coordinates with an offset to account for
            // pxOverlay returning a point @ 1/2x & 0y
            var x = markObj.px.x,
                y = markObj.px.y,
                off_y = -25, 
                gl_x, gl_y;           
            
            gl_x = (x / disp.markCanv.width) * 2 - 1;
            gl_y = ( (y + off_y) / disp.markCanv.height * -2) + 1;
           
            var numOfCloudParticles = 30;
            
window.dbgmark = function(idx) {
    console.log(collection.length, (markers.length / 9) / (numOfCloudParticles * 6 + 6) );
};
            // returns object containing gl_coordinates for cloud particle;
            // sort of random about gl x, y, weighted toward lower x values
            var cloudCoord = function() {
                var c_offset = 0.025;
                
                // coords x, y, z; velocity x, y
                function cloudVec(x, y, z, u, v) {
                    this.x = x;
                    this.y = y;
                    this.z = z;
                    this.u = u;
                    this.v = v;
                }

                // find absolute bounds of cloud
                var dx = marker_rect[2],
                    dy = marker_rect[5], 
                    x_max = 2 * dx,
                    y_max = 1.25 * dy;
                
                // equal distribution x
                var x = (Math.random() * 2 * x_max) - x_max;
                
                // 6 y bins
                var dy_bin = (y_max + 0.25 * y_max) / 6,
                    y_bins = [ y_max - dy_bin,
                               y_max - (dy_bin * 2),
                               y_max - (dy_bin * 3),
                               y_max - (dy_bin * 4),
                               y_max - (dy_bin * 5),
                               y_max - (dy_bin * 6) ];
                
                var y_bin = (function() {
                    var s = Math.random() * 100;
                    if (s <= 33) return y_bins[5];
                    if ( (s > 33) && (s <= 54) ) return y_bins[4];
                    if ( (s > 54) && (s <= 70) ) return y_bins[3];
                    if ( (s > 70) && (s <= 82) ) return y_bins[2];
                    if ( (s > 82) && (s <= 92) ) return y_bins[1];
                    if ( (s > 92) && (s <= 100) ) return y_bins[0];
                }())
               
                var y_jitter = dy_bin / 2;
                var y = y_bin + (Math.random() * y_jitter) - c_offset;

                // 4 z bins, 2 in front of the marker, and 2 behind,
                // biased heavily toward the back
                var z_bins = [ -2, -1, 1, 2];
                var z = (function() {
                    var s = Math.random() * 100;
                    if (s <= 50) return z_bins[0];
                    if ( (s > 50) && (s <= 70) ) return z_bins[1];
                    if ( (s > 70) && (s <= 90) ) return z_bins[2];
                    if ( (s > 90) && (s <= 100) ) return z_bins[3];
                }())
                
                var calcVelocity = function() {
                    return Math.random() * Math.PI * 2 * 
                        ( (Math.random() < 0.5) ? -1 : 1 );
                };

                // set velocity (in radians) for each 
                // individual cloud particle in x, y dimensions
                var u = calcVelocity(); 
                var v = calcVelocity();  
                
                return new cloudVec(x, y, z, u, v);
            };
            
            // generate an ID unique to each marker and surrounding cloud particles
            var getID = function() {
                var id = (vertexID / (numOfCloudParticles * 6 + 6)) | 0;
                vertexID++;
                return id;
            };

            // assemble per vertex data blocks and push to markers
            // each is structured: 
            //  id     type    norm tex coord   coord                speed 
            //                 u       v        x       y     z      x     y
            //  bbbb   bbbb    bbbb    bbbb     bbbb    bbbb  bbbb   bbbb  bbbb

            var makeCloud = function(cloudVec) {
                for (var k = 0; k < 6; k++) {
                    markers.push(
                        getID(), // id
                        CLOUD, //type enum
                        tex_rect[k * 2], // norm u
                        tex_rect[k * 2 + 1], //norm v
                        gl_x + cloudVec.x + cloud_rect[k * 2], // world space x
                        gl_y + cloudVec.y + cloud_rect[k * 2 + 1], //world y
                        cloudVec.z, //world z
                        cloudVec.u, //velocity x
                        cloudVec.v); // velocity y
                }
            }
            // first the marker
            for (var i = 0; i < 6; i++) {
                markers.push(
                    getID(),
                    type,
                    tex_rect[i * 2],
                    tex_rect[i * 2 + 1],
                    gl_x + marker_rect[i * 2],
                    gl_y + marker_rect[i * 2 + 1],
                    0,
                    0,
                    0);
            }
            // then the cloud
            for (var j = 0; j < numOfCloudParticles; j++) {
                makeCloud( cloudCoord() );
            };
        };    
        
        // on window resize, explicitly resize canvas in pixels
        // and recalculate rects in world coords
        (function resizeCanv() {
            disp.markCanv.width = window.innerWidth;
            disp.markCanv.height =  window.innerHeight;
            calculateScaledRect(50, 50, marker_rect);
            calculateScaledRect(25, 25, cloud_rect);        
            window.addEventListener('resize', function() {
                resizeCanv();
            });
        }())
        
        // webGl context setup
        var z = visCore.webgl.setup(disp.markCanv, MarkerShaders, true),
            a_marker_buffer = z.gl.createBuffer(),
            a_type, a_normCoords, a_position;        
     
        //z.gl.enable(z.gl.DEPTH_TEST); 
        //z.gl.depthMask(false);
        z.gl.blendFunc(z.gl.SRC_ALPHA, z.gl.ONE);
        z.gl.enable(z.gl.BLEND);

        //z.gl.disable(z.gl.DEPTH_TEST);
        
        // setup textures
        var units = {
            u_stumble: z.gl.TEXTURE0,
            u_video: z.gl.TEXTURE1,
            u_random: z.gl.TEXTURE2,
            u_cloud: z.gl.TEXTURE3    
        };
        
        var cntr = z.gl.TEXTURE0;
        var imgTexObj = function(path) {
            this.image;
           
            var tex = z.gl.createTexture();
            this.texture = tex;
            
            var img = new Image();
            img.src = path;
            var can = document.createElement("canvas");
            img.onload = function() {
                can.width = img.width;
                can.height = img.height;
                ctx = can.getContext('2d');
                ctx.drawImage(img, 0, 0);
                
                this.image = can; // I would really rather work with ArrayBufferViews here
                
                z.gl.activeTexture(cntr++);
                z.gl.bindTexture(z.gl.TEXTURE_2D, tex);
                z.gl.texParameteri(z.gl.TEXTURE_2D, z.gl.TEXTURE_MIN_FILTER, z.gl.LINEAR);
                z.gl.texParameteri(z.gl.TEXTURE_2D, z.gl.TEXTURE_WRAP_S, z.gl.CLAMP_TO_EDGE); 
                z.gl.texParameteri(z.gl.TEXTURE_2D, z.gl.TEXTURE_WRAP_T, z.gl.CLAMP_TO_EDGE);
                z.gl.texParameteri(z.gl.TEXTURE_2D, z.gl.TEXTURE_MAG_FILTER, z.gl.NEAREST);
                z.gl.pixelStorei(z.gl.UNPACK_FLIP_Y_WEBGL, true);
                z.gl.texImage2D(z.gl.TEXTURE_2D, 0, z.gl.RGBA, z.gl.RGBA, z.gl.UNSIGNED_BYTE, can);
            };
        };

        var markerImages = {
            u_stumble: new imgTexObj('static/assets/rap.png'),
            u_video: new imgTexObj('static/assets/colorbars.png'),
            u_random: new imgTexObj('static/assets/rand.png'),
            u_cloud: new imgTexObj('static/assets/cloud.png')
        };

        /*
         *  create mouseover events
         */
        var u_mouseover = 0;
        var u_mouseoverIdx = 0;  
        
        div.$map.get(0).addEventListener('mousemove', function(e) {
            var x = e.x;
            var y = e.y;
            // obviously optimize this with at least a btree or something...
            if (collection) {
                for (var i = 0; i < collection.length; i++) {
                    var x_bound = collection[i].px.x;
                    var y_bound = collection[i].px.y;
                    if ( (x > x_bound - 25) && (x < x_bound + 25) 
                            && (y > y_bound - 50) && (y < y_bound) ) {
                        u_mouseover = 1.1;
                        u_mouseoverIdx = i;
                        break;    
                    } else {
                        u_mouseover = 0;
                    }
                }
            }
            console.log(u_mouseover, u_mouseoverIdx);
        });
        
        /*
         * these drawing functions *need* to be optimized to a fine powder
         */
        var u_clock = 0;
        disp.blackout = 0;
        disp.draw = function() {
            z.gl.clear(z.gl.COLOR_BUFFER_BIT | z.gl.DEPTH_BUFFER_BIT);
            z.gl.uniform1i( z.gl.getUniformLocation(z.program, 'u_mouseover'), u_mouseover);
            z.gl.uniform1i( z.gl.getUniformLocation(z.program, 'u_mouseoverIdx'), u_mouseoverIdx);
            z.gl.uniform1i( z.gl.getUniformLocation(z.program, 'u_clock'), u_clock++);
            z.gl.uniform1i( z.gl.getUniformLocation(z.program, 'u_blackout'), disp.blackout);
            z.gl.drawArrays(z.gl.TRIANGLES, 0, markers.length / 9); 
        };
        // switch in middle to only translate, not draw new clouds

        disp.drawWithDataUpdate = function(arrMarkObjs) {
            collection = arrMarkObjs;
            vertexID = 0;
            if (arrMarkObjs && arrMarkObjs.length > 0) {
                // pop a block at a time 
                while (markers.length > 0) {
                    markers.pop(); markers.pop(); markers.pop(); markers.pop(); 
                    markers.pop(); markers.pop(); markers.pop(); markers.pop(); markers.pop(); 
                }
                
                var numObjs = arrMarkObjs.length;
                if (numObjs < 8) {
                    for (var i = 0; i < arrMarkObjs.length; i++) {
                        addMarker(arrMarkObjs[i]);
                    }
                } else {
                    // There's a possibility that we'll have to deal with a lot of markers,
                    // (and/or marker clusters) so Duff machine that boyo
                    // ...probably a bit much...
                    var iter = numObjs / 8 | 0,
                        rem = numObjs % 8,
                        i = 0;
                    if (rem > 0) {
                        do {
                            addMarker(arrMarkObjs[i++]);
                        } while (--rem > 0);    
                    }    
                    do {
                        addMarker(arrMarkObjs[i++]);
                        addMarker(arrMarkObjs[i++]);
                        addMarker(arrMarkObjs[i++]);
                        addMarker(arrMarkObjs[i++]);
                        addMarker(arrMarkObjs[i++]);
                        addMarker(arrMarkObjs[i++]);
                        addMarker(arrMarkObjs[i++]);
                        addMarker(arrMarkObjs[i++]);
                    } while (--iter > 0);
                }
                var iter = 0;
                for (var img in markerImages) {
                    if (markerImages.hasOwnProperty(img)) {
                        z.gl.activeTexture(units[img]);
                        z.gl.bindTexture(z.gl.TEXTURE_2D, markerImages[img].texture);
                        z.gl.texSubImage2D(z.gl.TEXTURE_2D, 0, 0, 0, z.gl.RGBA, 
                                           z.gl.UNSIGNED_BYTE, markerImages[img].image);
                        z.gl.uniform1i( z.gl.getUniformLocation(z.program, img), iter++ );
                    }
                }
                
                z.gl.bindBuffer(z.gl.ARRAY_BUFFER, a_marker_buffer);
                z.gl.bufferData(z.gl.ARRAY_BUFFER, new Float32Array(markers), z.gl.DYNAMIC_DRAW); 

                a_vertexID = z.gl.getUniformLocation(z.program, 'a_vertexID');
                z.gl.vertexAttribPointer(a_vertexID, 1, z.gl.FLOAT, false, 36, 0)
                z.gl.enableVertexAttribArray(a_vertexID);

                a_type = z.gl.getAttribLocation(z.program, 'a_type');
                z.gl.vertexAttribPointer(a_type, 1, z.gl.FLOAT, false, 36, 4); 
                z.gl.enableVertexAttribArray(a_type);
                
                a_normCoords = z.gl.getAttribLocation(z.program, 'a_normCoords');
                z.gl.vertexAttribPointer(a_normCoords, 2, z.gl.FLOAT, false, 36, 8);
                z.gl.enableVertexAttribArray(a_normCoords);
                
                a_position = z.gl.getAttribLocation(z.program, 'a_position');
                z.gl.vertexAttribPointer(a_position, 3, z.gl.FLOAT, false, 36, 16);
                z.gl.enableVertexAttribArray(a_position);
                
                a_velocity = z.gl.getAttribLocation(z.program, 'a_velocity');
                z.gl.vertexAttribPointer(a_velocity, 2, z.gl.FLOAT, false, 36, 28);
                z.gl.enableVertexAttribArray(a_velocity);

                disp.draw();
            }
        }

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
            return ( (px.x < (overflow * -1)) || (px.y < (overflow * -1)) ) ? false : px;
        };
        var MarkerDataObj = function(type, goog_pt_obj) {
            this.type = type;
            this.px = goog_pt_obj;
        };
        var d_dat = [];
        marks.getDrawingData = function() { 
            if (stk.length > 0) {   
                while (d_dat.length > 0) {
                    d_dat.pop();
                }
                var pjkt = gMap.pxOverlay.getProjection();
                
                for (var i = 0; i < stk.length; i++) {
                    var px = getMarkXY(stk[i], pjkt);
                    if (px) d_dat.push( new MarkerDataObj(stk[i].markerType, px) );   
                }
                return d_dat;
            }
        };  
        return marks;
    }({}))
    
    visCore.render.push(disp.draw);
    if (!visCore.render.rendering) visCore.render.go(); 
    window.draw = function() {
        visCore.render.push(disp.draw);
        visCore.render.go();
    };
    // update is leaking in render stack 
    var update = function() {
        disp.drawWithDataUpdate( marks.getDrawingData() );
    };
    var startUpdate = function() {
        visCore.render.push(update);
        if (!visCore.render.rendering) visCore.render.go();
    };
    var stopUpdate = function() {
        visCore.render.rm(update);
        if (!visCore.render.has()) visCore.render.stop();
    };
    gMap.events.push(gMap.events.MAP, 'mousedown', startUpdate);
    gMap.events.push(gMap.events.MAP, 'mouseup', stopUpdate);
    gMap.events.push(gMap.events.MAP, 'idle', stopUpdate);
    gMap.events.push(gMap.events.MAP, 'zoom_changed', update);  

    window.addEventListener('resize', update);

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
    markers.blackout = function(bool) {
        disp.blackout = bool ? 1 : 0;
        disp.draw();
    };
    window.blackout = markers.blackout;
    // glow on markers.
    /*
     *  display placeholders on map
     */
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
                google.maps.event.addListener(m, 'click', function() { 
                    posts.display(post); 
                });
            });
        });
    });

return markers; });
