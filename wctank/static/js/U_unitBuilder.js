/*
 * Ü._.unitBuilder builds world unit cubes!
 * !!!!!!!!!!!!!!!This is going to change ALOT very soon, so don't 
 * count on anything here sticking around!!!!!!!!!!!!!!
 * 
 * makes this.unit on construction
 * gets numbers lat, lng, array 'knockout'
 * 
 * KNOCKOUT: an array of numbers indicating which faces NOT to construct
 * possible values: 
 * 		0 = x negative
 * 		1 = x positive
 * 		2 = y negative
 * 		3 = y positive
 * 		4 = z negative
 * 		5 = z positive
 * 
 * holds unit cube
 * holds location data (as google.maps.LatLng object)
 * holds knockout data
 * 
 * e.g.
 * var unit = new Ü._.unitBuilder(43.038706, -87.907486, ['z_neg']);
 * scene.add(unit.cube)
 * var where_am_I = [unit.location.lat(), unit.location.lng()];
 */

var Ü = Ü || {}; /*_utils_*/ Ü._ = Ü._ || {};
	
Ü._.unitBuilder = function(lat, lng, knockout, callback) {	
		
	var unit_diameter = 1000;
		
	this.unit = new THREE.Object3D();
	this.location = new google.maps.LatLng(lat, lng);
	this.knockouts = knockout;
	this.callback = callback; //called after unit is complete
		
	var that = this;
		
	var loader = new GSVPANO.PanoLoader();
		
	//TODO: adjust according to max texture size of host
	//need to adjust canny thresholds with texture size	
	loader.setZoom(3);
		
	var d_loader = new GSVPANO.PanoDepthLoader();
		
	//object to stage GSV data before transforms
	var sphere = (function(sphere) {
			
		var map_height = 0;
		var map_width = 0;
		var map_pano = {};
				
		var disp_height = 0;
		var disp_width = 0;
		var disp_depths = [];
		var disp_pano = {};
							
		sphere.setMapData = function(mpano) {
			map_height = mpano.height;
			map_width = mpano.width;
			map_pano = mpano;
		};
				
		sphere.setDispDataAndMakeMap = function(dheight, dwidth, ddepths) { 
			disp_height = dheight;
			disp_width = dwidth;
			disp_depths = ddepths;
					
			disp_pano = Ü._.imageOps.makeDisplacementMap(disp_depths, disp_width, disp_height);
		};
				
		sphere.getPanos = function() {
			return [map_pano, disp_pano];
		};
							
		return sphere;
			
	})({});		
		
	var makeCube = function() { 
				
		var cube_half = unit_diameter / 2;
		var fnum = 6 - that.knockouts.length;	
			
		//get map and displacement panos
		var panos = sphere.getPanos();
			
		var map_proj = Ü._.project.sphereToCube(panos[0]);
		var disp_proj = Ü._.project.sphereToCube(panos[1]);
		
		var map_set = [];
		var disp_faces = [];
			
		var ctr = 0;
		for (var i = 0; i < 6; i++) {
			if (that.knockouts.indexOf(i) === -1) {
				map_set[ctr] = map_proj[i];
				disp_faces[ctr] = disp_proj[i];
				ctr++;
			}
		}
			
		var map_canny = [];
		for (var i = 0; i < fnum; i++) {
			map_canny[i] = Ü._.imageOps.cannyEdge(map_set[i]);
		}
			
		var map_faces = [];
		for (var i = 0; i < fnum; i++) {
			map_faces[i] = Ü._.imageOps.alphaIntersect(map_set[i], map_canny[i]);
			//map_faces[i] = Ü._.imageOps.alphaIntersect(map_set[i], disp_faces[i], true);
		}
			
		//make textures
		var map_textures = [];
		var disp_textures = [];
		for (var i = 0; i < fnum; i++) {
			map_textures[i] = new THREE.Texture(map_faces[i]);
			disp_textures[i] = new THREE.Texture(disp_faces[i]);
		}
			
		THREE.ShaderMaterial.prototype.map = null;
		THREE.ShaderMaterial.prototype.tDisplacement = null;
			
		var face_materials = [];			
		for (var i = 0; i < fnum; i++) {
				
			var shader = Ü._.shaders.basicDisplacement;
			var uniforms = THREE.UniformsUtils.clone(shader.uniforms);
					
			//TODO: bind object references to uniforms	
			uniforms["enableDisplacement"].value = true;
			uniforms["map"].value = map_textures[i];
			uniforms["tDisplacement"].value = disp_textures[i];
			uniforms["uDisplacementBias"].value = 0;
			uniforms["uDisplacementScale"].value =0;

			face_materials[i] = new THREE.ShaderMaterial({	
				uniforms: uniforms, 
				fragmentShader: shader.fragmentShader,
				vertexShader: shader.vertexShader,
				map: map_textures[i],
				tDisplacement: disp_textures[i],
				transparent: true	});
		}
			
		//make planes
		var planes = [];
		for (var i = 0; i < fnum; i++) {
			planes[i] = new THREE.PlaneGeometry(unit_diameter, unit_diameter, 1, 1);
		}
				
		//make meshes
		var meshes = [];
		for (var i = 0; i < fnum; i++) {
			meshes[i] = new THREE.Mesh(planes[i], face_materials[i]);
			meshes[i].material.map.needsUpdate = true;
			meshes[i].material.tDisplacement.needsUpdate = true;
		}
			
		//assemble cube
		var octr = 0;
		for (var i = 0; i < 6; i++) {
				
			if (that.knockouts.indexOf(i) === -1) {
					
				switch (i) {
					case 0: //-x
						meshes[octr].rotation.y = Math.PI / 2;
						meshes[octr].position.x = -cube_half;
						break;
					case 1: //+x
						meshes[octr].rotation.y = -Math.PI / 2;
						meshes[octr].position.x = cube_half;
						break;
					case 2: //-y
						meshes[octr].rotation.x = -Math.PI / 2;
						meshes[octr].rotation.z = 0.5 * Math.PI;
						meshes[octr].position.y = -cube_half;
						break;
					case 3: //+y
						meshes[octr].rotation.x = Math.PI / 2;
						meshes[octr].rotation.z = -Math.PI / 2;
						meshes[octr].position.y = cube_half;
						break;
					case 4: //-z
						meshes[octr].position.z = -cube_half;
						break;
					case 5: //+z
						meshes[octr].rotation.y = Math.PI;
						meshes[octr].position.z = cube_half;
						break;
				}
					
				that.unit.add(meshes[octr]);
				octr++;
			
			}
				
		}
			
	};
		
	loader.load(this.location);						
	loader.onPanoramaLoad = function() {
		sphere.setMapData(this.canvas[0]);
       	d_loader.load(this.panoId);  	
	};
	d_loader.onDepthLoad = function() {
		sphere.setDispDataAndMakeMap(	
			this.depthMap.height,
			this.depthMap.width,
			this.depthMap.depthMap	);	
					
		makeCube();
		
		//execute callback, if any	
		if(that.callback && (typeof that.callback === "function")) {
			that.callback();
		} else if (that.callback && (typeof that.callback !== "function")) {
			throw "invalid unitBuilder callback!!";
		}
					
	};
				
};
