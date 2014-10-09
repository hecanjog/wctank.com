//TODO: refine map_canvas selector, handle non-webgl and non-svg (disable filters that use webgl, 
//svg and fallbacks), create pop-up suprises, do something with wes's text, add map sounds, 
// remove wes tank video filter after video finished - introduce delay, 
// then swap to another video with different colorization of map
// 'oops' background with poetry text - persistant
// aliases for yt iframe API
//
var onYouTubeIframeAPIReady;
var onPlayerReady;
var onPlayerStateChange;
var onPlayerError;

var div = {
    $overlay: $('#overlay'),
    $map: $("#map-canvas"),
    $map_U_markers: $("#map-canvas").add("#markers-a").add("#markers-b")
};

var filter_admin; 
// for some reason, firefox is not playing nice with svg filters in external
// files, so I guess I'm just going to dynamically inline it then
$.get("static/map_assets/map_filters.xml", function(data) {
    var cont = document.createElement("svg_filters");
    cont.style.position = "fixed";
    cont.style.bottom = 0;
    cont.style.zIndex = -99999999;
    document.body.appendChild(cont);
    cont.innerHTML = new XMLSerializer().serializeToString(data);   
    
    filter_admin = (function(filter_admin) {
        var cat = {
            GENERAL:        0x40000000, // filter can be called on an /idle_interval setInterval
            ZOOMED:         0x20000000, // filter can be called when zoom level >= 17
            TAKEOVER_DOWN:  0x10000000, // if filter called on zoom >= 17 event, persists when zoom < 17
            TAKEOVER_UP:    0x08000000, // if filter already called, zoom >= 17 event has no effect
            START:          0x04000000, // filter can be called on load
            NONE:           0x00000000
        };      
        filter_admin.current = null; // filter_admin.applyFilter sets this property
        filter_admin.render = (function(render) {
            var stk = [];
            var id;
            render.rendering = false;
            render.push = function(funct) {
                stk.push(funct);
            };
            render.rm = function(funct) {
                var idx = stk.indexOf(funct);
                if (idx !== -1) stk.splice(idx, 1);
            };
            render.go = function() {
                render.rendering = true;
                id = window.requestAnimationFrame(render.go);
                for (var i = 0; i < stk.length; i++) {
                    stk[i]();
                }
            };
            render.has = function() {
                return (stk.length > 0) ? true : false;
            }
            render.stop = function() {
                render.rendering = false;
                cancelAnimationFrame(id);
            }
            return render;
        }({}))
        var webglSuccess = false;
        filter_admin.webglSetup = function(canvas, shader_path, DEBUG) {
            var r = {};
            var getShaderLog = function(gl_shader_obj) {
                if ( !gl.getShaderParameter(gl_shader_obj, gl.COMPILE_STATUS) ) 
                    console.log( gl.getShaderInfoLog(gl_shader_obj) );
            };
            var gl = (function() {
                try {
                    return canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
                } catch (err) {
                    throw "WebGL is good to have? I like to fart";
                    return false;
                }
            }())
            if (gl) {
                webglSuccess = true;
                gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
                gl.clearColor(0.0, 0.0, 0.0, 0.0);
                window.addEventListener("resize", function() {
                    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
                });
                // get shader src, do typical initialization
                $.get(shader_path, function(data) {
                    var matches = data.match(/\n(\d|[a-zA-Z])(\s|.)*?(?=END|^@@.*?$)/gm);
                    var vert_src = matches[0];
                    var frag_src = matches[1];
                    var vert_shader = gl.createShader(gl.VERTEX_SHADER);
                    var frag_shader = gl.createShader(gl.FRAGMENT_SHADER);
                    gl.shaderSource(vert_shader, vert_src);
                    gl.shaderSource(frag_shader, frag_src); 
                    gl.compileShader(vert_shader);
if (DEBUG) getShaderLog(vert_shader);
                    gl.compileShader(frag_shader);
if (DEBUG) getShaderLog(frag_shader);
                    var prgm = gl.createProgram();
                    gl.attachShader(prgm, vert_shader);
                    gl.attachShader(prgm, frag_shader);
                    gl.linkProgram(prgm);
                    gl.useProgram(prgm);
                    r.program = prgm;

                    //draw two big triangles
                    var buffer = gl.createBuffer();
                    var pos_loc = gl.getAttribLocation(prgm, 'position');
                    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
                    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
                        -1.0, -1.0,
                         1.0, -1.0,
                        -1.0,  1.0,
                        -1.0,  1.0,
                         1.0, -1.0,
                         1.0,  1.0]), gl.STATIC_DRAW);
                    gl.enableVertexAttribArray(pos_loc); 
                    gl.vertexAttribPointer(pos_loc, 2, gl.FLOAT, false, 0, 0);
                    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // try deleting depth buffer clear
                });
                r.gl = gl;
                return r;
            }
        };
        filter_admin.attrs = {};
        filter_admin.attrs.troller = (function(troller) {
            troller.categories = cat.GENERAL | cat.ZOOMED;
            var troller_back = document.createElement('div');
            troller_back.setAttribute("id", "troller_back");
            var rot = 0;
            var ident = "rotate(0deg)";
            var transform = function(val) {
                div.$map.css("transform", val);
                div.$map.css("webkitTransform", val);
            };
            var to_id;
            var getCurrentRotation = function() {
                // basically ripped from: http://css-tricks.com/get-value-of-css-rotation-through-javascript/
                var sty = window.getComputedStyle(div.$map.get(0));
                var mat = sty.getPropertyValue("-webkit-transform") || sty.getPropertyValue("transform") 
                    || "matrix(1, 0, 0, 1, 0, 0)"; //getPropertyValue() fails sometimes, so pass identity matrix if it does
                var values = mat.split('(')[1];
                values = values.split(')')[0];
                values = values.split(',');
                var a = Number(values[0]);
                var b = Number(values[1]);
                return Math.round(Math.asin(b) * (180/Math.PI));
            };
            troller.preInit = function() {
                var str = "rotate("+rot.toString()+"deg)";
                transform(str); 
                // calling getCurrentRotation here resolves a timing issue where 
                // the rotate in troller.init was obliterating the preInit rotate
                getCurrentRotation();
            };
            troller.init = function() {
                document.body.appendChild(troller_back);
                var str = "rotate(360deg)";
                transform(str);
                to_id = window.setTimeout(coord.forceApply, 5000); 
            };
            troller.preTeardown = function() {
                rot += getCurrentRotation();
            };
            troller.teardown = function() {
                transform(ident);   
                document.body.removeChild(troller_back);
                window.clearTimeout(to_id);
            };
            return troller;
        }({}));
        filter_admin.attrs.print_analog = {
            categories: cat.GENERAL | cat.ZOOMED | cat.TAKEOVER_DOWN | cat.START,
            denoise: document.getElementById("pa-denoise"),
            bypass: document.getElementById("pa-bypass")
        };
        filter_admin.attrs.caustic_glow = (function(caustic_glow) {
            caustic_glow.categories = cat.GENERAL | cat.TAKEOVER_DOWN | cat.TAKEOVER_UP | cat.ZOOMED | cat.START;
            caustic_glow.glow_radius = document.getElementById("cg-glow-radius");
            
            var caustic_glow_back = document.createElement("div");
            caustic_glow_back.setAttribute("id", "caustic_glow_back");  
            
            var yt_player = document.createElement("div");
            yt_player.setAttribute("id", "yt_player");
            caustic_glow_back.appendChild(yt_player);
            
            var yt_tag = document.createElement("script");
            yt_tag.src = "https://www.youtube.com/iframe_api";
            caustic_glow_back.appendChild(yt_tag);
            
            document.body.appendChild(caustic_glow_back);
            
            var player;
            var yt_vid_id = 'Y2YkudgEDNk';
            var start_offset = 22;
            onYouTubeIframeAPIReady = function() {
                player = new YT.Player('yt_player', {
                    playerVars: {
                        controls: 0,
                        disablekb: 1,
                        loop: 1,
                        modestbranding: 0,
                        rel: 0
                    },
                    events: {
                        onReady: onPlayerReady,
                        onStateChange: onPlayerStateChange,
                        onError: onPlayerError
                    }           
                });
            };
            onPlayerReady = function(event) {
                player.mute();
                player.loadVideoById(yt_vid_id, start_offset);
                player.pauseVideo();
            };
            onPlayerStateChange = function(event) {
                if (event.data === YT.PlayerState.ENDED) {
                    player.loadVideoById(yt_vid_id, start_offset);
                    //coord.rm("caustic_glow"); 
                }
            };
            onPlayerError = function(event) {
                document.body.removeChild(caustic_glow_back);
            };
            var blink_id = null;
            var blink_map = function() {
                var del = Math.random() * 20000 + 10000;
                var dur = Math.random() * 2000 + 1000;
                blink_id = window.setTimeout(function() {
                    div.$map_U_markers.css("display", "none");
                    window.setTimeout(function() {
                        div.$map_U_markers.css("display", "block");
                    }, dur);
                }, del);
            };  
            caustic_glow.init = function() {
                try {
                    player.playVideo();
                } catch (err) {
                    window.setTimeout(function() {
                        caustic_glow.init();
                    }, 500);
                }
                caustic_glow_back.style.visibility = "visible";
                if ( (Math.random() * 10) <= 5 ) blink_map(); 
            };
            caustic_glow.teardown = function() {
                player.pauseVideo();
                caustic_glow_back.style.visibility = "hidden";
                if (blink_id) window.clearTimeout(blink_id);
                blink_id = null;    
            };
            return caustic_glow;
        }({}));
        filter_admin.attrs.cmgyk = (function(cmgyk) {
            cmgyk.categories = cat.GENERAL | cat.ZOOMED;
            cmgyk.denoise = document.getElementById("cmgyk-denoise");
            var cmgyk_back = document.createElement("div");
            cmgyk_back.setAttribute("id", "cmgyk_back");
            var cmgyk_grad = document.createElement("div");
            cmgyk_grad.setAttribute("id", "cmgyk_grad");
            cmgyk_back.appendChild(cmgyk_grad); 
            var cmgyk_steady_back = document.createElement("div");
            cmgyk_steady_back.setAttribute("id", "cmgyk_steady_back");
            var engaged = false;
            var times_engaged = 0;
            var should_ko = function() {
                if (times_engaged > 2) return true;
                return false;
            };
            var should_blink = function() {
                if (times_engaged > 3) {
                    //coord.pushCategory("cmgyk", cat.TAKEOVER_DOWN);   
                    return true;
                }
                return false;
            };
            cmgyk.init = function() {
                engaged = true;
                times_engaged++;
                document.body.appendChild(cmgyk_steady_back);
                document.body.appendChild(cmgyk_back);
            };
            cmgyk.teardown = function() {
                engaged = false;
                document.body.removeChild(cmgyk_steady_back);
                document.body.removeChild(cmgyk_back);
                $kos.css("display", "block");
            };
            var gaussDist = function() {
                // snippet from http://memory.psych.mun.ca/tech/snippets/random_normal/
                var x1, x2, rad;
                do {
                    x1 = 2 * Math.random() - 1;
                    x2 = 2 * Math.random() - 1;
                    rad = x1 * x1 + x2 * x2;
                } while (rad >= 1 || rad == 0);
                var c = Math.sqrt(-2 * Math.log(rad) / rad); 
                return x1 * c;
            };
            var $kos = $();
            var blink$ = []; //array with items of form [$, blink_speed in ms]  
            cmgyk.onMovement = function() {
                if ( engaged && should_ko() ) {
                    var $map_imgs = $("#map-canvas :nth-child(1) :nth-child(1) :nth-child(1) "+
                                  ":nth-child(5) :nth-child(1)").children();
                    $kos = $();     
                    var s_idx, e_idx;
                    (function() {
                        var mdn = ($map_imgs.length * 0.5 + 0.5) | 0;
                        var idxGen = function() {
                            return (gaussDist() * 2 + mdn + 0.5) | 0;
                        };
                        var x = idxGen();
                        var y = idxGen();
                        if (x > y) {
                            s_idx = x;
                            e_idx = y;
                        } else {
                            s_idx = y;
                            e_idx = x;
                        }
                        s_idx--;
                        e_idx++;
                    }())
                    var b_mod = (function() {
                        var range = [5, 6, 7, 8, 9, 10, 11];
                        var rtn = [];
                        var num = (Math.random() * 4 + 0.5) | 0
                        for (var i = 0; i < num; i++) {
                            rtn.push(range[ (Math.random() * range.length - 1 + 0.5) | 0 ]);
                        }
                        return rtn;
                    }())
                    for (var i = s_idx; i <= e_idx; i++) {
                        var $img = $map_imgs.eq(i);
                        $kos = $kos.add($img);
                        if ( should_blink() ) {
                            for (var j = 0; j < b_mod.length; j++) {
                                if ( (i % b_mod[j]) === 0 ) blink$[j] = [$img, (Math.random() * 3000) | 0];
                            }   
                        }
                    }
                    $kos.css("display", "none");
                }
            };
            
            //TODO: cmgyk webgl starscape?           

            cmgyk.animate = function() {
                if ( should_blink() ) {
                    var time = new Date().getTime();
                    for (var i = 0; i < blink$.length; i++) {
                        if ( blink$[i] && ( ((time % blink$[i][1]) <= 16) || ((Math.random() * 10 ) < 0.5 )) )  {
                            if (blink$[i][0].css("display") === "none") {
                                blink$[i][0].css("display", "block");
                            } else {
                                blink$[i][0].css("display", "none");
                            }
                        }
                    }
                }
            };
            var rot_interval = 22.5;
            var rot = 0;
            var lzoom = 0;
            cmgyk.onLoad = function(map_obj) {
                lzoom = map_obj.zoom;
            }
            cmgyk.onZoom = function(map_obj) {
                var zoom = map_obj.zoom;
                rot = rot + ( (zoom - lzoom) * rot_interval );
                var str = "rotate("+rot.toString()+"deg)";
                cmgyk_back.style.transform = str; 
                cmgyk_back.style.webkitTransform = str;
                lzoom = zoom;           
            };
            return cmgyk;
        }({}))
                
        filter_admin.attrs.fauvist = {
            categories: cat.ZOOMED
        };
        
        filter_admin.attrs.vhs = (function(vhs) {
            vhs.categories = cat.GENERAL | cat.ZOOMED | cat.START;
            vhs.offset = document.getElementById("vhs-offset");
            var vhs_back = document.createElement('div');   
            vhs_back.setAttribute("id", "vhs_back");
            vhs.init = function() {
                document.body.appendChild(vhs_back);
                vhs.webgl.init();
            }
            vhs.teardown = function() {
                document.body.removeChild(vhs_back);
                vhs.webgl.teardown();
            }
            var jit;
            var jit_offset = 3;
            var jit_delay = 150;
            var jit_frame_div = 2;
            var frct = 0;
            var os = 0;
            vhs.animate = function() {
                if ( jit && ( (frct % jit_frame_div) === 0 ) ) {
                    vhs.offset.setAttribute("dy", os); 
                    os = (os === jit_offset) ? 0 : jit_offset;
                }
                frct++;
                vhs.webgl.update();
            };
            var jit_tmp;
            vhs.jitter = function(idle) {
                jit_tmp = idle;
                if (!jit_tmp) vhs.offset.setAttribute("dy", 0);
                window.setTimeout(function() {
                    jit = jit_tmp;
                }, jit_delay);
            };
            vhs.webgl = (function(webgl) {
                var vhs_canv = document.createElement('canvas');
                vhs_canv.width = window.innerWidth * 0.75;
                vhs_canv.height = window.innerHeight * 0.75;
                vhs_canv.setAttribute("id", "vhs_canv");
                window.addEventListener('resize', function(e) {
                    vhs_canv.width = window.innerWidth * 0.75;
                    vhs_canv.height = window.innerHeight * 0.75;
                });
                var z = filter_admin.webglSetup(vhs_canv, "/static/map_assets/white_noise.glsl");
                var start_time = Date.now();    
                var time;
                var js_random;
                var idle;
                webgl.update = function() {
                    z.gl.clear(z.gl.COLOR_BUFFER_BIT | z.gl.DEPTH_BUFFER_BIT);
                    time = z.gl.getUniformLocation(z.program, "time");
                    z.gl.uniform1f(time, Date.now() - start_time);
                    js_random = z.gl.getUniformLocation(z.program, "js_random");
                    z.gl.uniform1f(js_random, Math.random());
                    idle = z.gl.getUniformLocation(z.program, "idle");
                    z.gl.uniform1i(idle, jit ? 1 : 0);
                    z.gl.drawArrays(z.gl.TRIANGLES, 0, 6);
                };
                webgl.init = function() {
                    document.body.appendChild(vhs_canv);
                }
                webgl.teardown = function() {
                    document.body.removeChild(vhs_canv);
                }
                return webgl;
            }({}))
            return vhs;
        }({}))
        
        /*
         * alpha_strut is a special filter event that runs simultaneously with the .attrs filters
         */
        filter_admin.alpha_strut = (function(alpha_strut) {
                // occasionally cover map with flashing screen  
                // instead of opaque being black, sky gif
                // sky with flashing?
                // virgo logo gif 
                // limit backgrounds to only the most colorful (and resource cheap) filters:
                //  caustic glow (the yt vid only), cmgyk, a flashing thing, 
            var vid = document.createElement('video');
            vid.style.display = "none";
            //vid.setAttribute('id', 'dummy'); // just display: none here
            vid.preload = "auto";
            vid.crossOrigin = 'anonymous';
            $.get('/vimeo_data', function(url) {
                vid.src = url;
            });
            document.body.appendChild(vid);

            var alpha_strut_front = document.createElement("canvas");
            alpha_strut_front.setAttribute("id", "alpha_strut_front");
                
            alpha_strut.webgl = (function(webgl) {
                var z = filter_admin.webglSetup(alpha_strut_front, "/static/map_assets/alpha_strut.glsl", true); 
                var vid_tex;
                var texCoordBuffer;
                var texCoordAttr;
                var threshold = 50;
                vid.addEventListener("canplaythrough", function() {
                    
                    //TODO: fix cross-origin in Firefox (prob via proxy stream) 
                    vid_tex = z.gl.createTexture();
                    z.gl.bindTexture(z.gl.TEXTURE_2D, vid_tex);
                    z.gl.texParameteri(z.gl.TEXTURE_2D, z.gl.TEXTURE_WRAP_S, z.gl.CLAMP_TO_EDGE);
                    z.gl.texParameteri(z.gl.TEXTURE_2D, z.gl.TEXTURE_WRAP_T, z.gl.CLAMP_TO_EDGE);
                    z.gl.texParameteri(z.gl.TEXTURE_2D, z.gl.TEXTURE_MIN_FILTER, z.gl.NEAREST);
                    z.gl.texParameteri(z.gl.TEXTURE_2D, z.gl.TEXTURE_MAG_FILTER, z.gl.NEAREST);
                   
                    texCoordBuffer = z.gl.createBuffer();
                    texCoordAttr = z.gl.getAttribLocation(z.program, 'texCoord');
                    z.gl.bindBuffer(z.gl.ARRAY_BUFFER, texCoordBuffer);
                    z.gl.bufferData(z.gl.ARRAY_BUFFER, new Float32Array([
                         0.0,  0.0,
                         1.0,  0.0,
                         0.0,  1.0,
                         0.0,  1.0,
                         1.0,  0.0,
                         1.0,  1.0        
                        ]), z.gl.STATIC_DRAW); 
                    z.gl.enableVertexAttribArray(texCoordAttr);
                    z.gl.vertexAttribPointer(texCoordAttr, 2, z.gl.FLOAT, false, 0, 0);
                }, true);
                webgl.update = function() {
                    z.gl.clear(z.gl.COLOR_BUFFER_BIT | z.gl.DEPTH_BUFFER_BIT);
                    
                    z.gl.uniform1f( z.gl.getUniformLocation(z.program, "threshold"), threshold );
                    
                    texCoordAttr = z.gl.getAttribLocation(z.program, "texCoord");
                    z.gl.enableVertexAttribArray(texCoordAttr);
                    
                    z.gl.bindTexture(z.gl.TEXTURE_2D, vid_tex);
                    z.gl.texImage2D(z.gl.TEXTURE_2D, 0, z.gl.RGBA, z.gl.RGBA, z.gl.UNSIGNED_BYTE, vid);
                    
                    z.gl.activeTexture(z.gl.TEXTURE0);
                    z.gl.bindTexture(z.gl.TEXTURE_2D, vid_tex);
                    z.gl.pixelStorei(z.gl.UNPACK_FLIP_Y_WEBGL, true);
                    z.gl.uniform1i( z.gl.getUniformLocation(z.program, "vidTexels"), 0 );
                    
                    z.gl.drawArrays(z.gl.TRIANGLES, 0, 6);
                };
                return webgl; 
            }({}));
            alpha_strut.init = function() {
                document.body.appendChild(alpha_strut_front);
                vid.play();
            };
            alpha_strut.teardown = function() {
                document.body.removeChild(alpha_strut_front);
                vid.pause();
            };
            alpha_strut.animate = function() {
                alpha_strut.webgl.update();
            };
            window.setTimeout(function() {
                alpha_strut.init();
                if (!filter_admin.render_rendering) filter_admin.render.push(alpha_strut.animate);
                filter_admin.render.go();
            }, 10000); 
            return alpha_strut;
        }({}))
        var coord = (function(coord) {
            var sets = {
                general: [],
                zoomed: [],
                takeover_down: [],
                takeover_up: [],
                start: [],
                webgl: []
            };  
            for (var filter in filter_admin.attrs) {
                if ( filter_admin.attrs.hasOwnProperty(filter) ) {
                    var cats = filter_admin.attrs[filter].categories;
                    if ( (cats & cat.GENERAL) === cat.GENERAL ) sets.general.push(filter);
                    if ( (cats & cat.ZOOMED) === cat.ZOOMED ) sets.zoomed.push(filter);                 
                    if ( (cats & cat.TAKEOVER_DOWN) === cat.TAKEOVER_DOWN ) sets.takeover_down.push(filter);
                    if ( (cats & cat.TAKEOVER_UP) === cat.TAKEOVER_UP ) sets.takeover_up.push(filter);
                    if ( (cats & cat.START) === cat.START ) sets.start.push(filter);
                    if ( filter_admin.attrs[filter].hasOwnProperty("webgl") ) sets.webgl.push(filter);
                }
            }
            coord.pushCategory = function(filter, cat_obj) {
                switch(cat_obj) {
                    case cat.GENERAL:
                        sets.general.push(filter);
                        break;
                    case cat.ZOOMED:
                        sets.zoomed.push(filter);
                        break;
                    case cat.TAKEOVER_DOWN:
                        sets.takeover_down.push(filter);
                        break;
                    case cat.TAKEOVER_UP:
                        sets.takeover_up.push(filter);
                        break;
                    case cat.START:
                        sets.start.push(filter);
                        break;
                }
            };
            coord.rm = function(filter) {
                for (var cat in sets) {
                    if ( sets.hasOwnProperty(cat) && (cat !== "webgl") ) {
                        var idx = sets[cat].indexOf(filter);
                        if (idx > -1) sets[cat].splice(idx, 1);
                    }
                }
            };
            
            // if webgl init fails, disable filters dependent on it.
            if (!webglSuccess) sets.webgl.forEach(coord.rm); 

            // TODO: consider displaying message to encourage WebGl use
            var was_in_close = false;
            var new_filter;
            var old_filter;
            coord.applyFilter = function(filter, add_only) {
                filter_admin.current = filter;
                var render = filter_admin.render;
                if (new_filter) {
                    var this_filter = filter_admin.attrs[new_filter];
                    if ( this_filter.hasOwnProperty('preTeardown') ) this_filter.preTeardown();
                    div.$map.removeClass(new_filter);
                    if ( this_filter.hasOwnProperty('animate') ) render.rm(this_filter.animate);
                    if ( this_filter.hasOwnProperty('teardown') ) this_filter.teardown();
                    if ( !render.has() ) render.stop();
                }
                var this_filter = filter_admin.attrs[filter]; 
                if ( this_filter.hasOwnProperty('preInit') ) this_filter.preInit();
                div.$map.addClass(filter);
                if (typeof this_filter !== "undefined") {   
                    if ( this_filter.hasOwnProperty('init') ) this_filter.init();
                    if ( this_filter.hasOwnProperty('animate') ) render.push(this_filter.animate);
                    if ( render.has() ) render.go();
                }
                old_filter = new_filter;
                new_filter = filter;
                if ( sets.takeover_down.indexOf(filter) !== -1 ) old_filter = filter;   
            };
            var applyRndFilter = function(arr) {
                var rndIdxInArr = function(arr) {
                    return (Math.random() * arr.length - 0.5) | 0;
                }
                var nf = arr[ rndIdxInArr(arr) ];
                (function check_dup() {
                    if (nf === new_filter) {
                        nf = arr[ rndIdxInArr(arr) ];
                        check_dup();
                    }
                }())
                coord.applyFilter(nf);
            };
            coord.forceApply = function() {
                applyRndFilter(sets.general);
            };
            var close_thresh = 17;
            coord.onZoom = function(map_obj) {
                if ( was_in_close && (map_obj.zoom <= close_thresh) ) {
                    coord.applyFilter(old_filter);
                    was_in_close = false;
                } else if ( !was_in_close && (map_obj.zoom > close_thresh) && (sets.takeover_up.indexOf(new_filter) === -1) ) {
                    applyRndFilter(sets.zoomed);
                    was_in_close = true;
                }       
            };

            //TODO: consider enforcing maximum pause - 4 min or something
            var main_time = (function(main_time) {
                var interval = 30000;
                var start;
                var cease = 0;
                var elapsed;
                var id;
                var first = true;
                var update = function() {
                    start = Date.now();
                    if (first) {
                        applyRndFilter(sets.start);
                        first = false;
                    } else {
                        applyRndFilter(sets.general);
                    }
                };
                main_time.setInterval = function(n) {
                    main_time.cease();
                    interval = n;
                    main_time.engage();
                };
                main_time.engage = function() {
                    if ( (Date.now() - cease) > interval ) {
                        update();
                        id = window.setInterval(update, interval);
                    } else {
                        id = window.setTimeout(function() {
                            update();
                            id = window.setInterval(update, interval);
                        }, elapsed);
                    }
                };
                main_time.cease = function() {
                    cease = Date.now();
                    elapsed = cease - start;
                    window.clearInterval(id);
                    window.clearTimeout(id);
                };
                main_time.engage();
                return main_time;
            }({}))
            
            // onMarkerClick is called in index.html where markers are defined
            // we use the marker_clicked flag to weed out cases where clicking on a marker
            // also triggers the map click event
            var marker_clicked = false;
            filter_admin.onMarkerClick = function() {
                marker_clicked = true;
                window.setTimeout(function() {
                    marker_clicked = false;
                }, 100);
                if ( div.$overlay.is(":hidden") ) main_time.cease();
            };
            coord.onMapClick = function() {
                if ( !div.$overlay.is(":hidden") ) {
                    window.setTimeout(function() {
                        if (!marker_clicked) main_time.engage();
                    }, 50);
                }
            };  
            return coord;
        }({}))
        
        // provided a google.map object, adds listeners for whatever in filter_admin needs it
        filter_admin.eventHandler = function(map_obj) {
            google.maps.event.addListener(map_obj, 'zoom_changed', function() { 
                filter_admin.attrs.cmgyk.onZoom(map_obj); 
                filter_admin.attrs.vhs.jitter(false);
                coord.onZoom(map_obj);
            });
            google.maps.event.addListener(map_obj, 'drag', function() { 
                filter_admin.attrs.vhs.jitter(false);       
            });
            google.maps.event.addListener(map_obj, 'idle', function() {
                filter_admin.attrs.vhs.jitter(true);
            });
            google.maps.event.addListener(map_obj, 'bounds_changed', function() {
                filter_admin.attrs.cmgyk.onMovement();
            });
            google.maps.event.addListener(map_obj, 'click', function() {
                coord.onMapClick();
            });
            google.maps.event.addListenerOnce(map_obj, 'tilesloaded', function() {
                filter_admin.attrs.cmgyk.onLoad(map_obj);       
            });
        };
        return filter_admin;
    }({}))  
    
    // media queries for filters
    var dppx1dot2 =  window.matchMedia("only screen and (min-resolution: 1.0dppx),"+
                       "only screen and (-webkit-min-device-pixel-ratio: 1.0)");
    if (dppx1dot2.matches) {
        filter_admin.attrs.print_analog.denoise.setAttribute("stdDeviation", "1.16");
        filter_admin.attrs.print_analog.bypass.setAttribute("in2", "flip");
        filter_admin.attrs.caustic_glow.glow_radius.setAttribute("stdDeviation", "10.6");
        filter_admin.attrs.cmgyk.denoise.setAttribute("stdDeviation", "1");
    }
});

