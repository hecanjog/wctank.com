/*
 * imageOps contains handy image transforms and utilities
 * TODO: abstract out some of the repetitive cruft
 * object containing new canvas (opt) with constructor
 * context
 * data
 * int32array
 */
var Ü = (function(Ü) {
	
	Ü._ = Ü._ || {};

	Ü._.imageOps = (function(imageOps) {
		
		var FLOOR = Math.floor,
		    ROUND = Math.round;
		
		/*
		 * canvasCopyPrep bootstraps image transforms where there is
		 * 1 antecedant and 1 resultant
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
			
			var sctx = canvas.getContext('2d'),
			    sdat = sctx.getImageData(0, 0, this.w, this.h);
			
			this.px = new Int32Array(sdat.data.buffer);
			
			this.putData = function() {
				sctx.putImageData(sdat, 0, 0);
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
		 * alphaIntersect:
		 * this isn't working yet
		 */
		imageOps.alphaIntersect = function(source, map, invert) {

			var inv = invert || false;
			
			var filter = -1;
			if (inv) { filter = -16579837; }

			var black = -16579837,
			    white = -1;
      		
      		var m = new Ü._.imageOps.canvasDataPrep(map);
      		
			var z = new Ü._.imageOps.canvasCopyPrep(source, function(w, h, spx, rpx){
				var slen = w * h;
				var mul = m.px.length / slen;
				for (texel = 0; texel < slen; texel++) {
					var mtexel = ROUND(texel * mul);
					if (m.px[mtexel] === filter) {
						rpx[texel] = 0x00000000;
					} else {
						rpx[texel] = spx[texel];
					}
				}
			});
			
			document.body.appendChild(z.img);
			return z.img;	
		};
		
		//imageOps.alphaComplement = function(){};
		//imageOps.chromakey = function(){};
		
		return imageOps;
		
	})({});
	
return Ü;
	
}(Ü || {}));