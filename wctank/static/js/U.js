/* next steps: 
 * 	preloading schemes
 * further along:
 * 	'walking' instead of creepy hover
 * 	procedural sound!
 * ...get adjacent positions, check validity
 */
	
var Ü = (function(Ü) {

	Ü.scene = {};
	Ü.wgl_renderer = {};	
	
	Ü.init = function() {
		
		Ü.scene = new THREE.Scene();
		Ü.wgl_renderer = new THREE.WebGLRenderer({alpha: true});
		Ü.wgl_renderer.sortObjects = false;
		Ü.wgl_renderer.setSize( window.innerWidth, window.innerHeight );
		Ü.wgl_renderer.setClearColor(0x000000, 0);
		
		var container = document.getElementById("wgl"); //must exist!
		container.appendChild(Ü.wgl_renderer.domElement);
		
	};
		
	function resizeCanvas() {
		
		if(Ü.wgl_renderer && Ü._.omnibus) {
			Ü.wgl_renderer.setSize(window.innerWidth, window.innerHeight);
			Ü._.omnibus.update();
		}
		
	};
	window.addEventListener('resize', resizeCanvas);
	
	//use this function to set first location and load
	Ü.setStartingLocation = function(lat, lng) {
		
		var unit = new Ü._.unitBuilder(lat, lng, []);
		Ü.scene.add(unit.unit);
		Ü.scene.add(Ü._.omnibus.van);
		
	};
				
	Ü.animate = function() {
		
		requestAnimationFrame(Ü.animate);
		Ü.masterAnimate.bang();		
		Ü.wgl_renderer.render(Ü.scene, Ü._.omnibus.camera);
		
	};
	
	return Ü;	

}(Ü || {}));