/*
 * skybox contains controls for the #back div 
 * and the skybox (DOESN'T EXIST YET!) in Ü.scene
 */
var Ü = Ü || {}; /*_utils_*/ Ü._ = Ü._ || {};

Ü._.skybox = (function(skybox) {
	
	/*	
	 *  skybox utils
	 * 	generic methods for manipulating background div and skybox, 
	 *  wrapping images and videos
	 */
	skybox._ = (function( _ ) {
		
		var assets = Ü._.assetPath;
		var back_div = null;
		
		//get ref to background div when available
		$(document).ready(function() {
			back_div = document.getElementById('back');
		});
		
		_.backDivClear = function() {
			back_div.innerHTML = ""; //heh
		};
		_.backDivPut = function(element) {
			if (back_div.childNodes.length > 0) {
				_.backDivClear();
			}
			back_div.appendChild(element);
		};
		
		_.getImage = function(name) {
			var img = new Image();
			img.src = assets + name;
			return img;
		};
		_.getVideo = function(name) {
			var vid = document.createElement('video');
			vid.src = assets + name;
			return vid;
		};

		return _;
		
	})({});

	//get this immediately
	var static_sky = skybox._.getImage("sky_gif_1st_frame.jpg");
	
	//TODO: delay loading this for a bit
	var sky_gif = skybox._.getImage("sky.gif");
	
	//puts static sky in #back div for preloading sequence
	skybox.putStaticSky = function() {
		skybox._.backDivPut(static_sky);
	};
	skybox.putSky = function() {
		skybox._.backDivPut(sky_gif);
	};
	
	return skybox;
		
})({});