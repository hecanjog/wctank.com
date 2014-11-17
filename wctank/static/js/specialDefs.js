define(
    [
        'div',
        'gMap',
        'visCore',
        'specialCoord',
        'text!AlphaStrutShaders.glsl',
        'text!SquaresShaders.glsl',
        'text!AngularShaders.glsl',
        'jquery',
    ],

function(div, gMap, visCore, specialCoord, 
         AlphaStrutShaders, SquareShaders, AngularShaders, $) { var specialDefs = {};
    //TODO: remove non-transparent parts in image
    // do something else besides just show and hide the image?
    /*
    specialDefs.words = (function(words) {
        var back_z = "-999";
        var front_z = "19";
        var words_front = document.createElement('div');
        words_front.setAttribute("id", "words_front");
        words_front.style.zIndex = back_z;
        document.body.appendChild(words_front);
        
        words.init = function() {
            words_front.style.zIndex = front_z;    
        };
        words.teardown = function() {
            words_front.style.zIndex = back_z;
        };
        return words;
    }({}));*/
   
    /*
     * trying to special.remove this glitches a bit, but I like it
     */
    specialDefs.showBorders = (function(showBorders) {
        var $imgs;
        var first = true;
        var tni = false;
        var types = ['dotted', 'solid', 'groove'];
        var rndType = function() {
            return types[(Math.random() * types.length) | 0];
        };
        function cycle() {
            $imgs = null;
            $imgs = $(div.selectors.$_map_imgs);
            $imgs.each(function() {
                $(this).css("border", "4px "+rndType());
            });
            if (tni) {
                if (first) {
                    google.maps.event.addListenerOnce(gMap.map, 'idle', cycle);
                    first = false;
                }
                //TODO: also attach to onZoom listeners
                google.maps.event.addListenerOnce(gMap.map, 'tilesloaded', cycle);
            };
        }
        showBorders.init = function(e) {
            tni = true;
            cycle(); 
        };
        var f = 0;
        showBorders.teardown = function() {
            tni = false; 
            $(div.selectors.$_map_imgs).css('border', '0'); 
            $imgs = null;
            f++;
            // ugh, there's something going on with the maps cache here
            if (f < 2) showBorders.teardown;
        };
        return showBorders;
    }({}));

    /*
     * alphaStrut is a special filter event that runs simultaneously with the filters
     */
    function AlphaStrut() {
        
        // occasionally cover map with flashing screen  
        // instead of opaque being black, sky gif
        // sky with flashing?
        // virgo logo gif 
        // limit backgrounds to only the most colorful (and resource cheap) filters:
        //  caustic glow (the yt vid only), cmgyk, a flashing thing,
        //  remove some layers from cmgyk
        //  increased caustic glow video usage
        // TODO: select portion of video to use
        // create resource saving filter modes
        // functions to cull filter sets
        // picture filter
        // turn on background video sound during special event
        var vid = document.createElement('video');
        vid.style.display = "none";
        vid.preload = "auto";
        vid.crossOrigin = 'anonymous';
        $.get('/vimeo_data', function(url) {
            vid.src = url;
        });
        document.body.appendChild(vid);

        var alphaStrut_front = document.createElement("canvas");
        alphaStrut_front.setAttribute("id", "alphaStrut_front");
        
        var that = this; 
        this.webgl = (function(webgl) {
            var z = visCore.webgl.setup(alphaStrut_front, AlphaStrutShaders, true),
                vid_tex, vUv_buffer, a_vUv, u_vid,
                threshold = 50;
            
            vid.addEventListener("canplaythrough", function() {
                
                vid.volume = 0; 
                vid.currentTime = 60;

                //TODO: fix cross-origin in Firefox (prob via proxy stream) 
                vid_tex = z.gl.createTexture();
                z.gl.bindTexture(z.gl.TEXTURE_2D, vid_tex);
                z.gl.texParameteri(z.gl.TEXTURE_2D, z.gl.TEXTURE_WRAP_S, z.gl.CLAMP_TO_EDGE);
                z.gl.texParameteri(z.gl.TEXTURE_2D, z.gl.TEXTURE_WRAP_T, z.gl.CLAMP_TO_EDGE);
                z.gl.texParameteri(z.gl.TEXTURE_2D, z.gl.TEXTURE_MIN_FILTER, z.gl.NEAREST);
                z.gl.texParameteri(z.gl.TEXTURE_2D, z.gl.TEXTURE_MAG_FILTER, z.gl.NEAREST);
               
                vUv_buffer = z.gl.createBuffer();
                z.gl.bindBuffer(z.gl.ARRAY_BUFFER, vUv_buffer);
                z.gl.bufferData(z.gl.ARRAY_BUFFER, new Float32Array([
                     0.0,  0.0,
                     1.0,  0.0,
                     0.0,  1.0,
                     0.0,  1.0,
                     1.0,  0.0,
                     1.0,  1.0        
                    ]), z.gl.STATIC_DRAW); 
               
                a_vUv = z.gl.getAttribLocation(z.program, 'a_vUv');
                z.gl.vertexAttribPointer(a_vUv, 2, z.gl.FLOAT, false, 0, 0);
                z.gl.enableVertexAttribArray(a_vUv);
           
                u_vid = z.gl.getUniformLocation(z.program, "u_vid");

                z.gl.uniform1f( z.gl.getUniformLocation(z.program, "u_threshold"), threshold );
            }, true);
           
            //var clock = 0;
            webgl.update = function() {
                z.gl.clear(z.gl.COLOR_BUFFER_BIT | z.gl.DEPTH_BUFFER_BIT);
                
                z.gl.activeTexture(z.gl.TEXTURE0);
                z.gl.bindTexture(z.gl.TEXTURE_2D, vid_tex);
                z.gl.pixelStorei(z.gl.UNPACK_FLIP_Y_WEBGL, true);
                z.gl.texImage2D(z.gl.TEXTURE_2D, 0, z.gl.RGBA, z.gl.RGBA, z.gl.UNSIGNED_BYTE, vid);
                z.gl.uniform1i(u_vid, 0);
                
                z.gl.drawArrays(z.gl.TRIANGLES, 0, 6);
            };
            return webgl; 
        }({}));
        this.init = function() {
            document.body.appendChild(alphaStrut_front);
            vid.play();
        };
        this.teardown = function() {
            document.body.removeChild(alphaStrut_front);
            vid.pause();
        };
        this.animate = function() {
            that.webgl.update();
        };
    };
    AlphaStrut.prototype = new visCore.MapFilter();
    specialDefs.alphaStrut = new AlphaStrut();
        
    function Squares() {
        // only allow with edge or sky movies
        var squares_over = document.createElement('canvas');
        squares_over.setAttribute("id", "squares_front");
        
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

        var nesting = 50,
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

        // squares over my hammy
        var z = visCore.webgl.setup(squares_over, SquareShaders, true),
            a_vertex_buffer = z.gl.createBuffer(),
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

        this.init = function() {
            document.body.appendChild(squares_over);
        };
        var cntr = 0;
        var getClock = function() {
            return cntr++ % colors.length;
        };
        this.animate = function() {
            z.gl.clear(z.gl.COLOR_BUFFER_BIT | z.gl.DEPTH_BUFFER_BIT);
            z.gl.uniform1i(u_time, getClock())
            z.gl.drawArrays(z.gl.TRIANGLES, 0, vertices.length / 3);
        };
        this.teardown = function() {
            document.body.removeChild(squares_over);
        };
    }
    Squares.prototype = new visCore.MapFilter();
    specialDefs.squares = new Squares();

    function Words() {
        var words_front = document.createElement('canvas');
        words_front.setAttribute('id', 'words_front');
        
        // diaplay as paragraph, display as banner
        // pool of words and phrases
        // accent individual words with shader
        var mess;
        this.display = function(string) {
        };

        this.init = function() {
            document.body.appendChild(words_front);
        };
        this.animate = function() {

        };
        this.teardown = function() {
            document.body.removeChild(words_front);
        }; 
    }
    Words.prototype = new visCore.MapFilter();
    specialDefs.words = new Words();

    function Angular() {
        var angular_front = document.createElement('canvas');
        angular_front.setAttribute("id", "angular_front");

        this.init = function() {
            document.body.appendChild(angular_front);
        };

        var z = visCore.webgl.setup(angular_front, AngularShaders, true);         

        this.animate = function() {

        };
        this.teardown = function() {
            document.body.removeChild(angular_front);
        };
    }
    Angular.prototype = new visCore.MapFilter();
    specialDefs.angular = new Angular();

return specialDefs; });
