@@ vertex shader
attribute vec2 position;
attribute vec2 a_vUv;

varying vec2 v_vUv;

void main()
{
    gl_Position = vec4(position, 0, 1);
    v_vUv = a_vUv;
}
END

@@ fragment shader
precision highp float;

uniform sampler2D u_vid;
uniform float u_threshold;

varying vec2 v_vUv;

void main() 
{
    highp vec4 texel = texture2D(u_vid, vec2(v_vUv.s, v_vUv.t));
    float luma = 0.2126 * texel.r + 0.7152 * texel.g + 0.0722 * texel.b;
    vec4 color_out;
    if (luma < 0.1) {
        color_out = vec4(0, 0, 0, 0);
    } else {
        color_out = vec4(0, 0, 0, 1);
    }
    gl_FragColor = color_out;
}
END
