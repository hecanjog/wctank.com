define(
    [
        'render'
    ],

function(render) { var visualCore = {};

    visualCore.webgl = {
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
                    console.warn("WebGL is good to have? I like to fart");
                    return false;
                }
            }());
            if (gl) {
                visualCore.webgl.success = true;
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

                // draw two big triangles
                // available under the attribute 'position'
                // TODO: perhaps make available with a switch as it throws console 
                // warnings if the position attribute is not used
                var buffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
                    -1.0, -1.0,
                     1.0, -1.0,
                    -1.0,  1.0,
                    -1.0,  1.0,
                     1.0, -1.0,
                     1.0,  1.0]), gl.STATIC_DRAW);
                
                var a_position = gl.getAttribLocation(prgm, 'position');
                gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(a_position); 
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); 
                
                r.gl = gl;
                return r;
            }
        }
    };
   
    visualCore.Effect = function Effect() { 
        this.preInit = null; //function() {};
        this.init = null; //function() {};
        this.animate = null; //function() {};
        this.preTeardown = null; //function() {};
        this.teardown = null; //function() {};

        this.operate = function(stage, hookObjArr) {
            var ops = [],
                hooks = [],
                r_op;

            if ( Array.isArray(hookObjArr) ) {
                hookObjArr.forEach(function(hookObj) {
                    if (hookObj.address <= 3) {
                        hooks[hookObj.address] = hookObj.fn;
                    } else {
                        throw "Invalid Effect.operate hook param: "+
                            "hook address must be less than or equal to 3";
                    }
                });
            }
            
            if (stage === 'init') {
                ops = ['preInit', 'init', 'animate'];
                r_op = 'queue';
            } else if (stage === 'teardown') {
                ops = ['preTeardown', 'animate', 'teardown'];
                r_op = 'rm';
            }
            var parent = this;
            var callFunct = function(fnName) {
                if (fnName !== 'animate') {
                    parent[fnName]();
                } else if (fnName === 'animate') {
                    render[r_op](parent[fnName]);
                }
            };

            for (var i = 0; i < 4; i++) {
                if (typeof hooks[i] === 'function') hooks[i]();
                if ( parent[ ops[i] ] ) callFunct(ops[i]);
            }
        };
    };

return visualCore; });
