wctank = wctank || {};
wctank.mapFilters = wctank.mapFilters || {};

wctank.mapFilters.defs = (function(defs) {
    var util = wctank.util;
    var div = wctank.div;
    var gMap = wctank.gMap;
    var core = wctank.core;
    var mapFilters = wctank.mapFilters;

    defs.Troller = function Troller() {
        var u = mapFilters.usageFlags;
        this.usage = u.GENERAL | u.ZOOMED;
        this.css_class = 'troller'; 

        var troller_back = document.createElement('video');
        troller_back.src = "https://archive.org/download/C.E.PriceSunClouds/SunClouds_512kb.mp4";
        troller_back.setAttribute("id", "troller_back");
         
        var rot = 0;
        var ident = "rotate(0deg)";
        var transform = function(val) {
            div.$map.css("transform", val);
            div.$map.css("webkitTransform", val);
        };
        var to_id;
        var getCurrentRotation = function() {
            // basically ripped from: http://css-tricks.com/get-
            // value-of-css-rotation-through-javascript/
            var sty = window.getComputedStyle(div.$map.get(0));
            var mat = sty.getPropertyValue("-webkit-transform") || 
                      sty.getPropertyValue("transform") || "matrix(1, 0, 0, 1, 0, 0)";
            var values = mat.split('(')[1];
            values = values.split(')')[0];
            values = values.split(',');
            var a = Number(values[0]);
            var b = Number(values[1]);
            return Math.round(Math.asin(b) * (180/Math.PI));
        };
        this.preInit = function() {
            var str = "rotate("+rot.toString()+"deg)";
            transform(str); 
            // calling getCurrentRotation here resolves a timing issue where 
            // the rotate in troller.init was obliterating the preInit rotate
            getCurrentRotation();
        };
         
        //TODO: Figure out why troller needs to be applied twice; 
        //some weird interaction with the rotate transform?
        var cntr = 0;
        var set$mapCss = function(clear_set) {
            var w = window.innerWidth;
            var h = window.innerHeight;
            var px = function(n) {
                return n+'px';
            };
            var side = px(h * 0.5); 
            var makeCss = function(w, h, t, l, b) {
                return {
                    'width': w,
                    'height': h,
                    'top': t,
                    'left': l,
                    'border': b
                };
            };
            var obj = (function() {
                if (!clear_set) {
                    return makeCss(side, side, '25%', px((w * 0.5) - (h * 0.25)), '3px solid');
                } else if (clear_set) {
                    return makeCss('100%', '100%', '0', '0', '0');
                }
            }());
            div.$map.css(obj);
        };
        var $mapOnResize = function() {
            set$mapCss(false);
        };
        
        var parent = this;
        this.init = function() {
            window.addEventListener('resize', $mapOnResize);
            set$mapCss(false);
            gMap.zoomControlsVisible(false);
            wctank.markers.setVisibility(false);
            document.body.appendChild(troller_back);
            troller_back.play();
            transform("rotate(360deg)");
            if (cntr === 0) {
                to_id = window.setTimeout(core.defs.forceApply, util.smudgeNumber(7000, 5));
                window.setTimeout(function() { 
                    core.filterTypeOp('teardown', parent);
                    core.filterTypeOp('init', parent, function() {
                        div.$map.addClass(parent.css_class);
                    });
                }, 50);
            }
            cntr++;
        };
        this.preTeardown = function() {
            rot += getCurrentRotation();
        };
        this.teardown = function() {
            if (cntr === 2) {
                window.removeEventListener('resize', $mapOnResize);
                set$mapCss(true);
                gMap.zoomControlsVisible(true);
                wctank.markers.setVisibility(true);
                troller_back.pause();
                troller_back.currentTime = 0;
                transform(ident);
                document.body.removeChild(troller_back);
                window.clearTimeout(to_id);
                cntr = 0;
            }
        };
    };
    defs.Troller.prototype = new mapFilters.FilterType(); 
    
    defs.Print_Analog = function Print_Analog() {
        this.usage = mapFilters.usageFlags.GENERAL |
                     mapFilters.usageFlags.ZOOMED | 
                     mapFilters.usageFlags.TAKEOVER_DOWN | 
                     mapFilters.usageFlags.START;
        this.css_class = 'print_analog';
        this.denoise = document.getElementById("pa-denoise");
        this.bypass = document.getElementById("pa-bypass");
    };
    defs.Troller.prototype = new mapFilters.FilterType();
    
    defs.Caustic_Glow = function Caustic_Glow() {
        var u = mapFilters.usageFlags;
        this.usage = u.GENERAL | u.TAKEOVER_DOWN | u.TAKEOVER_UP | 
                             u.ZOOMED | u.START;
        this.css_class = 'caustic_glow';
        this.glow_radius = document.getElementById("cg-glow-radius");
        
        var caustic_glow_back = document.createElement("div");
        caustic_glow_back.setAttribute("id", "caustic_glow_back");  
        
        var vid_id = "107871876";
        var vimeo_player = document.createElement("iframe");
        vimeo_player.setAttribute("id", "vimeo_player");
        vimeo_player.src = 
            "//player.vimeo.com/video/"+vid_id+
            "?api=1&player_id=vimeo_player&autopause=0&loop=1";
        caustic_glow_back.appendChild(vimeo_player);
        
        document.body.appendChild(caustic_glow_back);
         
        var player = $f( $('#vimeo_player')[0] );
        var player_ready = false;
        player.addEvent('ready', function() {
            player_ready = true;
            player.api("setVolume", 0);
            player.api("pause");
        });
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
        
        // sigh...
        var parent = this;
        this.init = function() {
            if (player_ready) {
                player.api("play");
            } else {
                window.setTimeout(function() {
                    parent.init();
                }, 250);
            }
            caustic_glow_back.style.visibility = "visible";
            if ( (Math.random() * 10) <= 5 ) blink_map(); 
        };
        this.teardown = function() {
            player.api("pause");
            caustic_glow_back.style.visibility = "hidden";
            if (blink_id) window.clearTimeout(blink_id);
            blink_id = null;    
        };
    };
    defs.Caustic_Glow.prototype = new mapFilters.FilterType(); 
    
    defs.Cmgyk = function Cmgyk() {
        var u = mapFilters.usageFlags;
        this.usage = u.GENERAL | u.ZOOMED | u.START;
        this.css_class = 'cmgyk';

        this.denoise = document.getElementById("cmgyk-denoise"); 

        var cmgyk_back = document.createElement("div");
        cmgyk_back.setAttribute("id", "cmgyk_back");
        
        var cmgyk_grad = document.createElement("div");
        cmgyk_grad.setAttribute("id", "cmgyk_grad");
        cmgyk_back.appendChild(cmgyk_grad); 
        
        var cmgyk_steady_back = document.createElement("div");
        cmgyk_steady_back.setAttribute("id", "cmgyk_steady_back");
        
        var engaged = false;
        var times_engaged = 0;
        var ko_num = 2;
        var blink_num = 3;
        var should_ko = function() {
            if (times_engaged > ko_num) return true;
            return false;
        };
        var should_blink = function() {
            if (times_engaged > blink_num) {
                //coord.pushCategory("cmgyk", cat.TAKEOVER_DOWN);   
                return true;
            }
            return false;
        };
        this.setImmediateBlink = function() {
            ko_num = 0 ;
            blink_num = 0;
        };
        var $kos = $();
        this.init = function() {
            engaged = true;
            times_engaged++;
            document.body.appendChild(cmgyk_steady_back);
            document.body.appendChild(cmgyk_back);
            $kos = $();
        };
        this.teardown = function() {
            engaged = false;
            document.body.removeChild(cmgyk_steady_back);
            document.body.removeChild(cmgyk_back);
            $kos.css("display", "block");
        };
        
        // snippet from http://memory.psych.mun.ca/tech/snippets/random_normal/
        var gaussDist = function() {
            var x1, x2, rad;
            do {
                x1 = 2 * Math.random() - 1;
                x2 = 2 * Math.random() - 1;
                rad = x1 * x1 + x2 * x2;
            } while (rad >= 1 || rad == 0);
            var c = Math.sqrt(-2 * Math.log(rad) / rad); 
            return x1 * c;
        };

        var blink$ = []; //array with items of form [$, blink_speed in ms]  
        var koAndBlink = function() {
            if ( engaged && should_ko() ) {
                var $map_imgs = $(div.selectors.$_map_imgs); 
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
                    var r = [];
                    var num = (Math.random() * 4 + 0.5) | 0
                    for (var i = 0; i < num; i++) {
                        r.push(range[ (Math.random() * range.length - 1 + 0.5) | 0 ]);
                    }
                    return r;
                }())
                for (var i = s_idx; i <= e_idx; i++) {
                    var $img = $map_imgs.eq(i);
                    $kos = $kos.add($img);
                    if ( should_blink() ) {
                        for (var j = 0; j < b_mod.length; j++) {
                            if ( (i % b_mod[j]) === 0 ) 
                                blink$[j] = [$img, (Math.random() * 3000) | 0];
                        }   
                    }
                }
                $kos.css("display", "none");
            }
        };
        gMap.events.push(gMap.events.MAP, 'tilesloaded', koAndBlink);
        gMap.events.push(gMap.events.MAP, 'bounds_changed', koAndBlink);
       
        //TODO: cmgyk webgl starscape?           
        this.animate = function() {
            if ( should_blink() ) {
                var time = new Date().getTime();
                for (var i = 0; i < blink$.length; i++) {
                    if ( blink$[i] && ( ((time % blink$[i][1]) <= 16) || 
                                        ((Math.random() * 10 ) < 0.5 )) )  {
                        if (blink$[i][0].css("display") === "none") {
                            blink$[i][0].css("display", "block");
                        } else {
                            blink$[i][0].css("display", "none");
                        }
                    }
                }
            }
        };
        
        // events
        var rot_interval = 22.5;
        var rot = 0;
        var lzoom = 0;
        var onTilesLoaded = function(map_obj) {
            lzoom = map_obj.zoom;
        };
        gMap.events.push(gMap.events.MAP, 'tilesloaded', onTilesLoaded, true); 
        
        var onZoom = function(map_obj) {
            var zoom = map_obj.zoom;
            rot = rot + ( (zoom - lzoom) * rot_interval );
            var str = "rotate("+rot.toString()+"deg)";
            cmgyk_back.style.transform = str; 
            cmgyk_back.style.webkitTransform = str;
            lzoom = zoom;           
        };
        gMap.events.push(gMap.events.MAP, 'zoom_changed', onZoom); 
    };
    defs.Cmgyk.prototype = new mapFilters.FilterType();

    defs.Fauvist = function Fauvist() {
        var u = mapFilters.usageFlags;
        this.usage = u.ZOOMED | u.START | u.GENERAL;
        this.css_class = 'fauvist';
    };
    defs.Fauvist.prototype = new mapFilters.FilterType();

    defs.Vhs = function Vhs() {
        var u = mapFilters.usageFlags;
        this.usage = u.GENERAL | u.ZOOMED | u.START;
        this.offset = document.getElementById("vhs-offset");
        this.css_class = 'vhs';

        var vhs_back = document.createElement('div');   
        vhs_back.setAttribute("id", "vhs_back");
        
        this.init = function() {
            document.body.appendChild(vhs_back);
            this.webgl.init();
        }
        this.teardown = function() {
            document.body.removeChild(vhs_back);
            this.webgl.teardown();
        }
       
        var parent = this; 
        var jit;
        var jit_offset = 3;
        var jit_delay = 150;
        var jit_frame_div = 2;
        var frct = 0;
        var os = 0;
        this.animate = function() {
            if ( jit && ( (frct % jit_frame_div) === 0 ) ) {
                parent.offset.setAttribute("dy", os); 
                os = (os === jit_offset) ? 0 : jit_offset;
            }
            frct++;
            parent.webgl.update();
        };
        var jit_tmp;
        var jitter = function(idle) {
            jit_tmp = idle;
            if (!jit_tmp) parent.offset.setAttribute("dy", 0);
            window.setTimeout(function() {
                jit = jit_tmp;
            }, jit_delay);
        };
        gMap.events.push(gMap.events.MAP, 'zoom_changed', function() {
            jitter(false);
        });
        gMap.events.push(gMap.events.MAP, 'drag', function() {
            jitter(false);
        });
        gMap.events.push(gMap.events.MAP, 'idle', function() {
            jitter(true);
        });

        this.webgl = (function(webgl) {
            var vhs_canv = document.createElement('canvas');
            vhs_canv.width = window.innerWidth * 0.75;
            vhs_canv.height = window.innerHeight * 0.75;
            vhs_canv.setAttribute("id", "vhs_canv");
            window.addEventListener('resize', function(e) {
                vhs_canv.width = window.innerWidth * 0.75;
                vhs_canv.height = window.innerHeight * 0.75;
            });
            var z = core.webgl.setup(vhs_canv, "/static/glsl/white_noise.glsl");
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
    };
    defs.Vhs.prototype = new mapFilters.FilterType();

    return defs;
}({}))
