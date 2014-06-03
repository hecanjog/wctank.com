/* next steps: 
 * try other types of projections! mapping to cube for mvt closer to walls
 * collision detection
 * start loading more than one panorama:
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
	
	//interface for building initial scene
	Ü._setScene = function(new_scene) {
		scene = new_scene;
	};
	
	Ü._getScene = function() {
		return scene;
	};
	
	//interface for building initial scene
	Ü.init = function() {
		scene = new THREE.Scene();
		wgl_renderer = new THREE.WebGLRenderer();
			
			wgl_renderer.sortObjects = false;
			wgl_renderer.setSize( window.innerWidth, window.innerHeight );
			
			//body must exist!
			document.body.appendChild(wgl_renderer.domElement);	
			
	};
		
	function resizeCanvas() {
		if(wgl_renderer && Ü._utils.omnibus) {
			wgl_renderer.setSize(window.innerWidth, window.innerHeight);
			Ü._utils.omnibus.update();
		}
	};
	window.addEventListener('resize', resizeCanvas);
	
	//use this function to set first location and preload
	// final version will have determined KNOCKOUT array        
	Ü.setStartingLocation = function(lat, lng) {
		var unit = new Ü._utils.unitBuilder(lat, lng, ['suck a dick']);
		scene.add(unit.cube);
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