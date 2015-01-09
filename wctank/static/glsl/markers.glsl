@@ vertex shader
precision lowp int;

attribute float a_hash;
attribute float a_type;
attribute vec2 a_modelCoord;
attribute vec2 a_containerPosition;
attribute vec2 a_vUv;
attribute vec2 a_angularVelocity;

uniform vec2 u_translate;
uniform vec2 u_viewport;
uniform int u_clock;

varying float v_hash;
varying float v_type;
varying vec2 v_vUv;

float angle(float velocity, int clock) 
{
    float pi = 3.1415927;
    return sin( (mod( float(clock), 2500.0) / 2500.0) * (2.0 * pi) * velocity ); // 4200
}

void main() 
{
    // handle varyings
    v_hash = a_hash;
    v_type = a_type;
    v_vUv = a_vUv;
    vec4 position = vec4(a_modelCoord + a_containerPosition + u_translate, 0, 1);
    position.x = ((position.x / u_viewport.x) * 2.0) - 1.0;
    position.y = (((position.y - 25.0) / u_viewport.y) * -2.0) + 1.0;
    
    // if this vertex is part of a cloud, translate depending on u_clock
    if ( (a_type > 2.9) && (a_type < 3.1) ) {
        position.x += 0.02 * angle(a_angularVelocity.x, u_clock); 
        position.y += 0.01 * angle(a_angularVelocity.y, u_clock);
    }

    gl_Position = position;
}
END

@@ fragment shader
precision highp float;
precision lowp int;

uniform sampler2D u_stumble;
uniform sampler2D u_video;
uniform sampler2D u_random;
uniform sampler2D u_cloud;

varying float v_hash;
varying float v_type;
varying vec2 v_vUv;

float rand(vec2 co){
    return fract(sin(dot(co.xy, vec2(12.9898,78.233))) * 43758.5453);
}

void main()
{
    highp vec4 color;
    
    // select appropriate texture
    if (v_type < 0.1) {
        color = texture2D(u_random, v_vUv);
    } else if ((v_type > 0.9) && (v_type < 1.1)) {
        color = texture2D(u_video, v_vUv);
    } else if ((v_type > 1.9) && (v_type < 2.1)) {
        color = texture2D(u_stumble, v_vUv);
    } else if ((v_type > 2.9 && v_type < 3.1)) {
        color = texture2D(u_cloud, v_vUv);
    }
    gl_FragColor = color;
}
END
