//1st person view omnibus and controls

var Ü = Ü || {}; /*_utils_*/ Ü._ = Ü._ || {};
	
Ü._.omnibus = (function(omnibus) {
		
	//TODO: position property
		
	//Object3D to hold camera and rotational axis 
	//that is added to scene in Ü.init()
	omnibus.van = new THREE.Object3D();
		
	var van_x_axis = new THREE.Vector3(1,0,0);
	var van_z_axis = new THREE.Vector3(0,0,-1);
		
	var fov = 70;
	var frustum_near = 1;
	var frustum_far = 40000;
	
	//passed to Ü.wglRenderer in Ü.animate
	omnibus.camera = new THREE.PerspectiveCamera(
				fov, window.innerWidth / window.innerHeight,
				frustum_near, frustum_far);
		
	//make omnibus 
	omnibus.van.add(van_x_axis);
	omnibus.van.add(van_z_axis);
	omnibus.van.add(omnibus.camera);   
		
	/*
	 * controls
	 * TODO: tweening and betterment
	 */
	var down = false;
	var current_x = 0;
	var current_y = 0;
	var last_x = 0;
	var last_y = 0;
	var rot_x = 0;
	var rot_y = 0;
	var trans_z = 0;
	var trans_x = 0;
		
	function onMousedown(e) {
		last_x = e.clientX;
		last_y = e.clientY;
		down = true;
	};
		
	function onMouseup() {
		rot_x = 0;
		rot_y = 0;		
		down = false;
	};
		
	//fix this to remove trailing mvt?
	//anyway, will need to be tweaked when tweening is added
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
		
	//w = 87 a = 65 s = 83 d = 68 - = 189 + = 187
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
		
	//call when the wgl element exists
	function addListeners(element) {
		element.addEventListener('mousedown', onMousedown, false);
		element.addEventListener('mouseup', onMouseup, false);
		element.addEventListener('mousemove', onMousemove, false);
		document.addEventListener('keydown', onKeydown, false);
		document.addEventListener('keyup', onKeyup, false);
	};

	$(document).ready(function() {
		
		var wgl_div = document.getElementById('wgl');
		
		omnibus.update = function() {
			omnibus.camera.projectionMatrix.makePerspective(
				fov, wgl_div.offsetWidth / wgl_div.offsetHeight,
				frustum_near, frustum_far);
		};

		omnibus.setCursor = function(cursor_style) {
			wgl_div.style.cursor = cursor_style;
		};

		addListeners(wgl_div);
			
	});

	function omnibusAnimate() {	
		omnibus.van.rotation.y += -rot_y;
		omnibus.camera.rotation.x += -rot_x;
		omnibus.van.translateOnAxis(van_x_axis, trans_x);
		omnibus.van.translateOnAxis(van_z_axis, trans_z);	
	};
		
	Ü._.masterAnimate.add(omnibusAnimate);
		
	return omnibus;
		
})({});