@@ vertex shader
uniform mat4 ProjectionMatrix;
uniform mat4 ModelViewMatrix;
attribute vec4 Vertex;

void main()
{
	gl_Position = ProjectionMatrix * ModelViewMatrix * Vertex; 
}
END

@@ fragment shader
precision highp float;
uniform float perf_time;

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
	vec2 seed = vec2(gl_FragCoord.x + perf_time, gl_FragCoord.y + perf_time);
	float num = rand(seed);
	if (num > 0.5) {
		gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
	} else {
		gl_FragColor = vec4(0.75, 0.75, 0.75, 0.40);
	}    
}
END
