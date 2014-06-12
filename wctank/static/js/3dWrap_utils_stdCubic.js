var Ü = (function(Ü) {
	
	Ü._utils = Ü._utils || {};
	Ü._utils.project = {};
	Ü._utils.project.eq2Cube = {};
	
	var FLOOR = Math.floor,
		ASIN = Math.asin,
		SQRT = Math.sqrt,
		RND = Math.round,
		PI = Math.PI;
	
	var rend = new THREE.WebGLRenderer();
	
	Ü._utils.project.eq2Cube.transCanvas = function(canvas) {
		/*
		 * given a canvas containing an equirectangular image
		 * for projection onto a sphere, return 6 canvases
		 * corresponding to faces of cube
		 */
		var can = canvas, 
			width = can.width,
			height = can.height;
			
		//length of side of face of cube
		var slen = FLOOR(SQRT((width * height) / 6));
		
		rend.setSize( slen, slen );
		
		//prepare 
		var scene = new THREE.Scene(),
			camera = new THREE.PerspectiveCamera(90, 1, 0.1, 20000);	
		
		//camera.setLens(12);
		
		//prepare sphere, map texture to, add to scene
		var parent = new THREE.Texture(can),
			geometry = new THREE.SphereGeometry(10000, 100, 100),
			material = new THREE.MeshBasicMaterial({map: parent});
		
		var sphere = new THREE.Mesh(geometry, material);
		sphere.scale.x = -1;
		sphere.material.map.needsUpdate = true;
		
		scene.add(sphere);	
		scene.add(camera);
		
		var copyCanvas = function(canvas) {
			var ret_canv = document.createElement('canvas');
			ret_canv.width = slen;
			ret_canv.height = slen;
			ret_ctx = ret_canv.getContext('2d');
			ret_ctx.drawImage(canvas, 0, 0);
			
			return ret_canv;
		};
		
		//z_neg
		rend.render(scene, camera);
		var fzn = copyCanvas(rend.domElement);
		
		//x_pos
		camera.rotation.y = -0.5 * Math.PI;
		rend.render(scene, camera);
		var fxp = copyCanvas(rend.domElement);
		
		//z_pos
		camera.rotation.y += -0.5 * Math.PI;
		rend.render(scene, camera);
		var fzp = copyCanvas(rend.domElement);
		
		//x_neg
		camera.rotation.y += -0.5 * Math.PI;
		rend.render(scene, camera);
		var fxn = copyCanvas(rend.domElement);
		
		//y_neg
		camera.rotation.y += -0.5 * Math.PI;
		camera.rotation.x = -0.5 * Math.PI;
		rend.render(scene, camera);
		var fyn = copyCanvas(rend.domElement);
		
		//y_pos
		camera.rotation.y = 2 * Math.PI;
		camera.rotation.x = 0.5 * Math.PI;
		rend.render(scene, camera);
		var fyp = copyCanvas(rend.domElement);
	
		//return canvases -x, +x, -y, +y, -z, +z
		return [fxn, fxp, fyn, fyp, fzn, fzp];
			
	};	
			
	return Ü;
	
}(Ü || {}));