@@ vertex shader
attribute float a_id;
attribute vec2 a_position;

varying float v_id;

void main()
{
    v_id = a_id;
    gl_Position = vec4(a_position, 0, 1);
}
END

@@ fragment shader
precision mediump float;

varying float v_id;

uniform vec3 u_colors[6];
uniform int u_time;
uniform float u_alpha;

void main()
{
    int idx = int( mod(float(u_time) + v_id, 6.0) );

    vec4 color;
    for (int i = 0; i < 12; i++) {
        if (i == idx) {
            color = vec4(u_colors[i], mod(float(u_time), 2.0) * u_alpha);
        }
    }
    gl_FragColor = color;
}
END
