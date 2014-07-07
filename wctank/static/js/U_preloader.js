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
	
	var mess = $.base64.decode("ICAgICAgICAgICAgIAogICAgICBfX19fXyAgIF9"+
"fX19fIF9fX19fIF9fX19fICBfXyAgIF9fX19fX18gXyAgIF8gICAgX19fX19fX19fX18gX19fX18gX"+
"yAgIF9fCiAgICAgfF8gICBffCAvICBfX198ICBfX198ICBfX198IFwgXCAvIC8gIF8gIHwgfCB8IHw"+
"gIHwgIF9fX3wgX19fIFxfICAgX3wgfCAvIC8KICAgICAgIHwgfCAgIFwgYC0tLnwgfF9fIHwgfF9fI"+
"CAgIFwgViAvfCB8IHwgfCB8IHwgfCAgfCB8X18gfCB8Xy8gLyB8IHwgfCB8LyAvIAogICAgICAgfCB"+
"8ICAgIGAtLS4gXCAgX198fCAgX198ICAgIFwgLyB8IHwgfCB8IHwgfCB8ICB8ICBfX3x8ICAgIC8gI"+
"HwgfCB8ICAgIFwgCiAgICAgIF98IHxfICAvXF9fLyAvIHxfX198IHxfX18gICAgfCB8IFwgXF8vIC8"+
"gfF98IHwgIHwgfF9fX3wgfFwgXCBffCB8X3wgfFwgIFwKICAgICAgXF9fXy8gIFxfX19fL1xfX19fL"+
"1xfX19fLyAgICBcXy8gIFxfX18vIFxfX18oICkgXF9fX18vXF98IFxffFxfX18vXF98IFxfLwogICA"+
"gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHwvICAgICAgICAgI"+
"CAgICAgICAgICAgICAgICAgCiov");
	console.log(mess);
		
	return preloader;
		
})({});