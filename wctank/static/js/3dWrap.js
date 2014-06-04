/* next steps: 
 * 	preloading schemes
 * further along:
 * 	'walking' instead of creepy hover
 * 	procedural sound!
 * ...get adjacent positions, check validity
 * errors buttface
 * DECORATIVE ANIMATION
 */
	
var Ü = (function(Ü) {

	var scene = {};
	var wgl_renderer = {};
	
	Ü._setScene = function(new_scene) {
		scene = new_scene;
	};
	
	Ü._getScene = function() {
		return scene;
	};
	
	Ü.init = function() {
		scene = new THREE.Scene();
		wgl_renderer = new THREE.WebGLRenderer();
			
			wgl_renderer.sortObjects = false;
			wgl_renderer.setSize( window.innerWidth, window.innerHeight );
			document.body.appendChild(wgl_renderer.domElement);	//body must exist!
			
	};
		
	function resizeCanvas() {
		if(wgl_renderer && Ü._utils.omnibus) {
			wgl_renderer.setSize(window.innerWidth, window.innerHeight);
			Ü._utils.omnibus.update();
		}
	};
	window.addEventListener('resize', resizeCanvas);
	
	//use this function to set first location and load
	Ü.setStartingLocation = function(lat, lng) {
		var unit = new Ü._utils.unitBuilder(lat, lng, ['z_neg', 'x_neg']);
		scene.add(unit.cube);
		var unit2 = new Ü._utils.unitBuilder(40.74872,-73.985222, ['z_pos']);
		unit2.cube.position.z = -10000;
		scene.add(unit2.cube);
		var unit3 =  new Ü._utils.unitBuilder(lat,lng, ['x_pos']);
		unit3.cube.position.x = -10000;
		scene.add(unit3.cube);
	};
	
	//place objects in scene when ready
	Ü.start = function() {
		Ü._utils.omnibus.start();
	};
				
	Ü.animate = function() {
		requestAnimationFrame(Ü.animate);
   		Ü._utils.omnibus.toAnimate();		
		wgl_renderer.render(scene, Ü._utils.omnibus.getCamera());
	};
	
	return Ü;	

}(Ü || {}));