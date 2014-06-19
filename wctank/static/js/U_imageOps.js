/*
 * imageOps contains handy image transforms and utilities
 */
var Ü = (function(Ü) {
	
	Ü._ = Ü._ || {};

	Ü._.imageOps = (function(imageOps) {
		
		var FLOOR = Math.floor,
		    ROUND = Math.round;
		
		/*
		 * canvasCopyPrep bootstraps image transforms where there is
		 * 1 antecedant and 1 resultant that are the same size
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
			
			process(w, h, spx, rpx);
			
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
		
		imageOps.flipX = function(canvas) {
			
			var z = new Ü._.imageOps.canvasCopyPrep(canvas, function(w, h, spx, rpx){
				for (y = 0; y < h; y++) {
					for (x = 0; x < w; x++) {
      					var invx = w - x;
      					rpx[invx + (y * w)] = spx[x + (y * w)];
      				}
      			}
			});
      		
      		return z.img;
  		};
		
		imageOps.flipY = function(canvas) {
			
			var z = new Ü._.imageOps.canvasCopyPrep(canvas, function(w, h, spx, rpx){
				for (y = 0; y < srh; y++) {
      				var invy = srh - y;
      				for (x = 0; x < srw; x++) {
      					rpx[x + (invy * srw)] = spx[x + (y * srw)];
      				}
      			}
      		});
		
			return z.img;	
		};
		
		/*
		 * imageOps.backwards reads input canvas backwards,
		 * so result is flipped vertically and horizontally
		 */
		imageOps.backwards = function(canvas) {
			
			var z = new Ü._.imageOps.canvasCopyPrep(canvas, function(w, h, spx, rpx){
				var length = w * h;
				for (texel = 0; texel < length; texel++) {
      				rpx[texel] = spx[length - 1 - texel];
      			}
			});
			
			return z.img;
		};
		
		/*
		 * given canvas, return new canvas scaled by x, y multipliers
		 */
		imageOps.scale = function(canvas, x, y) {
			
			var cw = canvas.width,
				ch = canvas.height;
			
			var rcan = document.createElement('canvas');
			rcan.width = cw * x;
			rcan.height = ch * y;
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
		 * TODO: add interpolation
		 * 
		 */
		imageOps.alphaIntersect = function(source, map, invert) {

			var filter = 255; // black - r 0 g 0 b 0 a 255 
			if (invert) { filter = -1; } //white - r 255 g 255 b 255 a 255

			var mw = map.width;
      		
			var z = new Ü._.imageOps.canvasCopyPrep(source, function(w, h, spx, rpx){
	
				var mul = w / mw;
				var scmap = Ü._.imageOps.scale(map, mul, mul);
				var scmapdat = new Ü._.imageOps.canvasDataPrep(scmap);
				
				for (texel = 0; texel < spx.length; texel++) {
					if (scmapdat.px[texel] === filter) {
						rpx[texel] = (0x00000000);
					} else {
						rpx[texel] = spx[texel];
					}
				}
			});
			
			return z.img;	
		};
				
		//imageOps.chromakey = function(){};
		
		return imageOps;
		
	})({});
	
return Ü;
	
}(Ü || {}));