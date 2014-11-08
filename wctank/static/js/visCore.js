define(
    
    [
        'div' 
    ], 

function(div) { var visCore = {};

    visCore.render = (function(render) {
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
        var exStk = function() {
            for (var i = 0; i < stk.length; i++) {
                stk[i]();
            }
        }; 
        window.dbug = function() {
            console.log(stk);
        };
        render.go = function() {
            render.rendering = true;
            id = window.requestAnimationFrame(render.go);
            exStk();
        };
        render.has = function(fn) {
            if (typeof fn === 'function') {
                var idx = stk.indexOf(fn);
                return (idx !== -1) ? idx : false;
            } else {
                return (stk.length > 0) ? true : false;
            }
        };
        render.tick = function() {
            if ( render.has() ) exStk();
        };

        render.stop = function() {
            render.rendering = false;
            cancelAnimationFrame(id);
        }
        return render;
    }({}))
    
    visCore.webgl = {
        success: false,
        setup: function(canvas, shaders, DEBUG) {
            var r = {};
            var getShaderLog = function(gl_shader_obj) {
                if ( !gl.getShaderParameter(gl_shader_obj, gl.COMPILE_STATUS) ) 
                    console.log( gl.getShaderInfoLog(gl_shader_obj) );
            };
            var getProgramLog = function(gl_program_obj) {
                if ( !gl.getProgramParameter(gl_program_obj, gl.LINK_STATUS) )
                    console.log( gl.getProgramInfoLog(gl_program_obj) );
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
                visCore.webgl.success = true;
                gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
                gl.clearColor(0.0, 0.0, 0.0, 0.0);
                window.addEventListener("resize", function() {
                    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
                });
                var matches = shaders.match(/\n(\d|[a-zA-Z])(\s|.)*?(?=END|^@@.*?$)/gm),
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
            if (DEBUG) getProgramLog(prgm);
                gl.useProgram(prgm);
                
                r.program = prgm;

                //draw two big triangles
                var buffer = gl.createBuffer(),
                    pos_loc = gl.getAttribLocation(prgm, 'position');
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
                
                r.gl = gl;
                return r;
            }
        }
    };
   
    visCore.MapFilter = function MapFilter() { 
        this.css_class = '';
        this.preInit = null; //function() {};
        this.init = null; //function() {};
        this.animate = null; //function() {};
        this.preTeardown = null; //function() {};
        this.teardown = null //function() {};
        this.webgl = null;

        this.operate = function(stage) {
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
            var parent = this; 
            var callFunct = function(fnName) {
                if (fnName !== 'animate') {
                    parent[fnName]();
                } else if (fnName === 'animate') {
                    visCore.render[r_op](parent[fnName]);
                }
            };
            if ( this[ ops[0] ] ) callFunct(ops[0]);
            div.$map[$op](this.css_class);
            if ( this[ ops[1] ] ) callFunct(ops[1]);
            if ( this[ ops[2] ] ) callFunct(ops[2]);
            
            if ( visCore.render.has() && (!visCore.render.rendering) ) {
                visCore.render.go();
            } else if ( !visCore.render.has() ) {
                visCore.render.stop();
            }
        };
    };
return visCore; });
