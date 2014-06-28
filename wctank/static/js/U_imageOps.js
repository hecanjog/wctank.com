/*
 * imageOps contains handy image transforms and utilities
 */
var Ü = (function(Ü) {
	
	Ü._ = Ü._ || {};

	Ü._.imageOps = (function(imageOps) {
		
		/*
		 * canvasCopyPrep bootstraps unary image transforms
		 * consider using in conjunction with canvasDataPrep for functions with higher arity
		 * note on variable names: sctx = source context, rctx = returned context, etc.
		 */
		imageOps.canvasCopyPrep = function(canvas, process) {
			
			var w = canvas.width,
				h = canvas.height;
			
			var sctx = canvas.getContext('2d'),
			    sdat = sctx.getImageData(0, 0, w, h),
			    spx = new Int32Array(sdat.data.buffer);
			
			this.img = document.createElement('canvas');
			this.img.width = w;
			this.img.height = h;
			
			var rctx = this.img.getContext('2d'),
			    rdat = rctx.createImageData(w, h),
			    rpx = new Int32Array(rdat.data.buffer);
			
			process(w, h, spx, rpx, sdat, rdat, sctx, rctx);
			
			rctx.putImageData(rdat, 0, 0);
			
		};
		
		/*
		 * canvasDataPrep prepares and exposes data for a given canvas
		 */
		imageOps.canvasDataPrep = function(canvas) {
			
			this.w = canvas.width;
			this.h = canvas.height;
			
			this.ctx = canvas.getContext('2d'),
			this.dat = this.ctx.getImageData(0, 0, this.w, this.h);
			
			this.px = new Int32Array(this.dat.data.buffer);
			
			this.putData = function() {
				this.ctx.putImageData(this.dat, 0, 0);
			};
				
		};
		
		imageOps.copy = function(canvas) {
			
			var ret_canv = document.createElement('canvas');
			ret_canv.width = canvas.width;
			ret_canv.height = canvas.height;
			
			var ret_ctx = ret_canv.getContext('2d');
			ret_ctx.drawImage(canvas, 0, 0);
			
			return ret_canv;
			
		};
		
		imageOps.flipX = function(canvas) {
			
			var r = new imageOps.canvasCopyPrep(canvas, function(w, h, spx, rpx){
				for (y = 0; y < h; y++) {
					for (x = 0; x < w; x++) {
      					var invx = w - x;
      					rpx[invx + (y * w)] = spx[x + (y * w)];
      				}
      			}
			});
      		
      		return r.img;
      		
  		};
		
		imageOps.flipY = function(canvas) {
			
			var r = new imageOps.canvasCopyPrep(canvas, function(w, h, spx, rpx){
				for (y = 0; y < srh; y++) {
      				var invy = srh - y;
      				for (x = 0; x < srw; x++) {
      					rpx[x + (invy * srw)] = spx[x + (y * srw)];
      				}
      			}
      		});
		
			return r.img;
				
		};
		
		/*
		 * imageOps.backwards reads input canvas backwards,
		 * so result is flipped vertically and horizontally
		 */
		imageOps.backwards = function(canvas) {
			
			var r = new imageOps.canvasCopyPrep(canvas, function(w, h, spx, rpx){
				var length = w * h;
				for (texel = 0; texel < length; texel++) {
      				rpx[texel] = spx[length - 1 - texel];
      			}
			});
			
			return r.img;
			
		};
		
		/*
		 * given canvas, return new canvas scaled by x, y multipliers, 
		 * OR, if explicit is truthy, x and y are dimensions in pixels
		 */
		imageOps.resize = function(canvas, x, y, explicit) {
			
			var cw = canvas.width,
				ch = canvas.height;
			
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
		 * alphaIntersect:
		 * given a source canvas and an alpha mask, returns new canvas
		 * with source pixels that do not correspond to white (or black)
		 * pixels in mask, normalized to source dimensions
		 * 
		 * invert: if truthy, will remove pixels in source corresponding with
		 * white pixels in map, instead of black.
		 * 
		 */
		imageOps.alphaIntersect = function(source, map, invert) {

			var filter = -16777216; // black - r 0 g 0 b 0 a 255 
			if (invert) { filter = -1; } //white - r 255 g 255 b 255 a 255

			var r = new imageOps.canvasCopyPrep(source, function(w, h, spx, rpx) {
	
				var scmap = imageOps.resize(map, w, h, true),
					scmapdat = new imageOps.canvasDataPrep(scmap);
				
				for (texel = 0; texel < spx.length; texel++) {
					if (scmapdat.px[texel] === filter) {
						rpx[texel] = 0xff;
					} else {
						rpx[texel] = spx[texel];
					}
				}
			});
			
			return r.img;	
			
		};
				
		/*
		 * provided an image and cropping bound ratios relative to each edge (0 to 1),
		 * returns image of same size as source with cropped out areas transparent
		 * OR, if explicit is truthy, specify cropping bounds in pixels
		 */
		imageOps.cropInPlace = function(canvas, left_crop, right_crop, top_crop, bottom_crop, explicit) {
			
			var rcan = document.createElement('canvas');
			rcan.width = canvas.width;
			rcan.height = canvas.height;
			var rctx = rcan.getContext('2d');
			
			if (explicit) {
				var cropL = left_crop,
					cropR = rcan.width - right_crop - cropL,
					cropT = top_crop,
					cropB = rcan.height - bottom_crop - cropT;
			} else {
				var cropL = rcan.width * left_crop,
					cropR = (rcan.width * (1 - right_crop)) - cropL,
					cropT = rcan.height * top_crop,
					cropB = (rcan.height * (1 - bottom_crop)) - cropT;
			}
	
			rctx.drawImage(canvas, 
				cropL, cropT, //clip x, y
				cropR, cropB, //width, height of clipped image
				cropL, cropT, //place x, y
				cropR, cropB); //width, height of image

			return rcan;
			
		};
		
		/*
		 * for constructing an image from depth data got through 
		 * GSVPanoDepths
		 */
		imageOps.makeDisplacementMap = function(depths, width, height) {
			
			var rimg = document.createElement('canvas');
			rimg.width = width;
			rimg.height = height;
			
			var r = new imageOps.canvasDataPrep(rimg);
			
			var little = Ü._.littleEndian;
			
			for (i = 0; i < depths.length; i++) {
				
				var x = width - (i % width), //flipped
					y = (i / width) | 0, //floor
					txl = y * width + x;
				
				var depth = depths[i],
					q = 0;		
				
				if(depth > 10000) {
					q = 0xff;	
				} else {
					q = depth / 199 * 255;
				}
				
				if (little) {
					r.px[txl] = (0xff << 24) | (q << 16) | (q << 8) | q;	
				} else {
					r.px[txl] = (q << 24) | (q << 16) | (q << 8) | 0xff;
				}
			
			}
			
			r.putData();
			return rimg;
			
		};
		
		/*
		 * uses JSFeat for canny edge detection
		 */
		imageOps.cannyEdge = function(canvas) {
	
			var r = new imageOps.canvasCopyPrep(canvas, function(w, h, spx, rpx, sdat) {
				
				var mtx = new jsfeat.matrix_t(w, h, jsfeat.U8C1_t);
				
				jsfeat.imgproc.grayscale(sdat.data, mtx.data);
				jsfeat.imgproc.canny(mtx, mtx, 105, 130);
								
				if (Ü._.littleEndian) {
				
					for (txl = 0; txl < rpx.length; txl++) {
						var val = mtx.data[txl];
						rpx[txl] = (0xff << 24) | (val << 16) | (val << 8) | val;
					}
				
				} else {
				
					for (txl = 0; txl < rpx.length; txl++) {
						var val = mtx.data[txl];
						rpx[txl] = (val << 24) | (val << 16) | (val << 8) | 0xff;
					}
				
				}
				
			});
			
			return r.img;
			
		};
		
		return imageOps;
		
	})({});
	
	return Ü;
	
}(Ü || {}));