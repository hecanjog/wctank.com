@@ vertex shader
attribute float a_type;
attribute vec2 a_normCoords;
attribute vec2 a_position;

varying vec2 texCoord;
varying float this_type;

void main() 
{
    this_type = a_type;
    texCoord = a_normCoords;
    gl_Position = vec4(a_position, 0, 1);
}
END

@@ fragment shader
precision lowp float;

varying vec2 texCoord;
varying float this_type;

uniform sampler2D u_stumble;
uniform sampler2D u_video;
uniform sampler2D u_random;

void main()
{
    highp vec4 color;
    if (this_type < 0.1) {
        color = texture2D(u_random, texCoord);
    } else if ((this_type > 0.9) && (this_type < 1.1)) {
        color = texture2D(u_video, texCoord);
    } else if ((this_type > 1.9) && (this_type < 2.1)) {
        color = texture2D(u_stumble, texCoord);
    }
    gl_FragColor = color;
}

END
