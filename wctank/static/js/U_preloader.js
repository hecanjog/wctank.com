/*
 * preloader manages initial loading behavior and #preloader div
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
	};
		
	preloader.off = function() {	
		var preload_div = $("#preloader");
		preload_div.fadeOut(100, "linear", function() {
			preload_div.css("display", "none");
			waiter.style.display = "none"; //Don't draw while hidden!
		});
		
		Ü._.omnibus.setCursor("all-scroll");
	};
		
	return preloader;
		
})({});