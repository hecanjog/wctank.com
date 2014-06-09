/*
 * Ü._utils.unitBuilder builds world unit cubes!
 * 
 * makes this.cube on construction
 * gets numbers lat, lng, array 'knockout'
 * 
 * KNOCKOUT: an array of strings indicating which faces NOT to construct
 * possible values: y_pos, z_neg, x_neg, z_pos, x_pos, y_neg (order not important)
 * 
 * holds unit cube
 * holds location data (as google.maps.LatLng object)
 * holds knockout data
 * 
 * e.g.
 * var unit = new Ü._utils.unitBuilder(43.038706, -87.907486, ['z_neg']);
 * scene.add(unit.cube)
 * var where_am_I = [unit.location.lat(), unit.location.lng()];
 * 
 */

var Ü = (function(Ü) {
	
	Ü._utils = Ü._utils || {};
	
	Ü._utils.unitBuilder = function(lat, lng, knockout) {	
		
		this.cube = new THREE.Object3D();
		this.location = new google.maps.LatLng(lat, lng);
		this.knockouts = knockout;
		
		var that = this;
		
		var loader = new GSVPANO.PanoLoader();
			loader.setZoom(3);
		
		var d_loader = new GSVPANO.PanoDepthLoader();
		
		//object to stage pre qscp.transform -ed data
		var sphere = (function(sphere) {
			var map_height = 0,
			map_width = 0,
			map_pano = {};
			
			var disp_height = 0,
			disp_width = 0,
			disp_depths = [],
			disp_pano = {};
							
				sphere.setMapData = function(mpano) {
					map_height = mpano.height;
					map_width = mpano.width;
					map_pano = mpano;
				};
				sphere.setDispDataAndMakeMap = function(dheight, dwidth, ddepths) { 
					disp_height = dheight;
					disp_width = dwidth;
					disp_depths = ddepths;
					
					makeDisplacementMap();
				};
				sphere.getPanos = function() {
					return [map_pano, disp_pano];
				};
				
				var little_endian = Ü._utils.littleEndian;
				function makeDisplacementMap() {
					
					var canvas = document.createElement('canvas');
						canvas.width = disp_width;
						canvas.height = disp_height;
						
					var	width = canvas.width,
						height = canvas.height,
						ctx = canvas.getContext('2d'),
						dat = ctx.createImageData(canvas.width, canvas.height),
						px = new Int32Array(dat.data.buffer);
					
					for (i = 0; i < disp_depths.length; i++) {
						var in2d = disp_depths[i],
							q = 0;
						
						if(in2d > 255) {
							q = 255;
						} else {
							q = in2d / 200 * 255;
						}
						
						if (little_endian) {
							px[i] = (255 << 24) | (q << 16) | (q << 8) | q;
						} else {
							px[i] = (q << 24) | (q << 16) | (q << 8) | 255;
						}

					}
						ctx.putImageData(dat, 0, 0);
						disp_pano = canvas;
				}
			
			return sphere;
			
		})({});		
			
		var makeCube = function() { 
				
			var cube_width = 10000,
				cube_half = cube_width/2;
				
			//get map and displacement panos
			var panos = sphere.getPanos(),
				map_pano = panos[0],
				disp_pano = panos[1];
			
			//get faces of cube
			var map_faces = Ü._utils.project.eq2Cube.transCanvas(map_pano),
				disp_faces = Ü._utils.project.eq2Cube.transCanvas(disp_pano);
			
			/*****************	DEBUG CANVASES	**********************/
			$("body").append("<h1>PANORAMA FROM GOOG MAPS</h1>");
			document.body.appendChild(map_pano);
			$("body").append("<h1>~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~</h1><br>");
			$("body").append("<h1>DEPTH MAP</h1>");
			document.body.appendChild(disp_pano);
			$("body").append("<h1>~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~</h1><br>");
			$("body").append("<h1>FACES OF PANORAMA CUBE</h1><br>");
			for (i = 0; i < 6; i++) {
				$("body").append("<h1>FACE "+i+"</h1>");
				document.body.appendChild(map_faces[i]);
				$("body").append("______________<br>");
			}
			$("body").append("<h1>~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~</h1><br>");
			$("body").append("<h1>FACES OF DEPTH CUBE</h1><br>");
			for (i = 0; i < 6; i++) {
				$("body").append("<h1>FACE "+i+"</h1>");
				document.body.appendChild(disp_faces[i]);
				$("body").append("___________<br>");
			}		
			/*********************************************************/
			
				
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
				uniforms["uDisplacementBias"].value = 0;
				uniforms["uDisplacementScale"].value = 0;

				face_materials[i] = new THREE.ShaderMaterial({	
							uniforms: uniforms, 
							fragmentShader: shader.fragmentShader,
							vertexShader: shader.vertexShader,
							map: map_textures[i],
							tDisplacement: disp_textures[i]	});
			}
			
			//make planes
			var planes = [];
			for (i = 0; i < 6; i++) {
				planes[i] = new THREE.PlaneGeometry(cube_width, cube_width, 1, 1);
			}
				
			//make meshes
			var meshes = [];
			for (i = 0; i < 6; i++) {
				meshes[i] = new THREE.Mesh(planes[i], face_materials[i]);
				meshes[i].material.map.needsUpdate = true;
				meshes[i].material.tDisplacement.needsUpdate = true;
			}
				
			//assemble cube
			if (that.knockouts.indexOf('x_neg') === -1) {
				meshes[0].rotation.y = Math.PI/2;
  				meshes[0].position.x = -cube_half;
  				that.cube.add(meshes[0]);
			}
			if (that.knockouts.indexOf('x_pos') === -1) {
				meshes[1].rotation.y = -Math.PI/2;
  				meshes[1].position.x = cube_half;
  				that.cube.add(meshes[1]);
			}
			if (that.knockouts.indexOf('y_neg') === -1) {
				meshes[2].rotation.x = -Math.PI/2;
  				meshes[2].position.y = -cube_half;
  				that.cube.add(meshes[2]);
			}
			if (that.knockouts.indexOf('y_pos') === -1) {
				meshes[3].rotation.x = Math.PI/2;
  				meshes[3].position.y = cube_half;
  				that.cube.add(meshes[3]);
			}
			if (that.knockouts.indexOf('z_neg') === -1) {
				meshes[4].position.z = -cube_half;
  				that.cube.add(meshes[4]);
			}
			if (that.knockouts.indexOf('z_pos') === -1) {
				meshes[5].rotation.y = Math.PI;
  				meshes[5].position.z = cube_half;
  				that.cube.add(meshes[5]);
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
		};
	};
		
	return Ü;
	
}(Ü || {}));
