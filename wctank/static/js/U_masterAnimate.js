/*
 * masterRender consolidates all animations to execute 
 * and provides an interface for adding and removing them
 */

var Ü = (function(Ü) {
	
	Ü._ = Ü._ || {};
	
	Ü._.masterAnimate = (function(masterAnimate) {
		
		var to_render = [];
		
		//add function to render queue
		masterAnimate.start = function(fun) {
			if (typeof fun === 'function') {
				to_render.push(fun);
			} else {
				throw "masterRender only takes functions";
			}
		};
		
		//remove function from render queue
		masterAnimate.stop = function(fun) {
			var idx = to_render.indexOf(fun);
			if (idx > -1) {
				to_render.splice(idx, 1);
			} else {
				throw "masterRender cannot find that to stop";
			}	
		};
		
		//execute queue - call in main render loop
		masterAnimate.bang = function() {
			for (i = 0; i < to_render.length; i++) {
				to_render[i]();
			}
		};
		
		return masterAnimate;
		
	})({});
	
	return Ü;
	
}(Ü || {}));