@@ vertex shader
precision lowp int;

//IDs
attribute float a_hash;
attribute float a_type;

//coordinates
attribute vec2 a_model;
attribute vec2 a_container;
attribute vec2 a_uv;

//for cloud particles
attribute vec2 a_velocity;

uniform vec2 u_translate;
uniform vec2 u_viewport; // viewport size in pixels
uniform int u_clock;

varying float v_hash;
varying float v_type;
varying vec2 vUv;

float angle(float velocity, int clock) 
{
    float pi = 3.1415927;
    return sin((mod(float(clock), 2500.0) / 2500.0) * (2.0 * pi) * velocity);
}

void main() 
{
    v_hash = a_hash;
    v_type = a_type;
    vUv = a_uv;

    vec4 position = vec4(a_model + a_container + u_translate, 0, 1);
    position.x = ((position.x / u_viewport.x) * 2.0) - 1.0;
    position.y = (((position.y - 25.0) / u_viewport.y) * -2.0) + 1.0;
    
    // if this vertex is part of a cloud, translate depending on u_clock
    if ( (a_type > 2.9) && (a_type < 3.1) ) {
        position.x += 0.02 * angle(a_velocity.x, u_clock); 
        position.y += 0.01 * angle(a_velocity.y, u_clock);
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
varying vec2 vUv;

void main()
{
    mediump vec4 color;
    
    // select appropriate texture
    if (v_type < 0.1) {
        color = texture2D(u_random, vUv);
    } else if ((v_type > 0.9) && (v_type < 1.1)) {
        color = texture2D(u_video, vUv);
    } else if ((v_type > 1.9) && (v_type < 2.1)) {
        color = texture2D(u_stumble, vUv);
    } else if ((v_type > 2.9 && v_type < 3.1)) {
        color = texture2D(u_cloud, vUv);
    }
    gl_FragColor = color;
}
END
