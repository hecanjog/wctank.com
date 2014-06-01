//1st person view omnibus and controls

var Ü = (function(Ü) {
	
	Ü._utils = Ü._utils || {};
	Ü._utils.omnibus = {};
	
	//make omnibus 
	var	fov = 70, //70
		frustum_near = 1,
		frustum_far = 30000,
		van = new THREE.Object3D(),
		van_x_axis = new THREE.Vector3(1,0,0),
		van_z_axis = new THREE.Vector3(0,0,-1);
	
	_camera = new THREE.PerspectiveCamera(
			fov, window.innerWidth / window.innerHeight,
			frustum_near, frustum_far);

			van.add(van_x_axis);
			van.add(van_z_axis);
			van.add(_camera);
	
	Ü._utils.omnibus.getCamera = function() {
		return _camera;
	};
	
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

	Ü._utils.omnibus.getPosition = function() {
		return van.positon;
	};

	Ü._utils.omnibus.update = function() {
		//reinit projection matrix, mostly for resize events
		_camera.projectionMatrix.makePerspective(
			fov, window.innerWidth / window.innerHeight,
			frustum_near, frustum_far);
	};

	Ü._utils.omnibus.start = function() {
		Ü._getScene().add(van);
	};
	
	Ü._utils.omnibus.remove = function() {
		Ü._getScene().remove(van);
	};

	Ü._utils.omnibus.toAnimate = function() {

		van.rotation.y += -rot_y;
		_camera.rotation.x += -rot_x;
		van.translateOnAxis(van_x_axis, trans_x);
		van.translateOnAxis(van_z_axis, trans_z);
		
	};

	return Ü;
	
}(Ü || {}));