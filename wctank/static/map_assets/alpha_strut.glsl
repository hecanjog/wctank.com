@@ vertex shader
attribute vec2 position;
attribute vec2 texCoord;
varying highp vec2 texMapCoord;

void main()
{
    gl_Position = vec4(position, 0, 1);
    texMapCoord = texCoord;
}
END

@@ fragment shader
precision highp float;
varying highp vec2 texMapCoord;
uniform sampler2D vidTexels;
uniform float threshold;

void main() 
{
    
    highp vec4 texel = texture2D(vidTexels, vec2(texMapCoord.s, texMapCoord.t));
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