/*
 * masterAnimate maintains animation state and render loop
 * N.B. maintaining animation state global should be OK as long as things don't get
 * too complex, at which point a more OO-y approach would be better, i.e.,
 * recursing through all objects in the scene and looking for something to animate in each
 */

var Ü = Ü || {}; /*_utils_*/ Ü._ = Ü._ || {};
	
Ü._.masterAnimate = (function(masterAnimate) {
		
	var to_render = [];
		
	//add function to render queue
	masterAnimate.add = function(fun) {
		if (typeof fun === 'function') {
			to_render.push(fun);
		} else {
			throw "ERROR: masterAnimate expects a function";
		}
	};
		
	//remove function from render queue
	masterAnimate.remove = function(fun) {
		var idx = to_render.indexOf(fun);
		if (idx > -1) {
			to_render.splice(idx, 1);
		} else {
			throw "ERROR: masterAnimate 404";
		}	
	};
		
	//execute queue and render 1 frame
	masterAnimate.tick = function() {
		for (var i = 0; i < to_render.length; i++) {
			to_render[i]();
		}
		Ü.wgl_renderer.render(Ü.scene, Ü._.omnibus.camera);
	};
	
	//main render loop, called after initial loading sequence is complete
	masterAnimate.animate = function() {
		requestAnimationFrame(masterAnimate.animate);
		masterAnimate.tick();		
	};
		
	return masterAnimate;
		
}({}));
