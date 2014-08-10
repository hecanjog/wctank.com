/* next steps:
 * restructuring of world construction around stitching 
 * imageOps: add WebGl layer, remove most of jsfeat library
 * 	preloading schemes
 * low-key loading prompt when necessary to halt movement
 * further along:
 * 	'walking' instead of creepy hover
 * 	procedural sound!
 * ...get adjacent positions, check validity
 * collision detection with walls
 * 
 * start with moving sky, then switch to a different speed
 * 
 */
	
var Ü = (function(Ü) {
	
	var start, end;
	
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
		//console.log(window);
	};
		
	function resizeCanvas() {
		if(Ü.wgl_renderer && Ü._.omnibus) {
			Ü.wgl_renderer.setSize(container.offsetWidth, container.offsetHeight);
			Ü._.omnibus.update();
		}	
	};
	window.addEventListener('resize', resizeCanvas);
	
	//called after we're ready to go
	var all_here = 0;
	var etVoila = function() {
		
		all_here++;
		
		if(all_here === 3) {
			Ü._.divCtl.doneLoading();
			Ü._.masterAnimate.animate();
			Ü._.omnibus.setCursor("all-scroll");
			Ü._.initialLoad = false;
			end = performance.now();
			console.log("load took "+(end - start)+" msec");
		}
	};
	
	//set initial location and begin
	Ü.setLocationAndGo = function(lat, lng) {
		
		Ü.scene.add(Ü._.omnibus.van);
		start = performance.now();
		var unit = new Ü._.UnitBuilder(19.486971,-99.117902, [1], function() {
			Ü.scene.add(unit.unit);
			Ü._.masterAnimate.tick();
			etVoila();
		});
		
		var unit2 = new Ü._.UnitBuilder(19.487229,-99.117819, [0, 1], function() {
			unit2.unit.position.x = 1000;
			Ü.scene.add(unit2.unit);
			Ü._.masterAnimate.tick();
			etVoila();
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