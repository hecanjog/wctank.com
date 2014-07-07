/*
 * skybox contains controls for the #back div 
 * and the skybox (DOESN'T EXIST YET!) in Ü.scene
 */
var Ü = Ü || {}; /*_utils_*/ Ü._ = Ü._ || {};

Ü._.skybox = (function(skybox) {
	
	var assets = Ü._.assetPath;
	
	var sky_gif = new Image();
	sky_gif.src = assets + "sky.gif";

	var sky_static = new Image();
	sky_static.src = assets + "sky_gif_1st_frame.jpg";
	
	return skybox;
		
})({});