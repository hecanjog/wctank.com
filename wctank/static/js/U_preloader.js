/*
 * preloader manages initial loading behavior outside of THREE and #preloader div
 */

var Ü = Ü || {}; /*_utils_*/ Ü._ = Ü._ || {};
	
Ü._.preloader = (function(preloader) {
	
	var waiter = new Image();
	waiter.src = Ü._.assetPath + "virgo_preload_draft.gif";
		
	preloader.on = function() {			
		var preload_div = document.getElementById('preloader');
		waiter.onload = function() {
			preload_div.appendChild(waiter);
		};
		Ü._.skybox.putStaticSky();
	};
		
	preloader.off = function() {	
		var preload_div = $("#preloader");
		preload_div.fadeOut(100, "linear", function() {
			preload_div.css("display", "none");
			waiter.style.display = "none"; //Don't draw while hidden!
		});
		Ü._.skybox.putSky();
		Ü._.omnibus.setCursor("all-scroll");
	};
		
	return preloader;
		
})({});