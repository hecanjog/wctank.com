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
	
Ü._.UnitBuilder = function(lat, lng, knockout, callback) {	
		
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
				
	//object to stage GSV data before transforms
	var sphere = (function(sphere) {
			
		var map_height = 0;
		var map_width = 0;
		var map_pano = {};
		
		sphere.setMapData = function(mpano) {
			map_height = mpano.height;
			map_width = mpano.width;
			map_pano = mpano;
		};
		
		sphere.getPanos = function() {
			return map_pano;
		};
							
		return sphere;
			
	})({});		
		
	var makeCube = function() { 
				
		var cube_half = unit_diameter / 2;
		var fnum = 6 - that.knockouts.length;	
			
		//get map and displacement panos
		var panos = sphere.getPanos();
		
		var map_proj = Ü._.project.sphereToCube(panos);
		
		/*
		Ü._.project.sphereToCube(panos, function(arr) {
			for (var i = 0; i < arr.length; i++) {
				document.body.appendChild(arr[i]);
			}
		});*/
		//document.body.appendChild(map_proj[1]);
		//document.body.appendChild(Ü._.imageOps.copy(map_proj[1]));
		
		var map_set = [];							
		var ctr = 0;
		for (var i = 0; i < 6; i++) {
			if (that.knockouts.indexOf(i) === -1) {
				map_set[ctr] = map_proj[i];
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
		}
			
		//make textures
		var map_textures = [];
		for (var i = 0; i < fnum; i++) {
			map_textures[i] = new THREE.Texture(map_faces[i]);
		}
						
		var face_materials = [];			
		for (var i = 0; i < fnum; i++) {
			face_materials[i] = new THREE.MeshBasicMaterial(
				{map: map_textures[i],
				transparent: true});
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
       	
       	makeCube();
       	
       	//execute callback, if any	
		if(that.callback && (typeof that.callback === "function")) {
			that.callback();
		} else if (that.callback && (typeof that.callback !== "function")) {
			throw "invalid unitBuilder callback!!";
		}
	};
					
};
