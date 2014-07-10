/*
 * divCtl manages activity in the #preloader and #back divs
 */

var Ü = Ü || {}; /*_utils_*/ Ü._ = Ü._ || {};
	
Ü._.divCtl = (function(divCtl) {
		
	var assets = Ü._.assetPath;
	
	divCtl.loadingSeq = function() {
		divCtl.skybox.putStaticSky();
		divCtl.preloader.show();
	};
	divCtl.doneLoading = function() {
		divCtl.skybox.putSky();
		divCtl.preloader.hide();
	};
	
	divCtl.preloader = (function(preloader) {
		
		var preload_div = $("#preloader");
		var waiter = new Image();
		waiter.src = assets + "virgo_preload_draft.gif";
		preload_div.append(waiter);
		
		preloader.show = function() {
			preload_div.fadeIn(100, "linear");
		};
		
		preloader.hide = function() {
			preload_div.fadeOut(100, "linear", function() {
				preload_div.css("display", "none");
				waiter.style.display = "none"; //Don't draw while hidden!
			});
		};
		
		return preloader;
		
	})({});
	
	divCtl.skybox = (function(skybox) {
		
		var back_div = document.getElementById('back');
		
		skybox._ = (function(_) {
			
			_.backDivClear = function() {
				back_div.innerHTML = ""; //heh
			};
			_.backDivPut = function(element) {
				if (back_div.childNodes.length > 0) {
					_.backDivClear();
				}
				back_div.appendChild(element);
			};
		
			return _;
		
		})({});
		
		var static_sky = Ü._.imageOps.getImage(assets + "sky_gif_1st_frame.jpg");
		skybox.putStaticSky = function() {
			skybox._.backDivPut(static_sky);
		};
		
		//TODO: delay loading this for a bit
		var sky_gif = Ü._.imageOps.getImage(assets + "sky.gif");
		skybox.putSky = function() {
			skybox._.backDivPut(sky_gif);
		};
		
		return skybox;
		
	})({});
		
	return divCtl;
		
})({});