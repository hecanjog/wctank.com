@@ vertex shader
attribute vec2 position;

void main()
{
	gl_Position = vec4(position, 0, 1); 
}
END

@@ fragment shader
precision lowp float;
uniform float js_random;

float rand(vec2 co)
{
	float a = 12.9898;
	float b = 78.233;
	float c = 43758.5453;
	float dt = dot(co.xy, vec2(a, b));
	float sn = mod(dt, 3.14);
	return fract(sin(sn) * c);
}

void main(void)
{
	vec2 seed = vec2(gl_FragCoord.x + js_random, gl_FragCoord.y + js_random);
	float num = rand(seed);
	if (num > 0.5) {
		gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
	} else {
		gl_FragColor = vec4(0.0, 0.0, 0.0, 0.15);
	}    
}
END
