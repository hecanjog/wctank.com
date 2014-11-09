@@ vertex shader
precision lowp int;

attribute float a_vertexID;
attribute float a_type;
attribute vec2 a_normCoords;
attribute vec3 a_position;
attribute vec2 a_velocity;

uniform vec4 u_translate;
uniform int u_mouseover;
uniform int u_mouseoverIdx;
uniform int u_clock;

varying vec2 v_texCoord;
varying float v_this_type;
varying float v_mouseover; 

float angle(float velocity, int clock) 
{
    float pi = 3.1415927;
    return sin( (mod( float(clock), 2500.0) / 2500.0) * (2.0 * pi) * velocity ) ; 
}

void main() 
{
    // handle varyings
    v_this_type = a_type;
    v_texCoord = a_normCoords;
    if ( (u_mouseover > 0) && (u_mouseoverIdx == int(a_vertexID)) ) {
        v_mouseover = 1.1;       
    } else {
        v_mouseover = 0.0;
    }
    
    // if this vertex is part of a cloud, translate depending on u_clock
    vec3 position = a_position;
    if ( (a_type > 2.9) && (a_type < 3.1) ) {
        position.x += 0.02 * angle(a_velocity.x, u_clock); 
        position.y += 0.01 * angle(a_velocity.y, u_clock);
    }

    gl_Position = vec4(position.xyz, 1) + u_translate;
}
END

@@ fragment shader
precision highp float;
precision lowp int;

uniform sampler2D u_stumble;
uniform sampler2D u_video;
uniform sampler2D u_random;
uniform sampler2D u_cloud;
uniform int u_clock;
uniform int u_blackout;

varying vec2 v_texCoord;
varying float v_this_type;
varying float v_mouseover;

float rand(vec2 co){
    return fract(sin(dot(co.xy, vec2(12.9898,78.233))) * 43758.5453);
}

void main()
{
    highp vec4 color;
    
    float clock = float(u_clock);
    vec3 white = vec3(1.0, 1.0, 1.0);
    vec3 black = vec3(0.0, 0.0, 0.0);
    
    if (u_blackout == 0) {
        
        // select appropriate texture
        if (v_this_type < 0.1) {
            color = texture2D(u_random, v_texCoord);
        } else if ((v_this_type > 0.9) && (v_this_type < 1.1)) {
            color = texture2D(u_video, v_texCoord);
        } else if ((v_this_type > 1.9) && (v_this_type < 2.1)) {
            color = texture2D(u_stumble, v_texCoord);
        } else if ((v_this_type > 2.9 && v_this_type < 3.1)) {
            color = texture2D(u_cloud, v_texCoord);
        }
        
        // handle mouseover events
        if (v_mouseover > 1.0) {
            if ( mod(clock, 3.0) == 1.0 )  { // will only be true occasionally
                color.a = 0.0;         
            } 
            if ( mod(gl_FragCoord.y + clock, 3.0) < mod(clock / rand(vec2(clock, clock)), 3.0) ) {
                if (color.a > 0.01) {
                    color = vec4(white, 0.5);
                }
            }
        }
    } else {
        if (v_mouseover < 1.0) {
            color = vec4(black, 1.0);
        } else {
            color = vec4(white, mod(clock / 5000.0, 1.0));
        }
    }
    gl_FragColor = color;
}
END
