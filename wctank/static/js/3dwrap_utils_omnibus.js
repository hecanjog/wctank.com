//1st person view omnibus and controls

var Ü = (function(Ü) {
	
	Ü._utils = Ü._utils || {};
	Ü._utils.omnibus = {};
	
	//make omnibus 
	//Object3D to hold camera and rotational axis
	Ü._utils.omnibus.van = new THREE.Object3D();
	
	var	van_x_axis = new THREE.Vector3(1,0,0),
		van_z_axis = new THREE.Vector3(0,0,-1);
	
	var	fov = 70, //70
		frustum_near = 1,
		frustum_far = 40000;
	
	Ü._utils.omnibus.camera = new THREE.PerspectiveCamera(
					fov, window.innerWidth / window.innerHeight,
					frustum_near, frustum_far);

	Ü._utils.omnibus.van.add(van_x_axis);
	Ü._utils.omnibus.van.add(van_z_axis);
	Ü._utils.omnibus.van.add(Ü._utils.omnibus.camera);
		
	//controls
	//TODO: install cool tweening obvi					
	var down = false,
		current_x = 0, 
		current_y = 0,
		last_x = 0,
		last_y = 0,
		rot_x = 0,
		rot_y = 0,
		trans_z = 0,
		trans_x = 0;

	$(document).ready(function() {
		document.body.style.cursor = 'all-scroll';
	});
	
	function onMousedown(e) {
		last_x = e.clientX;
		last_y = e.clientY;
		down = true;
	};
	window.addEventListener('mousedown', onMousedown, false);
	
	function onMouseup() {
		rot_x = 0;
		rot_y = 0;		
		down = false;
	};
	window.addEventListener('mouseup', onMouseup, false);
	
	function onMousemove(e) {
		if (down) {
			current_x = e.clientX;
			current_y = e.clientY;
			rot_x = (last_y - current_y)/window.innerWidth*2;
			rot_y = (current_x - last_x)/window.innerHeight*6;
			last_y = current_y;
			last_x = current_x;
		}
	};
	window.addEventListener('mousemove', onMousemove, false);
	
	//w = 87 a = 65 s = 83 d = 68 - = 189 + = 187
	//TODO: collision detection with walls
	function onKeydown(e) {
		switch (e.keyCode) {
			case 87: 
				trans_z = 50;
				break;
			case 65:
				trans_x = -50;
				break;
			case 83:
				trans_z = -50;
				break;
			case 68:
				trans_x = 50;
				break;		
		}
	}
	window.addEventListener('keydown', onKeydown, false);
	
	function onKeyup(e) {
		switch (e.keyCode) {
			case 87: 
				trans_z = 0;
				break;
			case 65:
				trans_x = 0;
				break;
			case 83:
				trans_z = 0;
				break;
			case 68:
				trans_x = 0;
				break;
		}
	}
	window.addEventListener('keyup', onKeyup, false);

	/*
	 * Ü._utils.omnibus.getPosition...
	 * create position property and continually update...
	 * make available to whatever needs it
	 */

	Ü._utils.omnibus.update = function() {
		camera.projectionMatrix.makePerspective(
			fov, window.innerWidth / window.innerHeight,
			frustum_near, frustum_far);
	};
	
	function omnibusAnimate() {
		Ü._utils.omnibus.van.rotation.y += -rot_y;
		Ü._utils.omnibus.camera.rotation.x += -rot_x;
		Ü._utils.omnibus.van.translateOnAxis(van_x_axis, trans_x);
		Ü._utils.omnibus.van.translateOnAxis(van_z_axis, trans_z);
	}
	
	Ü.masterAnimate.start(omnibusAnimate);
	
	return Ü;
	
}(Ü || {}));