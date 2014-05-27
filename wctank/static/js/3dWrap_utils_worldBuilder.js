//contains methods for fetching locations, building enviornments,
//and keeping track of position in lat, lng
//TODO: mapping textures to cube may produce better results closer to walls?
var Ü = (function(Ü) {
	
	Ü._utils = Ü._utils || {};
	Ü._utils.worldBuilder = {};

	var	current_location = {},
		
		world_loader = new GSVPANO.PanoLoader(),
		world_width = 0,
		world_height = 0, 
		world_texture = {},
		world_material = {},
		world_sphere = new THREE.SphereGeometry(10000, 255, 255),
		world = {},
		
		depth_loader = new GSVPANO.PanoDepthLoader(),
		depths_width = 0,
		depths_height = 0,
		depths = [],
		displacement_map = {};
		
			world_sphere.computeTangents();
			world_loader.setZoom(4);
  	
  	//gets goog latlng object
  	Ü._utils.worldBuilder.setLocation = function(lat_lng) {
  		current_location = lat_lng;
  		world_loader.load(current_location);
  	};
	
	world_loader.onPanoramaLoad = function() {
		world_width = this.canvas[0].width;
		world_height = this.canvas[0].height;
		world_texture = new THREE.Texture(this.canvas[0]);
        depth_loader.load(this.panoId);

	};
	
	function makeDisplacementMap() {
		
		var canvas = document.createElement('canvas');
			canvas.width = depths_width;
			canvas.height = depths_height;
		
		var	ctx = canvas.getContext('2d'),
			did = ctx.createImageData(canvas.width, canvas.height);
					
		for ( i = 0 ; i < depths.length; i++ ) {
			var q = depths[i] / 200 * 255; 
			var x = i*4;
			did.data[x] = did.data[x+1] = did.data[x+2] = q;
			did.data[x+3] = 255;
		}
		
		ctx.putImageData(did, 0, 0);
		displacement_map = new THREE.Texture(canvas);
	}
	
	THREE.ShaderMaterial.prototype.map = null;
	THREE.ShaderMaterial.prototype.tDisplacement = null;
	
	function makeWorldMaterial() {
		
		var shader = Ü._utils.shaders.basicDisplacement;
		var uniforms = THREE.UniformsUtils.clone(shader.uniforms);
		
		//TODO: bind object references to uniforms
		uniforms["enableDisplacement"].value = true;
		uniforms["map"].value = world_texture;
		uniforms["tDisplacement"].value = displacement_map;
		uniforms["uDisplacementBias"].value = 100;
		uniforms["uDisplacementScale"].value = 10000;
				
		world_material = new THREE.ShaderMaterial({	uniforms: uniforms, 
												fragmentShader: shader.fragmentShader,
												vertexShader: shader.vertexShader,
                                              	map: world_texture,
												tDisplacement: displacement_map	
												});
	}
	
	depth_loader.onDepthLoad = function() {
		depths_width = this.depthMap.width;
		depths_height = this.depthMap.height;
		depths = this.depthMap.depthMap;
		
		makeDisplacementMap();
		makeWorldMaterial();
		
		world = new THREE.Mesh(	world_sphere, world_material );
       	world.material.map.needsUpdate = true;
       	world.material.tDisplacement.needsUpdate = true;
		world.scale.x = -1;
		Ü._getScene().add(world); 
	};
	
	return Ü;
	
}(Ü || {}));
