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
	
	var scope = this;
		
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
			
	}({}));		
		
	var makeCube = function(callback) { 
			
		var cube_half = unit_diameter / 2;
		var fnum = 6 - scope.knockouts.length;	
			
		//get map and displacement panos
		var panos = sphere.getPanos();
		var raw = [];
		var sides = [];							
		var meshes = [];
		
		Ü._.project.sphereToCube(panos, function(arr) {
			raw = arr;
			construct();
		});	
		
		function makeSideMesh(img) {
			var tex = new THREE.Texture(img);
			var mat = new THREE.MeshBasicMaterial({map: tex, transparent: true});
			var geo = new THREE.PlaneGeometry(unit_diameter, unit_diameter, 1, 1);
			var mesh = new THREE.Mesh(geo, mat);
			mesh.material.map.needsUpdate = true;
			return mesh;
		}
		
		var check_in = 0;
		function sideProcess(canv, idxid) {
			if(canv) {
				Ü._.imageOps.cannyEdge(canv)
					.also(Ü._.imageOps.alphaIntersect('sdat', 'cdat', false))
					.then(function(img) {
						meshes[idxid] = makeSideMesh(img);
						check_in++;
						if (check_in === 6) addToScene();
					});
			} else {
				check_in++;
				if (check_in === 6) addToScene();
			}
		}
		
		function construct() {
			for (var i = 0; i < 6; i++) {
				if (scope.knockouts.indexOf(i) === -1) {
					sides[i] = raw[i];
				} else {
					sides[i] = false;
				}
			}
			for (var i = 0; i < 6; i++) {
				sideProcess(sides[i], i);	
			}
		}
		
		function addToScene() {
			for (var i = 0; i < meshes.length; i++) {
				if (meshes[i]) {
					switch (i) {
						case 0: //-x
							meshes[i].rotation.y = Math.PI / 2;
							meshes[i].position.x = -cube_half;
							scope.unit.add(meshes[i]);
							break;
						case 1: //+x
							meshes[i].rotation.y = -Math.PI / 2;
							meshes[i].position.x = cube_half;
							scope.unit.add(meshes[i]);
							break;
						case 2: //-y
							meshes[i].rotation.x = -Math.PI / 2;
							meshes[i].rotation.z = 0.5 * Math.PI;
							meshes[i].position.y = -cube_half;
							scope.unit.add(meshes[i]);
							break;
						case 3: //+y
							meshes[i].rotation.x = Math.PI / 2;
							meshes[i].rotation.z = -Math.PI / 2;
							meshes[i].position.y = cube_half;
							scope.unit.add(meshes[i]);
							break;
						case 4: //-z
							meshes[i].position.z = -cube_half;
							scope.unit.add(meshes[i]);
							break;
						case 5: //+z
							meshes[i].rotation.y = Math.PI;
							meshes[i].position.z = cube_half;
							scope.unit.add(meshes[i]);
							break;
					}
				}
			}
			callback();	
		}	
		
	};
		
	loader.load(this.location);						
	loader.onPanoramaLoad = function() {
		sphere.setMapData(this.canvas[0]);
       	makeCube(scope.callback);
	};
					
};
