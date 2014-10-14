/*
 * alphaStrut is a special filter event that runs simultaneously with the .attrs filters
 */
var alphaStrut = (function(alphaStrut) {
    wctank.aliasNamespace.call(alphaStrut.prototype);
    
    // occasionally cover map with flashing screen  
    // instead of opaque being black, sky gif
    // sky with flashing?
    // virgo logo gif 
    // limit backgrounds to only the most colorful (and resource cheap) filters:
    //  caustic glow (the yt vid only), cmgyk, a flashing thing,
    //  remove some layers from cmgyk
    //  increased caustic glow video usage
    //
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
        
    alphaStrut.webgl = (function(webgl) {
        var z = core.webgl.setup(alphaStrut_front, "/static/glsl/alphaStrut.glsl", true); 
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
    alphaStrut.init = function() {
        document.body.appendChild(alphaStrut_front);
        vid.play();
    };
    alphaStrut.teardown = function() {
        document.body.removeChild(alphaStrut_front);
        vid.pause();
    };
    alphaStrut.animate = function() {
        alphaStrut.webgl.update();
    };
    
    /*
    window.setTimeout(function() {
        alphaStrut.init();
        if (!core.render.rendering) core.render.push(alphaStrut.animate);
        core.render.go();
    }, 10000); 
    */

    return alphaStrut;
}({}))
