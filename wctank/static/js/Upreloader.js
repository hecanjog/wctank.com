/*
 * preloader shows and hides preloading div
 */

var Ü = (function(Ü) {
	
	Ü.preloader = (function(preloader) {
		
		preloader.on = function() {
		
			$("#preloader").css(
				{	"display": "block",
					"background-color": "#000"});
			
		};
		
		preloader.off = function() {
		
			Ü._.omnibus.setCursor("all-scroll");
				
			$("#preloader").css(
				{	"display": "none",
					"background-color": "#000"});
					
		};
		
		return preloader;
		
	})({});
	
	return Ü;	

}(Ü || {}));
