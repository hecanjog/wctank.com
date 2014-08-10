var Ü = Ü || {}; /*_utils_*/ Ü._ = Ü._ || {};

Ü._.project = (function(project) {
	
	var renderer = new THREE.WebGLRenderer();
	
	var prepareSphereProjection = function(canvas) {
	
		var scope = this;
	
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
		
		this.conSnap = (function(conSnap) {
			
			var images = [];
			var fnheap = [];
			var idx = 0;
			var stid, call, interval;
			
			conSnap.addShot = function(x, y, z) {
				fnheap[fnheap.length] = function() {
					scope.camera.lookAt(new THREE.Vector3(x, y, z));
					renderer.render(scope.scene, scope.camera);
					images[idx] = Ü._.imageOps.copy(renderer.domElement);
					idx++;
				};
				return scope.conSnap;
			};
			
			conSnap.execute = function(time_interval, callback) {
				if (callback) call = callback;
				if (time_interval) interval = time_interval;
				stid = window.setTimeout(function() {
					fnheap[idx]();
					if (idx < fnheap.length) {
						conSnap.execute();
					} else {
						window.clearTimeout(stid);
						call(images);
					}
				}, interval);	
				
			};
			
			return conSnap;
			
		}({}));
		
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
			
			s.conSnap.addShot(-1, 0, 0)
				.addShot(1, 0, 0)
				.addShot(0, -1, 0)
				.addShot(0, 1, 0)
				.addShot(0, 0, -1)
				.addShot(0, 0, 1)
				.execute(10, callback);
			
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
	
}({}));