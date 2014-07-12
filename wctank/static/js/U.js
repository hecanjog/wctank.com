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
	
	//TODO: do these go here?
	Ü.scene = {};
	Ü.wgl_renderer = {};	
	
	var container = document.getElementById("wgl"); 
	
	//call after the DOM is in place, initializes THREE
	Ü.init = function() {
		Ü._.divCtl.loadingSeq();
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
	
	//called after we're ready to go
	var etVoila = function() {
		Ü._.divCtl.doneLoading();
		Ü._.masterAnimate.animate();
		Ü._.omnibus.setCursor("all-scroll");
		Ü._.initialLoad = false;
	};
	
	//set initial location and begin
	Ü.setLocationAndGo = function(lat, lng) {
		
		Ü.scene.add(Ü._.omnibus.van);
		
		var unit = new Ü._.UnitBuilder(19.486971,-99.117902, [1], function() {
			Ü.scene.add(unit.unit);
			Ü._.masterAnimate.tick();
		});
		
		var unit2 = new Ü._.UnitBuilder(19.487229,-99.117819, [0, 1], function() {
			unit2.unit.position.x = 1000;
			Ü.scene.add(unit2.unit);
			Ü._.masterAnimate.tick();
		});
		
		var unit3 = new Ü._.UnitBuilder(19.487556,-99.117715, [0], function() {
			unit3.unit.position.x = 2000;
			Ü.scene.add(unit3.unit);
			Ü._.masterAnimate.tick();
			etVoila();
		});

	};
					
	return Ü;	

}(Ü || {}));