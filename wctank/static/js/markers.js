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
     *  disp controls the rendering of markers w/in a webgl context;
     *  each marker consists of an icon and a cloud that surrounds it.
     */ 
    var disp = (function(disp) {
     
        var mapNode = div.$map.get(0);

        disp.markCanv = document.getElementById("markers");
        disp.markCanv.width = window.innerWidth;
        disp.markCanv.height = window.innerHeight; 
     
        // states of all living markers
        var markers = [], //for webgl consumption
            clouds = [],
            markerObj$ = [], // frendlier for js processing
            numOfCloudParticles = 35;

        // clear a block at a time
        var clearBlockArray = function(arr) {
            while (arr.length > 0) {
                arr.pop(); arr.pop(); arr.pop(); arr.pop(); 
                arr.pop(); arr.pop(); arr.pop(); arr.pop(); arr.pop();
            }
        };

        // generate an ID unique to each marker and surrounding cloud particles
        var markerIDcntr = 0;
        var getID = function() {
            return (markerIDcntr++ / (numOfCloudParticles * 6 + 6)) | 0;
        };

        var normals = {
            rect_vertices: 
                [ -1.0, -1.0,
                   1.0, -1.0,
                  -1.0,  1.0,
                  -1.0,  1.0,
                   1.0, -1.0,
                   1.0,  1.0  ],

            uv: 
                [ 0.0,  0.0,
                  1.0,  0.0,
                  0.0,  1.0,
                  0.0,  1.0,
                  1.0,  0.0,
                  1.0,  1.0  ]
        };
        
        function Vec2(x, y) {
            this.x = x;
            this.y = y;
        }
        function Vec3(x, y, z) {
            this.x = x;
            this.y = y;
            this.z = z;
        }
        function Vec4(x, y, z, w) {
            this.x = x;
            this.y = y;
            this.z = z;
            this.w = w;
            this.subtract = function(vec4In) {
                var rx = this.x - vec4In.x,
                    ry = this.y - vec4In.y,
                    rz = this.z - vec4In.z,
                    rw = this.w - vec4In.w;
                return new Vec4(rx, ry, rz, rw);
            };
            this.clear = function() {
                this.x = 0;
                this.y = 0;
                this.z = 0;
                this.w = 0;
            };
            this.set = function(vec4in) {
                this.x = vec4in.x;
                this.y = vec4in.y;
                this.z = vec4in.z;
                this.w = vec4in.w;
            };
        }
        var origin4 = new Vec4(0, 0, 0, 0);
            origin3 = new Vec3(0, 0, 0),
            origin2 = new Vec2(0, 0);

        // contains vertices for each component of marker 
        // scaled to current window size
        var marker_rect = [],
            cloud_rect = [];

        // scales normal rect to square x, y, px in gl coords @ size of current window;
        var calculateScaledRect = function(x, y, arr) {
            var v_sc_x = x / disp.markCanv.width, 
                v_sc_y = y / disp.markCanv.height;
            for (var i = 0; i < 6; i++) {
                arr[i * 2] = normals.rect_vertices[i * 2] * v_sc_x;
                arr[i * 2 + 1] = normals.rect_vertices[i * 2 + 1] * v_sc_y;
            }
        }

        // on window resize, explicitly resize canvas in pixels
        // and recalculate rects in world coords
        function resizeCanv() {
            disp.markCanv.width = window.innerWidth;
            disp.markCanv.height =  window.innerHeight;
            calculateScaledRect(50, 50, marker_rect);
            calculateScaledRect(35, 35, cloud_rect);        
            window.addEventListener('resize', function() {
                resizeCanv();
            });
        }
        resizeCanv();


        // "enums" for each texture/markertype
        // passed as part of interleaved array to be parsed in shader
        var RANDOM = 0.0,
            VIDEO = 1.0,
            STUMBLE = 2.0,
            CLOUD = 3.0;
        
        var parseType = function(markObj) {
            switch (markObj.type) {
                case 'stumble':
                    return STUMBLE;
                    break;
                case 'video':
                    return VIDEO;
                    break;
                case 'random':
                    return RANDOM;
                    break;
            } 
        };

        // convert from window x, y to gl coords
        var window2World = function(x, y) {
            var wX = (x / disp.markCanv.width) * 2 - 1,
                wY = (y / disp.markCanv.height * -2) + 1;
            return new Vec2(wX, wY); 
        };
        
        // generate scaled cloud particle coordinates (pre-translation)
        // depends on marker_rect
        var cloudCoord = function() {
            var c_offset = 0.025;
            
            // find absolute bounds of cloud
            var x_max = 2 * marker_rect[2],
                y_max = 1.25 * marker_rect[5];
            
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
            
            return new Vec3(x, y, z);
        };

        var cloudVelocity = function() {
            var calcVelocity = function() {
                return Math.random() * Math.PI * 2 * 
                    ( (Math.random() < 0.5) ? -1 : 1 );
            };
           
            return new Vec2(calcVelocity(), calcVelocity()); 
        };
        
        // template for per-vertex data blocks
        // each is structured: (b = byte)
        //  id     type    norm tex coord   coord                velocity
        //                 u       v        x       y     z      x     y
        //  bbbb   bbbb    bbbb    bbbb     bbbb    bbbb  bbbb   bbbb  bbbb
        var BLOCK_SIZE = 36,
            BLOCK_ITEMS = 9,
            ID_OFFSET = 0,
            ID_ITEMS = 1,
            TYPE_OFFSET = 4,
            TYPE_ITEMS = 1,
            UV_OFFSET = 8,
            UV_ITEMS = 2,
            WORLD_COORD_OFFSET = 16,
            WORLD_COORD_ITEMS = 3,
            VELOCITY_OFFSET = 28,
            VELOCITY_ITEMS = 2;

        var pushMarkerComponent = function(destination, marker_type, vec2_translate, vec3_world_norm_coords, 
                                        vec2_velocity, scaled_vertices_source) {
            for (var i = 0; i < 6; i++) {
                destination.push(
                    getID(),
                    marker_type,
                    normals.uv[i * 2],
                    normals.uv[i * 2 + 1],
                    vec2_translate.x + vec3_world_norm_coords.x + scaled_vertices_source[i * 2],
                    vec2_translate.y + vec3_world_norm_coords.y + scaled_vertices_source[i * 2 + 1],
                    vec3_world_norm_coords.z,
                    vec2_velocity.x,
                    vec2_velocity.y
                );
            }
        };

        // given a markObj {type: 'string', px: {x:num, y:num}}
        // generate data and push to markers array 
        var addMarker = function(markObj) { 
            var type = parseType(markObj);
            var worldCoord = window2World(markObj.px.x, markObj.px.y - 25);
            var cloudWorldCoord = window2World(markObj.px.x, markObj.px.y - 10);

            var back = (numOfCloudParticles * 0.75) | 0;
            var front = numOfCloudParticles - back;

            //first the marker
            pushMarkerComponent(markers, type, worldCoord, origin3, origin2, marker_rect);

            // cloud particles
            for (var i = 0; i < numOfCloudParticles; i++) {
                pushMarkerComponent(markers, CLOUD, cloudWorldCoord, cloudCoord(), cloudVelocity(), cloud_rect); 
            }
        };    
       
        /*
         *  WebGl setup and drawing
         */
        // webGl context setup
        var z = visCore.webgl.setup(disp.markCanv, MarkerShaders, true),
            a_marker_buffer = z.gl.createBuffer(),
            a_type, a_normCoords, a_position;        
     
        // for now, ignore depth and just blend
        //z.gl.depthFunc(z.gl.NEVER);
        //z.gl.enable(z.gl.DEPTH_TEST);
        z.gl.blendFunc(z.gl.SRC_ALPHA, z.gl.ONE);
        z.gl.disable(z.gl.DEPTH_TEST);
        z.gl.enable(z.gl.BLEND);

        // setup textures
        var units = {
            u_stumble: z.gl.TEXTURE0,
            u_video: z.gl.TEXTURE1,
            u_random: z.gl.TEXTURE2,
            u_cloud: z.gl.TEXTURE3    
        };
        
        function Texture(path, textureID) {
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
                
                z.gl.activeTexture(textureID);
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
            u_stumble: new Texture('static/assets/rap.png', z.gl.TEXTURE0),
            u_video: new Texture('static/assets/colorbars.png', z.gl.TEXTURE1),
            u_random: new Texture('static/assets/rand.png', z.gl.TEXTURE2),
            u_cloud: new Texture('static/assets/cloud.png', z.gl.TEXTURE3)
        };

        /*
         *  create mouseover events
         */
        var u_mouseover = 0,
            u_mouseoverIdx = 0,
            mousePosition = new Vec4(0, 0, 0, 0),
            mouseDownStart = new Vec4(0, 0, 0, 0),
            mouseUpPosition = new Vec4(0, 0, 0, 0);

        mapNode.addEventListener('mousemove', function(e) {
            var x = e.x;
            var y = e.y;
            var coord = window2World(x, y);
            mousePosition.x = coord.x;
            mousePosition.y = coord.y;
            // optimize this with at least a btree or something...
            if (markerObj$) {
                for (var i = 0; i < markerObj$.length; i++) {
                    var x_bound = markerObj$[i].px.x;
                    var y_bound = markerObj$[i].px.y;
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
        });
       
        mapNode.addEventListener('mousedown', function(e) {
            mouseDownStart.clear();
            var coord = window2World(e.x, e.y);
            mouseDownStart.x = coord.x;
            mouseDownStart.y = coord.y;
        });

        /*
         * these drawing functions *need* to be optimized to a fine powder
         */
        disp.translate = (function(translate) {
            var u_translate = new Vec4(0, 0, 0, 0),
                nil = new Vec4(0, 0, 0, 0),
                start = new Vec4(0, 0, 0, 0);
            // need to set isTranslating to true, then call these three
            // functions in sequence when moving    
            translate.isTranslating = false;
            translate.setStart = function(inVec4) {
                start.set(inVec4);
            };
            translate.getCurrent = function(current) {
                if (translate.isTranslating) {
                    u_translate.set(current.subtract(start));
                    return u_translate;
                } else {
                    return nil;
                }
            };
            translate.reset = function() {
                translate.isTranslating = false;
                u_translate.clear();
                nil.clear();
                start.clear();
            };
            return translate;
        }({}));

        disp.blackout = 0;
        disp.zooming = false;

        var u_clock = 0;
        disp.draw = function() {
            z.gl.clear(z.gl.COLOR_BUFFER_BIT | z.gl.DEPTH_BUFFER_BIT);
            var c = disp.translate.getCurrent(mousePosition);
            z.gl.uniform4f( z.gl.getUniformLocation(z.program, 'u_translate'), c.x, c.y, c.z, c.w);
            z.gl.uniform1i( z.gl.getUniformLocation(z.program, 'u_mouseover'), u_mouseover);
            z.gl.uniform1i( z.gl.getUniformLocation(z.program, 'u_mouseoverIdx'), u_mouseoverIdx);
            z.gl.uniform1i( z.gl.getUniformLocation(z.program, 'u_clock'), u_clock++);
            z.gl.uniform1i( z.gl.getUniformLocation(z.program, 'u_blackout'), disp.blackout);
            z.gl.drawArrays(z.gl.TRIANGLES, 0, markers.length / 9); 
        };
        
        // switch in middle to only translate, not draw new clouds
        var mark$_length = 0;
        disp.drawWithDataUpdate = function(arrMarkObjs) {
            
            if (arrMarkObjs && arrMarkObjs.length > 0) {
                if ( (mark$_length === arrMarkObjs.length) && !disp.zooming ) {
                    // only translate
                    disp.translate.isTranslating = true;
                    disp.draw(); 

                } else {
                    disp.translate.reset();
                    disp.translate.isTranslating = false;
                    disp.translate.setStart(mouseDownStart);

                    mark$_length = arrMarkObjs.length;
                    markerObj$ = arrMarkObjs;
                    vertexID = 0;
                    
                    clearBlockArray(markers);
                    clearBlockArray(clouds);
                    
                    for (var i = 0; i < arrMarkObjs.length; i++) {
                        addMarker(arrMarkObjs[i]);
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
                    z.gl.vertexAttribPointer(a_vertexID, ID_ITEMS, z.gl.FLOAT, false, BLOCK_SIZE, ID_OFFSET);
                    z.gl.enableVertexAttribArray(a_vertexID);

                    a_type = z.gl.getAttribLocation(z.program, 'a_type');
                    z.gl.vertexAttribPointer(a_type, TYPE_ITEMS, z.gl.FLOAT, false, BLOCK_SIZE, TYPE_OFFSET); 
                    z.gl.enableVertexAttribArray(a_type);
                    
                    a_normCoords = z.gl.getAttribLocation(z.program, 'a_normCoords');
                    z.gl.vertexAttribPointer(a_normCoords, UV_ITEMS, z.gl.FLOAT, false, BLOCK_SIZE, UV_OFFSET);
                    z.gl.enableVertexAttribArray(a_normCoords);
                    
                    a_position = z.gl.getAttribLocation(z.program, 'a_position');
                    z.gl.vertexAttribPointer(a_position, WORLD_COORD_ITEMS, z.gl.FLOAT, false, BLOCK_SIZE, WORLD_COORD_OFFSET);
                    z.gl.enableVertexAttribArray(a_position);
                    
                    a_velocity = z.gl.getAttribLocation(z.program, 'a_velocity');
                    z.gl.vertexAttribPointer(a_velocity, VELOCITY_ITEMS, z.gl.FLOAT, false, BLOCK_SIZE, VELOCITY_OFFSET);
                    z.gl.enableVertexAttribArray(a_velocity);
                    
                    disp.draw();
                } 
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
   
    /*
     *  rendering and data update
     */ 
    // update is leaking in render stack 
    var update_data = false,
        update_once = false;
    var update = function() {
        if (update_data) {
            disp.drawWithDataUpdate( marks.getDrawingData() );
            if (update_once) {
                update_data = false;
                update_once = false;
            }
        } else {
            disp.draw();
        }
    };
    visCore.render.push(update);
    if (!visCore.render.rendering) visCore.render.go(); 
    

    gMap.events.push(gMap.events.MAP, 'idle', function() {
        disp.translate.reset();
        update_data = false;
        disp.zooming = false;        
    });
    gMap.events.push(gMap.events.MAP, 'dragend', function() {
        disp.translate.reset();
        update_data = true;
        update_once = true;
    });
    gMap.events.push(gMap.events.MAP, 'drag', function() {
        disp.translate.isTranslating = true;
        update_data = true;
    });
    gMap.events.push(gMap.events.MAP, 'dragstart', function() {
        disp.translate.reset();
    });

    gMap.events.push(gMap.events.MAP, 'zoom_changed', function() {
        disp.translate.reset(); 
        update_data = true;
        update_once = true;
        disp.zooming = true;
    });  
    
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
