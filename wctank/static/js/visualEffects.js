define (
    [
        'div',
        'gMap',
        'visualCore',
        'text!AlphaStrutShaders.glsl',
        'text!SquaresShaders.glsl',
        'jquery'
    ],
 
function(div, gMap, visualCore, AlphaStrutShaders, SquaresShaders, $) { var visualEffects = {};

    visualEffects.Strut = function() {
        var strut_front = document.createElement("canvas");
        strut_front.setAttribute("id", "strut-front");

        var vid = document.createElement('video');
        vid.style.display = "none";
        vid.preload = "auto";
        vid.crossOrigin = 'anonymous';
        $.get('/vimeo_data', function(url) {
            vid.src = url;
        });
        document.body.appendChild(vid);

        var z = visualCore.webgl.setup(strut_front, AlphaStrutShaders, true),
                vid_tex, vUv_buffer, a_vUv, u_vid,
                threshold = 50;

        vid.addEventListener("canplaythrough", function() {
            vid.volume = 0;
            vid.currentTime = 60;
        }, true);

        vid_tex = z.gl.createTexture();
        z.gl.bindTexture(z.gl.TEXTURE_2D, vid_tex);
        z.gl.texParameteri(z.gl.TEXTURE_2D, z.gl.TEXTURE_WRAP_S, z.gl.CLAMP_TO_EDGE);
        z.gl.texParameteri(z.gl.TEXTURE_2D, z.gl.TEXTURE_WRAP_T, z.gl.CLAMP_TO_EDGE);
        z.gl.texParameteri(z.gl.TEXTURE_2D, z.gl.TEXTURE_MIN_FILTER, z.gl.NEAREST);
        z.gl.texParameteri(z.gl.TEXTURE_2D, z.gl.TEXTURE_MAG_FILTER, z.gl.NEAREST);

        uv_buffer = z.gl.createBuffer();
        z.gl.bindBuffer(z.gl.ARRAY_BUFFER, uv_buffer);
        z.gl.bufferData(z.gl.ARRAY_BUFFER, new Float32Array([
             0.0,  0.0,
             1.0,  0.0,
             0.0,  1.0,
             0.0,  1.0,
             1.0,  0.0,
             1.0,  1.0        
            ]), z.gl.STATIC_DRAW); 
       
        a_uv = z.gl.getAttribLocation(z.program, 'a_uv');
        z.gl.vertexAttribPointer(a_vUv, 2, z.gl.FLOAT, false, 0, 0);
        z.gl.enableVertexAttribArray(a_vUv);
   
        u_vid = z.gl.getUniformLocation(z.program, "u_vid");

        z.gl.uniform1f( z.gl.getUniformLocation(z.program, "u_threshold"), threshold );

        this.init = function() {
            document.body.appendChild(strut_front);
            vid.play();
        };

        this.teardown = function() {
            document.body.removeChild(strut_front);
            vid.pause();
        };

        this.animate = function() {
            z.gl.clear(z.gl.COLOR_BUFFER_BIT | z.gl.DEPTH_BUFFER_BIT);
                
            z.gl.activeTexture(z.gl.TEXTURE0);
            z.gl.bindTexture(z.gl.TEXTURE_2D, vid_tex);
            z.gl.pixelStorei(z.gl.UNPACK_FLIP_Y_WEBGL, true);
            z.gl.texImage2D(z.gl.TEXTURE_2D, 0, z.gl.RGBA, z.gl.RGBA, z.gl.UNSIGNED_BYTE, vid);
            z.gl.uniform1i(u_vid, 0);
            
            z.gl.drawArrays(z.gl.TRIANGLES, 0, 6);
        };
    };
    visualEffects.Strut.prototype = new visualCore.Effect();

    visualEffects.Squares = function() {
        var squares_front = document.createElement('canvas');
        squares_front.setAttribute("id", "squares-front");

        // r, g, b (a to be assigned in shader)
        var colors = new Float32Array([
            1.0, 0.0, 0.0,
            1.0, 1.0, 0.0,
            0.0, 1.0, 0.0,
            0.0, 1.0, 1.0,
            0.0, 0.0, 1.0,
            1.0, 0.0, 1.0 
        ]);

        var rect = 
            [ -1.0, -1.0,
               1.0, -1.0,
              -1.0,  1.0,
              -1.0,  1.0,
               1.0, -1.0,
               1.0,  1.0  ];
    
        var vertices = [];

        var nesting = 7,
            diff = 1 / nesting,
            id = 0;

        for (var i = nesting; i > 0; i--) {  
            for (var j = 0; j < 6; j++) {
                vertices.push( id );
                vertices.push( rect[j * 2] * diff * i);
                vertices.push( rect[j * 2 + 1] * diff * i);
            }
            id++;  
        }
        
        var z = visualCore.webgl.setup(squares_front, SquaresShaders, true),
            a_vertex_buffer = z.gl.createBuffer(),
            u_alpha = 0.1,
            a_id, a_position, u_time;

        // set up 
        z.gl.bindBuffer(z.gl.ARRAY_BUFFER, a_vertex_buffer);
        z.gl.bufferData(z.gl.ARRAY_BUFFER, new Float32Array(vertices), z.gl.STATIC_DRAW);  
        
        a_id = z.gl.getAttribLocation(z.program, 'a_id');
        z.gl.vertexAttribPointer(a_id, 1, z.gl.FLOAT, false, 12, 0);
        z.gl.enableVertexAttribArray(a_id);

        a_position = z.gl.getAttribLocation(z.program, 'a_position');
        z.gl.vertexAttribPointer(a_position, 2, z.gl.FLOAT, false, 12, 4);
        z.gl.enableVertexAttribArray(a_position);

        z.gl.uniform3fv(z.gl.getUniformLocation(z.program, "u_colors"), colors);

        u_time = z.gl.getUniformLocation(z.program, "u_time");

        u_alpha = z.gl.getUniformLocation(z.program, "u_alpha");

        this.init = function() {
            document.body.appendChild(squares_front);
        };

        var alpha = 0.1;

        Object.defineProperty(this, 'alpha', {
            get: function() { return alpha; },
            set: function(v) { 
                if (alpha >= 0 && alpha <= 1) {
                    alpha = v;
                } else {
                    throw new Error("Invalid visualEffects.Squares param: "+
                        "alpha must be a number between 0 and 1 inclusive");
                }
            }
        });

        var cntr = 0;
        var getClock = function() {
            return cntr++ % colors.length;
        };

        this.animate = function() {
            z.gl.clear(z.gl.COLOR_BUFFER_BIT | z.gl.DEPTH_BUFFER_BIT);
            z.gl.uniform1i(u_time, getClock());
            z.gl.uniform1f(u_alpha, alpha);
            z.gl.drawArrays(z.gl.TRIANGLES, 0, vertices.length / 3);
        };
        
        this.teardown = function() {
            document.body.removeChild(squares_front);
        };
    };
    visualEffects.Squares.prototype = new visualCore.Effect();

    visualEffects.ShowBorders = function() {
        var $imgs,
            first = true,
            types = ['dotted', 'solid', 'groove'],
            bitte = false;

        var rndType = function() {
            return types[(Math.random() * types.length) | 0];
        };
     
        var cycle = function cycle() {
            $imgs = null;
            $imgs = $(div.selectors.$_map_imgs);
            $imgs.each(function() {
                $(this).css("border", "4px "+rndType());
            });
            if (bitte) {
                if (first) {
                    google.maps.event.addListenerOnce(gMap.map, 'idle', cycle);
                    first = false;
                }
                //TODO: also attach to onZoom listeners
                google.maps.event.addListenerOnce(gMap.map, 'tilesloaded', cycle);
            }
        };

        this.init = function() {
            bitte = true;
            cycle();
        };
        
        var tear_count = 0;
        this.teardown = function() {
            bitte = false; 
            $(div.selectors.$_map_imgs).css('border', '0'); 
            $imgs = null;
            tear_count++;
            // ugh, there's something going on with the maps cache here
            if (tear_count < 2) {
                this.teardown();
            } else {
                tear_count = 0;
            }
        };
    };
    visualEffects.ShowBorders.prototype = new visualCore.Effect(); 

return visualEffects; });
