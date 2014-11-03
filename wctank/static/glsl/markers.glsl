@@ vertex shader
attribute vec2 a_position;
uniform vec2 markPos;

void main() 
{
    gl_Position = vec4(a_position.xy, 0, 1);
}

END

@@ fragment shader
precision lowp float;

//uniform sampler2D sampler2d;

//varying vec2 v_texCoord;

void main()
{
    //vec2 texCoord = v_texCoord.s, 1.0 - v_texCoord.t;
    //vec4 color = texture2D(sampler2d, texCoord);
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
}

END
