define(
    [
        'util',
        'div',
        'gMap',
        'visualCore',
        'markerCore',
        'mutexVisualEffectsCore',
        'text!filterXML.xml',
        'text!VHSShaders.glsl',
        'jquery',
        'froogaloop2'
    ],

function(util, div, gMap, visualCore, markerCore, mutexVisualEffectsCore,
         filterXML, VHSShaders, $, $f) { var mutexVisualEffects = {};

    var cont = document.createElement("svg_filters");
    cont.style.position = "fixed";
    cont.style.bottom = 0;
    cont.style.zIndex = -99999999;
    document.body.appendChild(cont);
    cont.innerHTML = filterXML; 

    mutexVisualEffects.Troller = function() {
        Object.defineProperties(this, {
            'name': { value: "Troller" },
            'css_class': { value: "troller" }
        });

        var troller_back = document.createElement('video');
        troller_back.src = "https://archive.org/download/C.E.PriceSunClouds/SunClouds_512kb.mp4";
        troller_back.setAttribute("id", "troller-back");
    
        var parent = this,
            rot = 0,
            ident = "rotate(0deg)",
            to_id;

        var transform = function(val) {
            div.$map.css("transform", val);
            div.$map.css("webkitTransform", val);
        };

        var getCurrentRotation = function() {
            // basically ripped from: http://css-tricks.com/get-
            // value-of-css-rotation-through-javascript/
            var sty = window.getComputedStyle(div.$map.get(0)),
                mat = sty.getPropertyValue("-webkit-transform") || 
                      sty.getPropertyValue("transform") || "matrix(1, 0, 0, 1, 0, 0)",
                values = mat.split('(')[1];
            values = values.split(')')[0];
            values = values.split(',');
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
            var w = window.innerWidth,
                h = window.innerHeight;
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

        this.init = function() {
            window.addEventListener('resize', $mapOnResize);
            set$mapCss(false);
            gMap.zoomControlsVisible(false);
            markerCore.setVisibility(false);
            document.body.appendChild(troller_back);
            troller_back.play();
            transform("rotate(360deg)");
            if (cntr === 0) {
                window.setTimeout(function() { 
                    parent.operate('teardown');
                    parent.operate('init');                
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
                markerCore.setVisibility(true);
                troller_back.pause();
                troller_back.currentTime = 0;
                transform(ident);
                document.body.removeChild(troller_back);
                window.clearTimeout(to_id);
                cntr = 0;
            }
        };
    };
    mutexVisualEffects.Troller.prototype = new mutexVisualEffectsCore.MutexEffect();

    mutexVisualEffects.PrintAnalog = function() {
        Object.defineProperties(this, {
            'name': { value: 'PrintAnalog' },
            'css_class': { value: 'print-analog' }
        });

        var stdDeviation = 1.16,
            paDenoise = document.getElementById("pa-denoise");
        Object.defineProperty(this, 'denoiseStdDeviation', {
            get: function() { return stdDeviation; },
            set: function(val) {
                stdDeviation = val;
                paDenoise.setAttribute("stdDeviation", stdDeviation.toString());
            }
        });

        var thicken = false,
            paThicken = document.getElementById("pa-bypass");
        Object.defineProperty(this, 'thicken', {
            get: function() { return thicken; },
            set: function(val) {
                thicken = val;
                var nodeAddr = val ? "thick" : "flip",
                    radius = val.toString();
                paThicken.setAttribute("in2", nodeAddr);
                paThicken.setAttribute("radius", radius);
            }
        });
    }; 
    mutexVisualEffects.PrintAnalog.prototype = new mutexVisualEffectsCore.MutexEffect();

    mutexVisualEffects.CausticGlow = function() {
        Object.defineProperties(this, {
            'name': { value: 'CausticGlow' },
            'css_class': { value: 'caustic-glow' }
        });

        var stdDeviation = 10.6,
            cgGlow = document.getElementById("cg-glow-radius");
        Object.defineProperty(this, 'alphaBlurRadius', {
            get: function() { return stdDeviation; },
            set: function(val) { 
                stdDeviation = val;
                cgGlow.setAttribute('stdDeviation', stdDeviation.toString());
            }
        });

        var blur_x = 0,
            blur_animation_duration = 1000;
            cgBlurAnimate = document.getElementById('caustic-glow-post-blur-animate');
        Object.defineProperty(this, 'animatedPostBlurRadius', {
            get: function() { return blur_x; },
            set: function(v) {
                blur_x = v;
                cgBlurAnimate.setAttribute("values", "0 0;"+blur_x+" 0;0 0");
            }
        });
        Object.defineProperty(this, 'animatedPostBlurDuration', {
            get: function() { return blur_animation_duration; },
            set: function(v) {
                blur_animation_duration = v;
                cgBlurAnimate.setAttribute('dur', blur_animation_duration.toString() + 'ms');
            }
        });

        var caustic_glow_back = document.createElement("div");
        caustic_glow_back.setAttribute("id", "caustic-glow-back");  
    
        var vid_id = "107871876",
            vimeo_player = document.createElement("iframe");
        vimeo_player.setAttribute("id", "vimeo-player");
        vimeo_player.src = 
            "//player.vimeo.com/video/"+vid_id+
            "?api=1&player_id=vimeo-player&autopause=0&loop=1";
        caustic_glow_back.appendChild(vimeo_player);
         
        document.body.appendChild(caustic_glow_back);

        var player = $f( $('#vimeo-player')[0] ),
            player_ready = false;
        player.addEvent('ready', function() {
            player_ready = true;
            player.api("setVolume", 0);
            player.api('pause');
        });

        var blink_id = null;
        var blink_map = function() {
            var del = Math.random() * 20000 + 10000,
                dur = Math.random() * 2000 + 1000;
            blink_id = window.setTimeout(function() {
                div.$map.hide();
                markerCore.setVisibility(false);
                window.setTimeout(function() {
                    div.$map.show();
                    markerCore.setVisibility(true);
                }, dur);
            }, del);
        }; 
    
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
            if ( (Math.random() * 10) <= 7 ) blink_map(); 
        };
        this.teardown = function() {
            player.api("pause");
            caustic_glow_back.style.visibility = "hidden";
            if (blink_id) window.clearTimeout(blink_id);
            blink_id = null;    
        };
    };
    mutexVisualEffects.CausticGlow.prototype = new mutexVisualEffectsCore.MutexEffect();

    mutexVisualEffects.Cmgyk = function() {
        Object.defineProperties(this, {
            'name': { value: 'Cmgyk' },
            'css_class': { value: 'cmgyk' }
        });

        var denoiseStdDeviation = 1,
            cmgykDenoise = document.getElementById("cmgyk-denoise");
        Object.defineProperty(this, 'denoise_radius', {
            get: function() { return denoiseStdDeviation; },
            set: function(val) {
                denoiseStdDeviation = val;
                cmgykDenoise.setAttribute('stdDeviation', denoiseStdDeviation.toString());
            }
        });
        var cmgyk_back = document.createElement("div");
        cmgyk_back.setAttribute("id", "cmgyk-back");
        
        var cmgyk_grad = document.createElement("div");
        cmgyk_grad.setAttribute("id", "cmgyk-grad");
        cmgyk_back.appendChild(cmgyk_grad); 
        
        var cmgyk_steady_back = document.createElement("div");
        cmgyk_steady_back.setAttribute("id", "cmgyk-steady-back");

        var engaged = false,
            times_engaged = 0,
            ko_num = 2,
            blink_num = 3;

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
            } while (rad >= 1 || rad === 0);
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
                    var x = idxGen(),
                        y = idxGen();
                    if (x > y) {
                        s_idx = x;
                        e_idx = y;
                    } else {
                        s_idx = y;
                        e_idx = x;
                    }
                    s_idx--;
                    e_idx++;
                }());
                var b_mod = (function() {
                    var range = [5, 6, 7, 8, 9, 10, 11],
                        r = [],
                        num = (Math.random() * 4 + 0.5) | 0;
                    for (var i = 0; i < num; i++) {
                        r.push(range[ (Math.random() * range.length - 1 + 0.5) | 0 ]);
                    }
                    return r;
                }());
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
        var rot_interval = 22.5,
            rot = 0,
            lzoom = 0;
        var onTilesLoaded = function(map_obj) {
            lzoom = map_obj.zoom;
        };

        var onZoom = function(map_obj) {
            var zoom = map_obj.zoom;
            rot = rot + ( (zoom - lzoom) * rot_interval );
            var str = "rotate("+rot.toString()+"deg)";
            cmgyk_back.style.transform = str; 
            cmgyk_back.style.webkitTransform = str;
            lzoom = zoom;           
        };
        gMap.events.queue('map', 'tilesloaded', onTilesLoaded, true); 
        gMap.events.queue('map', 'tilesloaded', koAndBlink);
        gMap.events.queue('map', 'bounds_changed', koAndBlink);
        gMap.events.queue('map', 'zoom_changed', onZoom); 
    };
    mutexVisualEffects.Cmgyk.prototype = new mutexVisualEffectsCore.MutexEffect();

    mutexVisualEffects.Fauvist = function() {
        Object.defineProperties(this, {
            'name': { value: 'Fauvist' },
            'css_class': { value: 'fauvist' }
        });
    };
    mutexVisualEffects.Fauvist.prototype = new mutexVisualEffectsCore.MutexEffect();

    mutexVisualEffects.Vhs = function() {
        Object.defineProperties(this, {
            'name': { value: 'Vhs' },
            'css_class': { value: 'vhs' }
        });

        var offset = document.getElementById("vhs-offset");

        var vhs_back = document.createElement('div');
        vhs_back.setAttribute("id", "vhs-back");

        var vhs_canv = document.createElement('canvas');
        vhs_canv.width = window.innerWidth * 0.75;
        vhs_canv.height = window.innerHeight * 0.75;
        vhs_canv.setAttribute("id", "vhs-canv");
        window.addEventListener('resize', function(e) {
            vhs_canv.width = window.innerWidth * 0.75;
            vhs_canv.height = window.innerHeight * 0.75;
        });
        
        var z = visualCore.webgl.setup(vhs_canv, VHSShaders),
            start_time = Date.now(),
            time, js_random, idle;
        
        this.init = function() {
            document.body.appendChild(vhs_back);
            document.body.appendChild(vhs_canv);
        };

        var jit = true,
            jit_offset = 3,
            jit_delay = 150,
            jit_frame_div = 2,
            frct = 0,
            os = 0;
        
        this.animate = function() {
            if ( jit && ( (frct % jit_frame_div) === 0 ) ) {
                offset.setAttribute("dy", os); 
                os = (os === jit_offset) ? 0 : jit_offset;
            }
            frct++;
            
            z.gl.clear(z.gl.COLOR_BUFFER_BIT | z.gl.DEPTH_BUFFER_BIT);
            time = z.gl.getUniformLocation(z.program, "time");
            z.gl.uniform1f(time, Date.now() - start_time);
            js_random = z.gl.getUniformLocation(z.program, "js_random");
            z.gl.uniform1f(js_random, Math.random());
            idle = z.gl.getUniformLocation(z.program, "idle");
            z.gl.uniform1i(idle, jit ? 1 : 0);
            z.gl.drawArrays(z.gl.TRIANGLES, 0, 6);
        };

        this.teardown = function() {
            document.body.removeChild(vhs_back);
            document.body.removeChild(vhs_canv);
        };

        var jit_tmp;
        var jitter = function(idle) {
            jit_tmp = idle;
            if (!jit_tmp) offset.setAttribute("dy", 0);
            window.setTimeout(function() {
                jit = jit_tmp;
            }, jit_delay);
        };
        gMap.events.queue('map', 'zoom_changed', function() {
            jitter(false);
        });
        gMap.events.queue('map', 'drag', function() {
            jitter(false);
        });
        gMap.events.queue('map', 'idle', function() {
            jitter(true);
        });
    };
    mutexVisualEffects.Vhs.prototype = new mutexVisualEffectsCore.MutexEffect();

return mutexVisualEffects; });
