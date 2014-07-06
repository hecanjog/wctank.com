var Ü = Ü || {}; /*_utils_*/ Ü._ = Ü._ || {};

Ü._.project = (function(project) {

	var rend = new THREE.WebGLRenderer();
	
	var prepareSphereProjection = function(canvas) {
		
		this.w = canvas.width;
		this.h = canvas.height;
		
		this.scene = new THREE.Scene();
		this.camera = new THREE.PerspectiveCamera(90, 1, 0.0001, 10000);
		
		var parent = new THREE.Texture(canvas),
			geometry = new THREE.SphereGeometry(100, 100, 100),
			material = new THREE.MeshBasicMaterial({map: parent});
				
		var sphere = new THREE.Mesh(geometry, material);
		sphere.scale.x = -1;
		sphere.material.map.needsUpdate = true;
		
		this.scene.add(sphere);	
		this.scene.add(this.camera);
		
		this.snapshot = function(x, y, z, renderer) {
			
			this.camera.lookAt(new THREE.Vector3(x, y, z));
			renderer.render(this.scene, this.camera);
			
			return Ü._.imageOps.copy(renderer.domElement);
			
		};
		
	};
	
	/* 
	 * given a canvas containing an equirectangular image
	 * for projection onto a sphere, return 6 canvases
	 * corresponding to faces of cube
	 */
	project.sphereToCube = function(canvas) {
		
		var sp = new prepareSphereProjection(canvas);
		
		//length of side of face of cube
		var slen = Math.floor(Math.sqrt((sp.w * sp.h) / 6));
		
		rend.setSize( slen, slen );
		
		var fxn = sp.snapshot(-1, 0, 0, rend); //x_neg
		var fxp = sp.snapshot(1, 0, 0, rend); //x_pos
		var fyn = sp.snapshot(0, -1, 0, rend); //y_neg
		var fyp = sp.snapshot(0, 1, 0, rend); //y_pos
		var fzn = sp.snapshot(0, 0, -1, rend); //z_neg
		var fzp = sp.snapshot(0, 0, 1, rend); //z_pos
		
		//return canvases -x, +x, -y, +y, -z, +z
		return [fxn, fxp, fyn, fyp, fzn, fzp];
			
	};	
	
	return project;
	
})({});