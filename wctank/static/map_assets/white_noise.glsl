@@ vertex shader
attribute vec2 position;

void main()
{
	gl_Position = vec4(position, 0, 1); 
}
END

@@ fragment shader
precision highp float;
uniform float clock;

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
	vec2 seed = vec2(gl_FragCoord.x + clock, gl_FragCoord.y + clock);
	float num = rand(seed);
	if (num > 0.5) {
		gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
	} else {
		gl_FragColor = vec4(0.1, 0.1, 0.1, 0.35);
	}    
}
END
