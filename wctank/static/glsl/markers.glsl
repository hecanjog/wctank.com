@@ vertex shader
attribute vec2 a_position;
attribute float a_type;

varying float this_type;

void main() 
{
    this_type = a_type;
    gl_Position = vec4(a_position.xy, 0, 1);
}

END

@@ fragment shader
precision lowp float;

varying float this_type;

void main()
{
    //vec4 color = texture2D(sampler2d, texCoord);
    vec4 color;
    if (this_type < 0.1) {
        color = vec4(0.0, 0.0, 0.0, 1.0);
    } else if ((this_type > 0.9) && (this_type < 1.1)) {
        color = vec4(1.0, 0.0, 0.0, 1.0);
    } else if ((this_type > 1.9) && (this_type < 2.1)) {
        color = vec4(0.0, 0.0, 1.0, 1.0);
    }
    gl_FragColor = color;
}

END
