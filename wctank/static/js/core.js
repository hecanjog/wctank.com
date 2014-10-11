var div = {
    $overlay: $('#overlay'),
    $map: $("#map-canvas"),
    $map_U_markers: $("#map-canvas").add("#markers-a").add("#markers-b")
};

var core = (function(core) {

    core.render = (function(render) {
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
                    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); 
                });
                r.gl = gl;
                return r;
            }
        };
        return webgl;
    }({}))

    core.filters = (function(filters) {
        var sets = {
            general: [],
            zoomed: [],
            takeover_down: [],
            takeover_up: [],
            start: [],
            webgl: []
        };
        filters.usage = {
            // filter can be called on an /idle_interval setInterval
            GENERAL:        0x40000000,             
            // filter can be called when zoom level >= 17
            ZOOMED:         0x20000000,             
            // if filter called on zoom >= 17 event, persists when zoom < 17
            TAKEOVER_DOWN:  0x10000000,
            // if filter already called, zoom >= 17 event has no effect
            TAKEOVER_UP:    0x08000000,             
            // filter can be called on load
            START:          0x04000000, 
            NONE:           0x00000000
        };
        filters.parse = function() {
            for (var filter in filterDefs) {
                if ( filterDefs.hasOwnProperty(filter) ) {
                    var u = filterDefs[filter].usage;
                    var cfu = core.filters.usage;
                    if ( (u & cfu.GENERAL) === cfu.GENERAL ) 
                        sets.general.push(filter);
                    if ( (u & cfu.ZOOMED) === cfu.ZOOMED ) 
                        sets.zoomed.push(filter);                 
                    if ( (u & cfu.TAKEOVER_DOWN) === cfu.TAKEOVER_DOWN ) 
                        sets.takeover_down.push(filter);
                    if ( (u & cfu.TAKEOVER_UP) === cfu.TAKEOVER_UP ) 
                        sets.takeover_up.push(filter);
                    if ( (u & cfu.START) === cfu.START ) 
                        sets.start.push(filter);
                    if ( filterDefs[filter].hasOwnProperty("webgl") ) 
                        sets.webgl.push(filter);
                }
            }
        };
        filters.current = null;
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
        var was_in_close = false;
        var new_filter;
        var old_filter;
        filters.apply = function(filter) {
            core.filters.current = filter;
            var render = core.render;
            if (new_filter) {
                var this_filter = filterDefs[new_filter];
                if ( this_filter.hasOwnProperty('preTeardown') ) this_filter.preTeardown();
                div.$map.removeClass(new_filter);
                if ( this_filter.hasOwnProperty('animate') ) render.rm(this_filter.animate);
                if ( this_filter.hasOwnProperty('teardown') ) this_filter.teardown();
                if ( !render.has() ) render.stop();
            }
            var this_filter = filterDefs[filter]; 
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
            core.filters.apply(nf);
        };
        filters.forceApply = function() {
            applyRndFilter(sets.general);
        };
        var close_thresh = 17;
        filters.onZoom = function(map_obj) {
            if ( was_in_close && (map_obj.zoom <= close_thresh) ) {
                filters.apply(old_filter);
                was_in_close = false;
            } else if ( !was_in_close && (map_obj.zoom > close_thresh) 
                       && (sets.takeover_up.indexOf(new_filter) === -1) ) {
                applyRndFilter(sets.zoomed);
                was_in_close = true;
            }       
        };
        
        /*
         * mainTime coordinates normal interval-driven filter changes
         */
        //TODO: consider enforcing maximum pause - 4 min or something
        var mainTime = (function(mainTime) {
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
            mainTime.setInterval = function(n) {
                mainTime.cease();
                interval = n;
                mainTime.engage();
            };
            mainTime.engage = function() {
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
            mainTime.cease = function() {
                cease = Date.now();
                elapsed = cease - start;
                window.clearInterval(id);
                window.clearTimeout(id);
            };
            return mainTime;
        }({}))
        
        filters.start = mainTime.engage;

        /* 
         * A couple of events that need to be hooked;
         * onMarkerClick is called in index.html where markers are defined
         * (we use the marker_clicked flag to weed out cases where clicking on a marker
         * also triggers the map click event)
         */
        var marker_clicked = false;
        filters.onMarkerClick = function() {
            marker_clicked = true;
            window.setTimeout(function() {
                marker_clicked = false;
            }, 100);
            if ( div.$overlay.is(":hidden") ) mainTime.cease();
        };
        filters.onMapClick = function() {
            if ( !div.$overlay.is(":hidden") ) {
                window.setTimeout(function() {
                    if (!marker_clicked) mainTime.engage();
                }, 50);
            }
        };  
        return filters;
    }({}))
    
    /*
     * core.events wraps core event listeners (except filters.onMarkerClick)
     * and is evoked in the main listener hook
     */
    core.events = function(gMapObj) {
        google.maps.event.addListener(gMapObj, 'zoom_changed', function() {
            core.filters.onZoom(gMapObj);
        });
        google.maps.event.addListenerOnce(gMapObj, 'click', function() {
            core.filters.onMapClick();
        });
    };

    return core;
}({}))
