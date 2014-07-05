/*
 * load manages preloading sequence
 */

var Ü = (function(Ü) {
	
	Ü._ = Ü._ || {};
	
	Ü._.preloader = (function(preloader) {
		
		var waiter = new Image();
		waiter.src = "../static/virgo_preload_draft.gif";
		
		preloader.on = function() {			
			
			var preload_div = document.getElementById('preloader');
			waiter.onload = function() {
				preload_div.appendChild(waiter);
			};
			
		};
		
		preloader.off = function() {
			
			var preload_div = $("#preloader");
			preload_div.fadeOut(100, "linear", function() {
				preload_div.css("display", "none");
			});
			
			Ü._.omnibus.setCursor("all-scroll");
			
		};
		
		return preloader;
		
	})({});
	
	return Ü;	

}(Ü || {}));
