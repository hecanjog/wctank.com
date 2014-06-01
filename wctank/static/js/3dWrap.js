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
		//Ü._scene = new THREE.Scene();
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
	Ü.setStartingLocation = function(lat, lng) {
		scene.add(Ü._utils.unitBuilder(lat, lng, []));
	};
	
	//place first objects in scene when ready
	//TODO: add first world when that's ready to use
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