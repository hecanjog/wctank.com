@@ vertex shader
attribute float a_vertexID;
attribute float a_type;
attribute vec2 a_normCoords;
attribute vec2 a_position;

uniform int u_mouseover;
uniform int u_mouseoverIdx;

varying vec2 v_texCoord;
varying float v_this_type;
varying float v_mouseover; 

void main() 
{
    v_this_type = a_type;
    v_texCoord = a_normCoords;
    if ( (u_mouseover > 0) && (u_mouseoverIdx == int(a_vertexID)) ) {
        v_mouseover = 1.1;       
    } else {
        v_mouseover = 0.0;
    }
    gl_Position = vec4(a_position, 0, 1);
}
END

@@ fragment shader
precision highp float;

uniform sampler2D u_stumble;
uniform sampler2D u_video;
uniform sampler2D u_random;
uniform int u_clock;

varying vec2 v_texCoord;
varying float v_this_type;
varying float v_mouseover;

void main()
{
    float clock = float(u_clock);
    highp vec4 color;
    if (v_this_type < 0.1) {
        color = texture2D(u_random, v_texCoord);
    } else if ((v_this_type > 0.9) && (v_this_type < 1.1)) {
        color = texture2D(u_video, v_texCoord);
    } else if ((v_this_type > 1.9) && (v_this_type < 2.1)) {
        color = texture2D(u_stumble, v_texCoord);
    }
    if (v_mouseover > 1.0) {
        if ( mod(clock, 3.0) == 1.0 )  { // will only be true occasionally
            color.a = 0.0;         
        } 
        if ( mod(gl_FragCoord.y + clock, 3.0) < mod(clock / 10.0, 3.0) ) {
            if (color.a > 0.01) {
                color = vec4(color.rgb, 0.5);
            }
        }
    }
    gl_FragColor = color;
}
END
