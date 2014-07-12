var Ü = Ü || {}; /*_utils_*/ Ü._ = Ü._ || {};

Ü._.project = (function(project) {
	
	var renderer = new THREE.WebGLRenderer();
	
	var prepareSphereProjection = function(canvas) {
	
		this.w = canvas.width;
		this.h = canvas.height;
		
		this.scene = new THREE.Scene();
		this.camera = new THREE.PerspectiveCamera(90, 1, 0.0001, 10000);
		
		var parent = new THREE.Texture(canvas);
		var geometry = new THREE.SphereGeometry(100, 100, 100);
		var material = new THREE.MeshBasicMaterial({map: parent});
				
		var sphere = new THREE.Mesh(geometry, material);
		sphere.scale.x = -1;
		sphere.material.map.needsUpdate = true;
		
		this.scene.add(sphere);	
		this.scene.add(this.camera);
		
		this.snapshot = function(x, y, z) {
			
			this.camera.lookAt(new THREE.Vector3(x, y, z));
			renderer.render(this.scene, this.camera);
			
			return Ü._.imageOps.copy(renderer.domElement);
			
		};
		
		this.pSnap = function(x, y, z, callback) {
			this.camera.lookAt(new THREE.Vector3(x, y, z));
			renderer.render(this.scene, this.camera);
			Ü._.imageOps.copy(renderer.domElement, function(img) {
				callback(img);
			});
		};
		
	};
	
	/* 
	 * given a canvas containing an equirectangular image
	 * for projection onto a sphere, return 6 canvases
	 * corresponding to faces of cube
	 * 
	 * TODO: doc callback
	 * 
	 */
	project.sphereToCube = function(canvas, callback) {
		
		var s = new prepareSphereProjection(canvas);
		
		//length of side of face of cube
		var slen = Math.floor(Math.sqrt((s.w * s.h) / 6));
		renderer.setSize( slen, slen );
		
		var fxn, fxp, fyn, fyp, fzn, fzp;
		
		if(typeof callback === 'function') {
			
			s.pSnap(-1, 0, 0, function(img) {
				fxn = img;
				s.pSnap(1, 0, 0, function(img) {
					fxp = img;
					s.pSnap(0, -1, 0, function(img) {
						fyn = img;
						s.pSnap(0, 1, 0, function(img) {
							fyp = img;
							s.pSnap(0, 0, -1, function(img) {
								fzn = img;
								s.pSnap(0, 0, 1, function(img) {
									fzp = img;
									callback([fxn, fxp, fyn, fyp, fzn, fzp]);
								});
							});
						});
					});
				});
			});
			
		} else {
			
			fxn = s.snapshot(-1, 0, 0); //x_neg
			fxp = s.snapshot(1, 0, 0); //x_pos
			fyn = s.snapshot(0, -1, 0); //y_neg
			fyp = s.snapshot(0, 1, 0); //y_pos
			fzn = s.snapshot(0, 0, -1); //z_neg
			fzp = s.snapshot(0, 0, 1); //z_pos
		
			//return canvases -x, +x, -y, +y, -z, +z
			return [fxn, fxp, fyn, fyp, fzn, fzp];
			
		}
	};	
	
	return project;
	
})({});