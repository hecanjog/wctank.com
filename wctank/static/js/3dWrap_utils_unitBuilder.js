//contains methods for building world unit cubes
var Ü = (function(Ü) {
	
	Ü._utils = Ü._utils || {};
	
	Ü._utils.unitBuilder = function(lat, lng, knockouts) {	
		
		var cube = new THREE.Object3D();
		
		var location = new google.maps.LatLng(lat, lng);
		
		var	loader = new GSVPANO.PanoLoader();
			loader.setZoom(4);
		
		var d_loader = new GSVPANO.PanoDepthLoader();
		
		//object to stage pre qscp.transform -ed data
		var sphere = (function(sphere) {
			
			var map = (function(map) {
				var height = 0, width = 0, pano = {};	
				sphere.setMapData = function(mpano) {
					height = mpano.height;
					width = mpano.width;
					pano = mpano;
				};
				map.getDimensions = function() {
					return [height, width];
				};
				map.getPano = function() {
					return pano;
				};
				return map;
			})({});
			
			var disp = (function(disp) {
				var height = 0, width = 0, depths = [], pano = {};
				function makeDisplacementMap() {
					
					var canvas = document.createElement('canvas');
						canvas.height = height;
						canvas.width = width;
						
					var	ctx = canvas.getContext('2d'),
						did = ctx.createImageData(canvas.width, canvas.height);
					
					for ( i = 0 ; i < depths.length; i++ ) {
						var q = depths[i] / 200 * 255; 
						var x = i*4;
						did.data[x] = did.data[x+1] = did.data[x+2] = q;
						did.data[x+3] = 255;
					}
						ctx.putImageData(did, 0, 0);
						pano = canvas;
				}
				
				sphere.setDispDataAndMakeMap = function(dheight, dwidth, ddepths) {
					height = dheight;
					width = dwidth;
					depths = ddepths;
					
					makeDisplacementMap();
				};
				disp.getDimensions = function() {
					return [height, width];
				};
				disp.getPano = function() {
					return pano;
				};
				return disp;	
			})({});		

			sphere.getDimensions = function() {
				return [sphere.map.getDimensions(), sphere.disp.getDimensions()];
			};
			sphere.getPanos = function() {
				return [map.getPano(), disp.getPano()];
			};
			
			return sphere;	
			
		})({});
			
		/*
		 * ACTIONMAN assembles the world unit cube;
		 * it takes an array of strings indicating 
		 * which faces to knockout
		 * 
		 * possible values:
		 * y_pos, z_neg, x_neg, z_pos, x_pos, y_neg
		 */
		function ACTIONMAN (knockouts) { 
				
			var cube_width = 10000,
				cube_half = cube_width/2;
				
			//get map and displacement panos
			var panos = sphere.getPanos(),
				map_pano = panos[0],
				disp_pano = panos[1];
			
			document.body.appendChild(map_pano);
			document.body.appendChild(disp_pano);
			
			//get faces of cube
			var map_faces = Ü._utils.QSCP.transform(map_pano),
				disp_faces = Ü._utils.QSCP.transform(disp_pano);
			
			for (i = 0; i < 6; i++) {
				document.body.appendChild(map_faces[i]);
			}
			for (i = 0; i < 6; i++) {
				document.body.appendChild(disp_faces[i]);
			}			
			//make textures
			var map_textures = [],
				disp_textures = [];
			for (i = 0; i < 6; i++) {
				map_textures[i] = new THREE.Texture(map_faces[i]);
				disp_textures[i] = new THREE.Texture(disp_faces[i]);
			}
			
			THREE.ShaderMaterial.prototype.map = null;
			THREE.ShaderMaterial.prototype.tDisplacement = null;
			
			var face_materials = [];			
			for (i = 0; i < 6; i++) {
				
				var shader = Ü._utils.shaders.basicDisplacement;
				var uniforms = THREE.UniformsUtils.clone(shader.uniforms);
					
				//TODO: bind object references to uniforms	
				uniforms["enableDisplacement"].value = true;
				uniforms["map"].value = map_textures[i];
				uniforms["tDisplacement"].value = disp_textures[i];
				uniforms["uDisplacementBias"].value = 100;
				uniforms["uDisplacementScale"].value = 10000;

				face_materials[i] = new THREE.ShaderMaterial({	uniforms: uniforms, 
														fragmentShader: shader.fragmentShader,
														vertexShader: shader.vertexShader,
   	                                      				map: map_textures[i],
														tDisplacement: disp_textures[i]	});
				
			}
			
			//make planes
			var planes = [];
			for (i = 0; i < 6; i++) {
				planes[i] = new THREE.PlaneGeometry(cube_width, cube_width, 100, 100);
			}
				
			//make meshes
			var meshes = [];
			for (i = 0; i < 6; i++) {
				meshes[i] = new THREE.Mesh(planes[i], face_materials[i]);
				meshes[i].material.map.needsUpdate = true;
				meshes[i].material.tDisplacement.needsUpdate = true;
			}
				
			//assemble cube
			if (knockouts.indexOf('y_pos') === -1) {
				meshes[0].position.z = cube_half;
				meshes[0].rotation.x = Math.PI/2;
			}
			if (knockouts.indexOf('z_neg') === -1) {
				meshes[1].position.z = -cube_half;
			}
			if (knockouts.indexOf('x_neg') === -1) {
				meshes[2].position.z = cube_half;
				meshes[2].rotation.y = -Math.PI/2;
			}
			if (knockouts.indexOf('z_pos') === -1) {
				meshes[3].position.z = cube_half;
			}
			if (knockouts.indexOf('x_pos') === -1) {
				meshes[4].rotation.y = Math.PI/2;
			}
			if (knockouts.indexOf('y_neg') === -1) {
				meshes[5].position.z = -cube_half;
				meshes[5].rotation.x = Math.PI/2;
			}	
			for (i = 0; i < 6; i++) {
				cube.add(meshes[i]);
			}
		};
		loader.load(location);						
		loader.onPanoramaLoad = function() {
			sphere.setMapData(this.canvas[0]);
     	   	d_loader.load(this.panoId);  	
		};
		d_loader.onDepthLoad = function() {
			sphere.setDispDataAndMakeMap(	this.depthMap.height,
											this.depthMap.width,
											this.depthMap.depthMap	);	
			ACTIONMAN(knockouts);	
			//cube.scale.x = -1;	
		};

		return cube;	
		
	};
		
	return Ü;
	
}(Ü || {}));
