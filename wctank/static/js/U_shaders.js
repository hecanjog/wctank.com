//TODO: remove cruft!!!!
var Ü = Ü || {}; /*_utils_*/ Ü._ = Ü._ || {};

Ü._.shaders = {

	basicDisplacement: {

		uniforms: THREE.UniformsUtils.merge( [
			
			THREE.UniformsLib[ "common" ],
			THREE.UniformsLib[ "fog" ],
			THREE.UniformsLib[ "shadowmap" ],
			
			{
			
			"enableDisplacement": { type: "i", value: 0 },
			"tDisplacement": { type: "t", value: null }, // must go first as this is vertex texture
			"uDisplacementBias": { type: "f", value: 0.0 },
			"uDisplacementScale": { type: "f", value: 1.0 },

			}
			
		] ),

		vertexShader: [
		
			"uniform bool enableDisplacement;",
			
			"#ifdef VERTEX_TEXTURES",

			"	uniform sampler2D tDisplacement;",
			"	uniform float uDisplacementScale;",
			"	uniform float uDisplacementBias;",

			"#endif",

			THREE.ShaderChunk[ "map_pars_vertex" ],
			THREE.ShaderChunk[ "lightmap_pars_vertex" ],
			THREE.ShaderChunk[ "envmap_pars_vertex" ],
			THREE.ShaderChunk[ "color_pars_vertex" ],
			THREE.ShaderChunk[ "morphtarget_pars_vertex" ],
			THREE.ShaderChunk[ "skinning_pars_vertex" ],
			THREE.ShaderChunk[ "shadowmap_pars_vertex" ],
			THREE.ShaderChunk[ "logdepthbuf_pars_vertex" ],
	
			"varying vec3 vWorldPosition;",
			"varying vec3 vViewPosition;",

			"void main() {",

				THREE.ShaderChunk[ "map_vertex" ],
				THREE.ShaderChunk[ "lightmap_vertex" ],
				THREE.ShaderChunk[ "color_vertex" ],
				THREE.ShaderChunk[ "skinbase_vertex" ],

			"	#ifdef USE_ENVMAP",

				THREE.ShaderChunk[ "morphnormal_vertex" ],
				THREE.ShaderChunk[ "skinnormal_vertex" ],

			"	#endif",

				THREE.ShaderChunk[ "morphtarget_vertex" ],
				THREE.ShaderChunk[ "skinning_vertex" ],
				THREE.ShaderChunk[ "logdepthbuf_vertex" ],

				THREE.ShaderChunk[ "worldpos_vertex" ],
				THREE.ShaderChunk[ "envmap_vertex" ],
				THREE.ShaderChunk[ "shadowmap_vertex" ],
				// displacement mapping
	
			"	vec3 displacedPosition;",

			"	#ifdef VERTEX_TEXTURES",

			"		if ( enableDisplacement ) {",

			"			vec3 dv = texture2D( tDisplacement, uv ).xyz;",
			"			float df = uDisplacementScale * dv.x + uDisplacementBias;",
			"			displacedPosition = position + normalize( normal ) * df;",

			"		}",
			"	#endif",
					//

			"	vec4 mvPosition = modelViewMatrix * vec4( displacedPosition, 1.0 );",
			"	vec4 worldPosition = modelMatrix * vec4( displacedPosition, 1.0 );",

			"	gl_Position = projectionMatrix * mvPosition;",

			"	vWorldPosition = worldPosition.xyz;",
			"	vViewPosition = -mvPosition.xyz;",

				// shadows

			"	#ifdef USE_SHADOWMAP",

			"		for( int i = 0; i < MAX_SHADOWS; i ++ ) {",

			"			vShadowCoord[ i ] = shadowMatrix[ i ] * worldPosition;",

			"		}",

			"	#endif",

			"}"

		].join("\n"),

		fragmentShader: [

			"uniform vec3 diffuse;",
			"uniform float opacity;",

			THREE.ShaderChunk[ "color_pars_fragment" ],
			THREE.ShaderChunk[ "map_pars_fragment" ],
			THREE.ShaderChunk[ "lightmap_pars_fragment" ],
			THREE.ShaderChunk[ "envmap_pars_fragment" ],
			THREE.ShaderChunk[ "fog_pars_fragment" ],
			THREE.ShaderChunk[ "shadowmap_pars_fragment" ],
			THREE.ShaderChunk[ "specularmap_pars_fragment" ],
			THREE.ShaderChunk[ "logdepthbuf_pars_fragment" ],

			"void main() {",

			"	gl_FragColor = vec4( diffuse, opacity );",

				THREE.ShaderChunk[ "logdepthbuf_fragment" ],
				THREE.ShaderChunk[ "map_fragment" ],
				THREE.ShaderChunk[ "alphatest_fragment" ],
				THREE.ShaderChunk[ "specularmap_fragment" ],
				THREE.ShaderChunk[ "lightmap_fragment" ],
				THREE.ShaderChunk[ "color_fragment" ],
				THREE.ShaderChunk[ "envmap_fragment" ],
				THREE.ShaderChunk[ "shadowmap_fragment" ],

				THREE.ShaderChunk[ "linear_to_gamma_fragment" ],

				THREE.ShaderChunk[ "fog_fragment" ],

			"}"

		].join("\n")
	}
};