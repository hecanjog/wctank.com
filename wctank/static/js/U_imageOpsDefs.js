/*
 * This file contains function definitions using the ImgOp Interface
 * TODO: Automate 1-line return functions, implement image kernels, WEBGL!!!
 */
var Ü = Ü || {}; /*_utils_*/ Ü._ = Ü._ || {};

/*
* alphaIntersect:
 * given a source canvas and an alpha mask, returns new canvas
 * with source pixels that do not correspond to white (or black)
 * pixels in mask, normalized to source dimensions
 * 
 * invert: if truthy, will remove pixels in source corresponding with
 * white pixels in map, instead of black.
 * 
 */
Ü._.imageOps.alphaIntersect = new Ü._.imageOps.ImgOp("alphaIntersect", ["canvas", "map", "invert", "callback"], null,
	
	function() {
		var mpx = new Int32Array(MDAT.data.buffer);
		for (var texel = 0; texel < mpx.length; texel++) {
			if (mpx[texel] === FILTER) {
				RPX[texel] = 0x00000000;
			} else {
				RPX[texel] = -16777216; //CPX[texel];
			}
		}
	},

	{	
		mdat: function(canvas, map) { // override with sdat - if in canvas spot, will override default s
			var scmap = Ü._.imageOps.resize(map, canvas.width, canvas.height, true);
			var ctx = scmap.getContext('2d');
			var dat = ctx.getImageData(0, 0, scmap.width, scmap.height);
			return dat;
		},

		filter: function(invert) {
			if (invert) { 
				return -1; 
			} else {
				return -16777216;
			}
		}				
	}
	
);

Ü._.imageOps.cannyEdge = new Ü._.imageOps.ImgOp("cannyEdge", ["canvas", "callback"], null,
		
	function() {

		var mtx = new jsfeat.matrix_t(W, H, jsfeat.U8C1_t);

		jsfeat.imgproc.grayscale(CDAT.data, mtx.data); ///
		jsfeat.imgproc.canny(mtx, mtx, 95, 105);
		
		for (var txl = 0; txl < RPX.length; txl ++) {
			var val = mtx.data[txl];
			RPX[txl] = PACK_PXL(val, val, val, 0xff);
		}

	}, null, [ Ü._.workerPaths.jsfeat ] 
		
);

Ü._.imageOps.copy = new Ü._.imageOps.ImgOp("copy", ["canvas", "callback"], null,
		
	function() {
			
		if(ORIENT_GL) { // if the canvas we're copying uses <0, 0> as bottom-left	
			var texel = 0;
			for (var y = H; y >= 0; y--) {
				for (var x = 0; x < W; x++) {
					RPX[texel] = CPX[y * W + x];
					texel++;
				}
			}		
		} else {
			RPX = CPX;
		}
			
	}, null, null, 
		
	function(canvas) {
			
		var ret_canv = document.createElement('canvas');
		ret_canv.width = canvas.width;
		ret_canv.height = canvas.height;

		var ret_ctx = ret_canv.getContext('2d');
		ret_ctx.drawImage(canvas, 0, 0);

		return ret_canv;
	
	}
		
);

/*
 * input between 0 and 255
 */
Ü._.imageOps.transparency = new Ü._.imageOps.ImgOp("transparency", ["canvas", "delta", "callback"], null,
	
	function() {
		var alpha = DELTA * 0.003921;
		for (var i = 0; i < CPX.length; i++) {
			MAKE_RGBA(CPX[i]);
			var ra = CHAN_VAL_BOUND(CA * alpha);
			RPX[i] = PACK_PXL(CR, CG, CB, ra);
		}
	},
	
	{
		delta: function(delta) {
			return delta;
		}
	}
	
);

/*
 * input between -255 and 255
 */
Ü._.imageOps.saturation = new Ü._.imageOps.ImgOp("saturation", ["canvas", "saturation", "callback"], null,

	function() {
		
		var mid = 127.5;
		var dsat = SATURATION / 255;
		for (var i = 0; i < CPX.length; i++) {
			
			MAKE_RGBA(CPX[i]);
			
			var dr = CR + (CR - mid) * dsat;
			var dg = CG + (CG - mid) * dsat;
			var db = CB + (CB - mid) * dsat;
			
			var rr = CHAN_VAL_BOUND(dr);
			var rb = CHAN_VAL_BOUND(db);
			var rg = CHAN_VAL_BOUND(dg);
			
			RPX[i] = PACK_PXL(rr, rg, rb, CA);
			
		}
	
	},
	
	{
		saturation: function(saturation) {
			return saturation;
		}
	}

);

/*
 * input between -255 and 255
 */
Ü._.imageOps.contrast = new Ü._.imageOps.ImgOp("contrast", ["canvas", "delta", "callback"], null,

	function() {
		
		var mid = 127.5;
		var dcon = DELTA / 255;
		for (var i = 0; i < CPX.length; i++) {
			
			MAKE_RGBA(CPX[i]);
			
			var mean = (CR + CG + CB) / 3;
			var delta = (mean - mid) * dcon;
			
			var dr = CR + delta;
			var dg = CG + delta;
			var db = CB + delta;
			
			var rr = CHAN_VAL_BOUND(dr);
			var rb = CHAN_VAL_BOUND(db);
			var rg = CHAN_VAL_BOUND(dg);
			
			RPX[i] = PACK_PXL(rr, rg, rb, CA);
		}
	},
	
	{
		delta: function(delta) {
			return delta;
		}
	}

);

/*
 * input between -255 and 255
 */
Ü._.imageOps.brightness = new Ü._.imageOps.ImgOp("brightness", ["canvas", "brightness", "callback"], null,
	
	function() {
		
		var int32Brightness = BRIGHTNESS | 0; 
		
		for (var i = 0; i < CPX.length; i++) {
			
			MAKE_RGBA(CPX[i]);
			
			var dr = CR + int32Brightness;
			var dg = CG + int32Brightness;
			var db = CB + int32Brightness;

			var rr = CHAN_VAL_BOUND(dr);
			var rb = CHAN_VAL_BOUND(db);
			var rg = CHAN_VAL_BOUND(dg);
	 
			RPX[i] = PACK_PXL(rr, rg, rb, CA);
			
		}
	},
	
	{ 	
		brightness: function(brightness) {
			return brightness;
		}
	}
);

/*
 * does as little as possible to get a reasonable greyscale image
 * assumes that return can be completely opaque
 * N.B. this is the algorithm used in many older digital cameras and is
 * appropriate for especially resource-limited clients. However, it looks horrible.
 */
Ü._.imageOps.gChannelGrayscale = new Ü._.imageOps.ImgOp("gChannelGrayscale", ["canvas", "callback"], null,
	function() {
		for (var i = 0; i < CPX.length; i++) {
			MAKE_GREEN(CPX[i]);
			RPX[i] = PACK_PXL(CG, CG, CG, 0xff);
		}
	}
);

Ü._.imageOps.grayscale = new Ü._.imageOps.ImgOp("grayscale", ["canvas", "callback"], null,
	
	function() {
		
		var coefB = 0.0722;
		var coefG = 0.7152;
		var coefR = 0.2126;
		
		for (var i = 0; i < CPX.length; i++) {
			MAKE_RGBA(CPX[i]);
			var luma = CB * coefB + CG * coefG + CR * coefR;
			RPX[i] = PACK_PXL(luma, luma, luma, CA);
		}
	}
	
);

Ü._.imageOps.flipX = new Ü._.imageOps.ImgOp("flipX", ["canvas", "callback"], null,
	function() {
		for (var y = 0; y < H; y++) {
			for (var x = 0; x < W; x++) {
				var invx = W - x;
				RPX[invx + (y * W)] = CPX[x + (y * W)];
			}
		}
	}
);
	
Ü._.imageOps.flipY = new Ü._.imageOps.ImgOp("flipY", ["canvas", "callback"], null,
	function() {
		for (var y = 0; y < H; y++) {
			var invy = H - y;
			for (var x = 0; x < W; x++) {
				RPX[x + (invy * W)] = CPX[x + (y * W)];
			}
		}
	}
);
			
Ü._.imageOps.backwards = new Ü._.imageOps.ImgOp("backwards", ["canvas", "callback"], null,
	function() {
		var length = W * H;
		for (var texel = 0; texel < length; texel++) {
			RPX[texel] = CPX[length - 1 - texel];
		}
	}
);

Ü._.imageOps.makeDisplacementMap = new Ü._.imageOps.ImgOp("makeDisplacementMap", ["depths", "width", "height", "callback"], 
		
	function() {
		this.img.width = width; //not going to work// update
		this.img.height = height;
	}, 
	
	function()	{
		
		for (var i = 0; i < DEPTHS.length; i++) {
				
			var x = WIDTH - (i % WIDTH); //flipped
			var y = (i / WIDTH) | 0; //floor
			var txl = y * WIDTH + x;
				
			var depth = DEPTHS[i];
			var q = 0;		
			
			if(depth > 10000) {
				q = 0xff;	
			} else {
				q = depth / 199 * 255;
			}
			
			RPX[txl] = PACK_PXL(q, q, q, 0xff);
			
		}
		
	},
		
	{	
		depths: function(depths) { 
			return depths;
		},
		width: function(width) {
			return width;
		}					
	}
			
);

/*
 * given canvas, return new canvas scaled by x, y multipliers, 
 * OR, if explicit is truthy, x and y are dimensions in pixels
 */
Ü._.imageOps.resize = function(canvas, x, y, explicit) {

	var cw = canvas.width;
	var ch = canvas.height;
		
	var rcan = document.createElement('canvas');
		
	if (explicit) {
		rcan.width = x;
		rcan.height = y;
	} else {
		rcan.width = cw * x;
		rcan.height = ch * y;
	}

	var rctx = rcan.getContext('2d');
	rctx.drawImage(canvas, 0, 0, rcan.width, rcan.height);		
	
	return rcan;	
							
};

/*
 * provided an image and cropping bound ratios relative to each edge (0 to 1),
 * returns image of same size as source with cropped out areas transparent
 * OR, if explicit is truthy, specify cropping bounds in pixels //TODO: just ko pixels
 */
Ü._.imageOps.cropInPlace = function(canvas, left_crop, right_crop, top_crop, bottom_crop, explicit) {
			
	var rcan = document.createElement('canvas');
	rcan.width = canvas.width;
	rcan.height = canvas.height;
	var rctx = rcan.getContext('2d');
			
	if (explicit) {
		var cropL = left_crop;
		var cropR = rcan.width - right_crop - cropL;
		var cropT = top_crop;
		var cropB = rcan.height - bottom_crop - cropT;
	} else {
		var cropL = rcan.width * left_crop;
		var cropR = (rcan.width * (1 - right_crop)) - cropL;
		var cropT = rcan.height * top_crop;
		var cropB = (rcan.height * (1 - bottom_crop)) - cropT;
	}
	
	rctx.drawImage(canvas, 
		cropL, cropT, //clip x, y
		cropR, cropB, //width, height of clipped image
		cropL, cropT, //place x, y
		cropR, cropB); //width, height of image

	return rcan;
			
};

Ü._.imageOps.getImage = function(path) {
	var img = new Image();
	img.src = path;
	return img;
};


