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

	Ü.scene = {};
	Ü.wgl_renderer = {};	
	
	Ü.init = function() {
		Ü.scene = new THREE.Scene();
		Ü.wgl_renderer = new THREE.WebGLRenderer();
		Ü.wgl_renderer.sortObjects = false;
		Ü.wgl_renderer.setSize( window.innerWidth, window.innerHeight );
		document.body.appendChild(Ü.wgl_renderer.domElement);	//body must exist!
	};
		
	function resizeCanvas() {
		if(Ü.wgl_renderer && Ü._utils.omnibus) {
			Ü.wgl_renderer.setSize(window.innerWidth, window.innerHeight);
			Ü._utils.omnibus.update();
		}
	};
	window.addEventListener('resize', resizeCanvas);
	
	//use this function to set first location and load
	Ü.setStartingLocation = function(lat, lng) {
		var unit = new Ü._utils.unitBuilder(lat, lng, ['z_neg', 'x_neg']);//'z_neg', 'x_neg']);
		Ü.scene.add(unit.cube);
		var unit2 = new Ü._utils.unitBuilder(40.74872,-73.985222, ['z_pos']);
		unit2.cube.position.z = -10000;
		Ü.scene.add(unit2.cube);
		var unit3 =  new Ü._utils.unitBuilder(lat,lng, ['x_pos']);
		unit3.cube.position.x = -10000;
		Ü.scene.add(unit3.cube);
		Ü.scene.add(Ü._utils.omnibus.van);
	};
				
	Ü.animate = function() {
		requestAnimationFrame(Ü.animate);
		Ü.masterAnimate.bang();		
		Ü.wgl_renderer.render(Ü.scene, Ü._utils.omnibus.camera);
	};
	
	return Ü;	

}(Ü || {}));