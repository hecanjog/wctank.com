var Ü = (function(Ü) {
	
	Ü._ = Ü._ || {};
	Ü._.project = {};
		
	var rend = new THREE.WebGLRenderer();
	
	Ü._.project.cubic = function(canvas) {
		/*
		 * given a canvas containing an equirectangular image
		 * for projection onto a sphere, return 6 canvases
		 * corresponding to faces of cube
		 */
		var can = canvas, 
			width = can.width,
			height = can.height;
			
		//length of side of face of cube
		var slen = Math.floor(Math.sqrt((width * height) / 6));
		
		rend.setSize( slen, slen );
		
		//prepare 
		var scene = new THREE.Scene(),
			camera = new THREE.PerspectiveCamera(90, 1, 0.0001, 10000);	
		
		//prepare sphere, map texture to, add to scene
		var parent = new THREE.Texture(can),
			geometry = new THREE.SphereGeometry(100, 100, 100),
			material = new THREE.MeshBasicMaterial({map: parent});
				
		var sphere = new THREE.Mesh(geometry, material);
		sphere.scale.x = -1;
		sphere.material.map.needsUpdate = true;
		
		scene.add(sphere);	
		scene.add(camera);
		
		var copyCanvas = function(canvas_to_copy) {
			var ret_canv = document.createElement('canvas');
			ret_canv.width = canvas_to_copy.width;
			ret_canv.height = canvas_to_copy.height;
			ret_ctx = ret_canv.getContext('2d');
			ret_ctx.drawImage(canvas_to_copy, 0, 0);
			
			return ret_canv;
		};
		
		//z_neg
		rend.render(scene, camera);
		var fzn = copyCanvas(rend.domElement);
		
		//x_pos
		camera.lookAt(new THREE.Vector3(1, 0, 0));
		rend.render(scene, camera);
		var fxp = copyCanvas(rend.domElement);
		
		//z_pos
		camera.lookAt(new THREE.Vector3(0, 0, 1));
		rend.render(scene, camera);
		var fzp = copyCanvas(rend.domElement);
		
		//x_neg
		camera.lookAt(new THREE.Vector3(-1, 0, 0));
		rend.render(scene, camera);
		var fxn = copyCanvas(rend.domElement);
		
		//y_neg
		camera.lookAt(new THREE.Vector3(0, -1, 0));
		rend.render(scene, camera);
		var fyn = copyCanvas(rend.domElement);
		
		//y_pos
		camera.lookAt(new THREE.Vector3(0, 1, 0));
		rend.render(scene, camera);
		var fyp = copyCanvas(rend.domElement);
		
		//return canvases -x, +x, -y, +y, -z, +z
		return [fxn, fxp, fyn, fyp, fzn, fzp];
			
	};	
			
	return Ü;
	
}(Ü || {}));