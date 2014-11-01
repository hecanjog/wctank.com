wctank = wctank || {};

wctank.core = (function(core) {
    var div = wctank.div,
        util = wctank.util,
        gMap = wctank.gMap;

    core.render = (function(render) {
        var stk = [],
            id;
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
        render.has = function(fn) {
            if (typeof fn === 'function') {
                var idx = stk.indexOf(fn);
                return (idx !== -1) ? idx : false;
            } else {
                return (stk.length > 0) ? true : false;
            }
        }
        render.stop = function() {
            render.rendering = false;
            cancelAnimationFrame(id);
        }
        return render;
    }({}))
    
    core.webgl = (function(webgl) {
        webgl.success = false;
        webgl.setup = function(canvas, shader_path, DEBUG) {
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
                core.webgl.success = true;
                gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
                gl.clearColor(0.0, 0.0, 0.0, 0.0);
                window.addEventListener("resize", function() {
                    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
                });
                $.get(shader_path, function(data) {
                    var matches = data.match(/\n(\d|[a-zA-Z])(\s|.)*?(?=END|^@@.*?$)/gm),
                        vert_src = matches[0],
                        frag_src = matches[1],
                        vert_shader = gl.createShader(gl.VERTEX_SHADER),
                        frag_shader = gl.createShader(gl.FRAGMENT_SHADER);
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
                    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); 
                });
                r.gl = gl;
                return r;
            }
        };
        return webgl;
    }({}))
    
    core.filterTypeOp = function(stage, filterTypeObj) {
        var ops = [],
            r_op,
            $op;
        
        if (stage === 'init') {
            ops = ['preInit', 'init', 'animate'];
            r_op = 'push';
            $op = 'addClass';   
        } else if (stage === 'teardown') {
            ops = ['preTeardown', 'animate', 'teardown'];
            r_op = 'rm';
            $op = 'removeClass';
        }
        
        var callFunct = function(obj, fnName) {
            if (fnName !== 'animate') {
                obj[fnName]();
            } else if (fnName === 'animate') {
                core.render[r_op](obj[fnName]);
            }
        };
        if ( filterTypeObj[ ops[0] ] ) callFunct(filterTypeObj, ops[0]);
        div.$map[$op](filterTypeObj.css_class);
        if ( filterTypeObj[ ops[1] ] ) callFunct(filterTypeObj, ops[1]);
        if ( filterTypeObj[ ops[2] ] ) callFunct(filterTypeObj, ops[2]);
        
        if ( core.render.has() && (!core.render.rendering) ) {
            core.render.go();
        } else if ( !core.render.has() ) {
            core.render.stop();
        }
    };

    core.filters = (function(filters) {
        filters.current = null;
        
        var sets = {
            general: [],
            zoomed: [],
            takeover_down: [],
            takeover_up: [],
            start: [],
            webgl: []
        };

        filters.parse = function() {
            var instances = wctank.mapFilters.instances,
                uses = wctank.mapFilters.usageFlags;
            for (var filter in instances) {
                if ( instances.hasOwnProperty(filter) ) {
                    for (var flag in uses) {
                        if ( uses.hasOwnProperty(flag) ) {
                            if ( util.hasBit(instances[filter].usage, uses[flag]) ) 
                                sets[flag.toLowerCase()].push(filter);
                        };
                    } 
                    if ( instances[filter].hasOwnProperty('webgl') )
                        sets.webgl.push(filter);
                }
            }
        };

        filters.pushCategory = function(filter, cat_obj) {
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

        filters.rm = function(filter) {
            for (var cat in sets) {
                if ( sets.hasOwnProperty(cat) && (cat !== "webgl") ) {
                var idx = sets[cat].indexOf(filter);
                    if (idx > -1) sets[cat].splice(idx, 1);
                }
            }
        };
            
        // if webgl init fails, disable filters dependent on it.
        if (!core.webgl.success) sets.webgl.forEach(filters.rm); 

        // TODO: consider displaying message to encourage WebGl use
        var was_in_close = false,
            new_filter,
            old_filter;

        filters.apply = function(filter) {
            core.filters.current = filter;
            
            if (new_filter) {
                core.filterTypeOp('teardown', wctank.mapFilters.instances[new_filter], function() {
                    div.$map.removeClass(new_filter);
                });
            }
            core.filterTypeOp('init', wctank.mapFilters.instances[filter], function() {
                div.$map.addClass(filter);
            });
            old_filter = new_filter;
            new_filter = filter;
            if ( sets.takeover_down.indexOf(filter) !== -1 ) old_filter = filter;   
        };
        var applyRndFilter = function(arr) {
            var nf = util.getRndItem(arr);
            (function checkDup() {
                if (nf === new_filter) {
                    nf = util.getRndItem(arr);
                    checkDup();
                }
            }())
            core.filters.apply(nf);
        };
        filters.forceApply = function() {
            applyRndFilter(sets.general);
        };
        
        var close_thresh = 17;
        var onZoom = function(map_obj) {
            if ( was_in_close && (map_obj.zoom <= close_thresh) ) {
                filters.apply(old_filter);
                was_in_close = false;
            } else if ( !was_in_close && (map_obj.zoom > close_thresh) 
                       && (sets.takeover_up.indexOf(new_filter) === -1) ) {
                applyRndFilter(sets.zoomed);
                was_in_close = true;
            }       
        };
        gMap.events.push(gMap.events.MAP, 'zoom_changed', onZoom);
        
        /*
         * mainTime coordinates setTimeout-driven filter changes
         */
        //TODO: consider enforcing maximum pause - 4 min or something
        var mainTime = (function(mainTime) {
            var interval_base = 30000,
                interval,
                start,
                cease = 0,
                elapsed,
                id,
                first = true,
                is_engaged = false;
            
            var update = function() {
                start = Date.now();
                if (first) {
                    applyRndFilter(sets.start);
                    first = false;
                } else {
                    applyRndFilter(sets.general);
                }
            };
            //dep setInterval
            mainTime.setInterval = function(n) {
                mainTime.pause();
                mainTime.start(n);
            };
            
            mainTime.start = function(n) {
                var setAndUpdateInterval = function(n) {
                    if (n) interval_base = n;
                    interval = util.smudgeNumber(interval_base, 10);
                };
                
                n ? setAndUpdateInterval(n) : setAndUpdateInterval();
               
                function updateAndLoop() {
                    update();
                    loop();
                }
                function clearPausedParams() {
                    elapsed = 0;
                    cease = 0;
                }
                function loop() {
                    id = window.setTimeout(function() {
                        setAndUpdateInterval();
                        updateAndLoop();
                    }, interval);
                }
                                
                if (is_engaged) {
                    mainTime.pause();
                    is_engaged = false;
                    mainTime.start();
                } else {
                    is_engaged = true;
                    if (cease !== 0) {
                        if ( (Date.now() - cease) > interval ) {
                            updateAndLoop();
                            clearPausedParams();
                        } else {
                            id = window.setTimeout(function() {
                                updateAndLoop();
                                clearPausedParams();
                            }, interval - elapsed);
                        }
                    } else {
                        setAndUpdateInterval();
                        updateAndLoop();
                    }
                }
            };
            
            mainTime.pause = function() {
                cease = Date.now();
                elapsed = cease - start;
                window.clearInterval(id);
                window.clearTimeout(id);
            };
            return mainTime;
        }({}))
       
        // alias .engage() so that it can be called during filter init
        filters.start = mainTime.start;
        filters.pause = mainTime.pause;
        
        /* 
         * events
         */
        var marker_clicked = false;
        
        var onMarkerClick = function() {
            marker_clicked = true;
            window.setTimeout(function() {
                marker_clicked = false;
            }, 100);
            if ( div.$overlay.is(":hidden") ) mainTime.pause();
        };
        gMap.events.push(gMap.events.MARKER, 'click', onMarkerClick);
        
        var onMapClick = function() {
            if ( !div.$overlay.is(":hidden") ) {
                window.setTimeout(function() {
                    if (!marker_clicked) mainTime.start();
                }, 50);
            }
        };
        gMap.events.push(gMap.events.MAP, 'click', onMapClick);  
        
        return filters;
    }({}))
    
    /*
     * special visual events are morphologically similar to filters, 
     * except that they can be applied simultaneously and are 
     * triggered by user interaction rather than setInterval 
     */ 
    core.special = (function(special) {
        special.current = [];
        var currentRm = function(special) {
            var idx = core.special.current.indexOf(special);
            if (idx !== -1) core.special.current.splice(idx, 1);
        };
        special.apply = function(special) {
            core.special.current.push(special);
            core.filterTypeOp('init', wctank.specialDefs[special]);
        };
        special.remove = function(special) {
            currentRm(special);
            core.filterTypeOp('teardown', wctank.specialDefs[special]);
        };
        return special;
    }({})); 

    return core;
}({}))
