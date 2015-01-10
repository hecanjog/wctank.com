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

varying float v_clock;
varying float v_hash;
varying float v_type;
varying vec2 vUv;

float rand(vec2 co)
{
    float a = 1.9898;
    float b = 78.233;
    float c = 43758.5453;
    float dt = dot(co.xy, vec2(a, b));
    float sn = mod(dt, 3.14);
    return fract(sin(sn) * c);
}

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
    v_clock = float(u_clock);

    vec4 position = vec4(a_model + a_container + u_translate, 0, 1);
    position.x = ((position.x / u_viewport.x) * 2.0) - 1.0;
    position.y = (((position.y - 25.0) / u_viewport.y) * -2.0) + 1.0;
    
    // if this vertex is part of a cloud, translate depending on u_clock
    if ( (a_type > 2.9) && (a_type < 3.1) ) {
        position.x += 0.02 * angle(a_velocity.x, u_clock); 
        position.y += 0.01 * angle(a_velocity.y, u_clock);
    }

    float r = rand(vec2(v_clock, 2.0)) * 10000.0;
    if (int(mod(r, 10000.0)) == 0) position.y += 25.0; 

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

varying float v_clock;
varying float v_hash;
varying float v_type;
varying vec2 vUv;

float rand(vec2 co)
{
    float a = 1.9898;
    float b = 78.233;
    float c = 43758.5453;
    float dt = dot(co.xy, vec2(a, b));
    float sn = mod(dt, 3.14);
    return fract(sin(sn) * c);
}

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

    // global activities
    float r = rand(vec2(v_clock, 1.2)) * 10000.0;
    int select = int(rand(gl_FragCoord.xy) * 3.0);
    if (int(mod(v_clock, r)) == 0) {
        if (select == 0) color = vec4(1, 0, 0, 1);
        if (select == 1) color = vec4(0, 1, 0, 1);
        if (select == 2) color = vec4(0, 0, 1, 1);
    }

    gl_FragColor = color;
}
END
