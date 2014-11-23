@@ vertex shader
attribute vec2 position;

void main()
{
	gl_Position = vec4(position, 0, 1); 
}
END

@@ fragment shader
precision lowp float;
uniform float time;
uniform float js_random;
uniform int idle;

float rand(vec2 co)
{
	float a = 1.9898;
	float b = 78.233;
	float c = 43758.5453;
	float dt = dot(co.xy, vec2(a, b));
	float sn = mod(dt, 3.14);
	return fract(sin(sn) * c);
}

void main(void)
{
	vec4 color;
	float time_rand = rand(vec2(time, time));
	float num = rand( vec2(gl_FragCoord.x + js_random, gl_FragCoord.y + js_random) );	
	float time_mod = mod(time + 2000.0, 30000.0);
	float varient = time_mod * time_mod;
	float clr = 0.2 * time_rand;
	if (idle == 1) {
		if ( rand(gl_FragCoord.xy * varient) < 0.01 ) color = vec4(clr, clr, clr, 0.40);
	} else if (num < 0.5) { 
		color = vec4(0, 0, 0, 0.25);	
	}
	gl_FragColor = color;
}
END
