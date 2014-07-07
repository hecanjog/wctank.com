/* next steps:
 * restructuring of world construction around stitching 
 * 	preloading schemes
 * further along:
 * 	'walking' instead of creepy hover
 * 	procedural sound!
 * ...get adjacent positions, check validity
 * collision detection with walls
 */
	
var Ü = (function(Ü) {

	Ü.scene = {};
	Ü.wgl_renderer = {};	
	
	var container = null;
	
	//call after the DOM is in place
	Ü.init = function() {
		
		Ü._.preloader.on();
			
		container = document.getElementById("wgl");
		Ü.scene = new THREE.Scene();
		Ü.wgl_renderer = new THREE.WebGLRenderer({alpha: true});
		Ü.wgl_renderer.setSize( container.offsetWidth, container.offsetHeight );
		Ü.wgl_renderer.setClearColor(0x000000, 0);		
		container.appendChild(Ü.wgl_renderer.domElement);
				
	};
		
	function resizeCanvas() {
		if(Ü.wgl_renderer && Ü._.omnibus) {
			Ü.wgl_renderer.setSize(container.offsetWidth, container.offsetHeight);
			Ü._.omnibus.update();
		}	
	};
	window.addEventListener('resize', resizeCanvas);
	
	//use this function to set first location and load
	Ü.setStartingLocation = function(lat, lng) {
		
		var unit = new Ü._.unitBuilder(19.486971,-99.117902, [1]);
		Ü.scene.add(unit.unit);
		
		var unit2 = new Ü._.unitBuilder(19.487229,-99.117819, [0, 1]);
		unit2.unit.position.x = 1000;
		Ü.scene.add(unit2.unit);
		
		var unit3 = new Ü._.unitBuilder(19.487556,-99.117715, [0], function() {
				Ü._.preloader.off();
		});
		unit3.unit.position.x = 2000;
		Ü.scene.add(unit3.unit);
					
		Ü.scene.add(Ü._.omnibus.van);
		
	};
				
	Ü.animate = function() {
		requestAnimationFrame(Ü.animate);
		Ü._.masterAnimate.bang();		
		Ü.wgl_renderer.render(Ü.scene, Ü._.omnibus.camera);
	};
	
	return Ü;	

}(Ü || {}));