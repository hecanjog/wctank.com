/*
 * imageOps contains handy image transforms
 * TODO: abstract out some of the repetitive cruft
 */
var Ü = (function(Ü) {
	
	Ü._ = Ü._ || {};

	Ü._.imageOps = (function(imageOps) {
		
		var FLOOR = Math.floor,
			ROUND = Math.round;
		
		imageOps.flipHorizontal = function(canvas) {
			
			var srw = canvas.width,
				srh = canvas.height;
			
			var sctx = canvas.getContext('2d'),
			    sdat = sctx.getImageData(0, 0, srw, srh),
			    spx = new Int32Array(sdat.data.buffer);
			    
			var rimg = document.createElement('canvas');
      		rimg.width = srw;
      		rimg.height = srh;
      		
      		var rctx = rimg.getContext('2d'),
      		    rdat = rctx.createImageData(srw, srh),
      		    rpx = new Int32Array(rdat.data.buffer);
      		
      		for (y = 0; y < srh; y++) {
      			for (x = 0; x < srw; x++) {
      				var invx = srw - x;
      				rpx[invx + (y * srw)] = spx[x + (y * srw)];
      			}
      		}

      		rctx.putImageData(rdat, 0, 0);
      		return rimg;
  		};
		
		imageOps.flipVertical = function(canvas) {
			
			var srw = canvas.width,
				srh = canvas.height;
			
			var sctx = canvas.getContext('2d'),
			    sdat = sctx.getImageData(0, 0, srw, srh),
			    spx = new Int32Array(sdat.data.buffer);
			    
			var rimg = document.createElement('canvas');
      		rimg.width = srw;
      		rimg.height = srh;
      		
      		var rctx = rimg.getContext('2d'),
      		    rdat = rctx.createImageData(srw, srh),
      		    rpx = new Int32Array(rdat.data.buffer);
      		
      		for (y = 0; y < srh; y++) {
      			var invy = srh - y;
      			for (x = 0; x < srw; x++) {
      				rpx[x + (invy * srw)] = spx[x + (y * srw)];
      			}
      		}

      		rctx.putImageData(rdat, 0, 0);
      		return rimg;	
		};
		
		/*
		 * imageOps.backwards reads input canvas backwards,
		 * so result is flipped vertically and horizontally
		 */
		imageOps.backwards = function(canvas) {
			
			var srw = canvas.width,
				srh = canvas.height;
			
			var sctx = canvas.getContext('2d'),
			    sdat = sctx.getImageData(0, 0, srw, srh),
			    spx = new Int32Array(sdat.data.buffer);
			    
			var rimg = document.createElement('canvas');
      		rimg.width = srw;
      		rimg.height = srh;
      		
      		var rctx = rimg.getContext('2d'),
      		    rdat = rctx.createImageData(srw, srh),
      		    rpx = new Int32Array(rdat.data.buffer);
      		
      		var length = spx.length;
      		
      		for (texel = 0; texel < length; texel++) {
      			rpx[texel] = spx[length - 1 - texel];
      		}
      		
      		rctx.putImageData(rdat, 0, 0);
			return rimg;
		};
		
		/*
		 * alphaIntersect:
		 * this isn't working yet
		 */
		imageOps.alphaIntersect = function(source, map, invert) {

			var inv = invert || false;
			
			var filter = -1;
			if (inv) {
				filter = -16579837;
			}

			var black = -16579837,
				white = -1;
			
			var srw = source.width,
				srh = source.height;
			
			var sctx = source.getContext('2d'),
			    sdat = sctx.getImageData(0, 0, srw, srh),
			    spx = new Int32Array(sdat.data.buffer);
			
			var mctx = map.getContext('2d'),
                mdat = mctx.getImageData(0, 0, map.width, map.height),
                mpx = new Int32Array(mdat.data.buffer);
      		
      		console.log(mpx[mpx.length - 1]);
      		
      		var rimg = document.createElement('canvas');
      		rimg.width = srw;
      		rimg.height = srh;
      		
      		var rctx = rimg.getContext('2d'),
      		    rdat = rctx.createImageData(srw, srh),
      		    rpx = new Int32Array(rdat.data.buffer);
      		
      		var mul = mpx.length / spx.length;
      		
			for (texel = 0; texel < spx.length; texel++) {
				var mtexel = ROUND(texel * mul);
				if (mpx[mtexel] === filter) {
					rpx[texel] = 0x00000000;	
				} else {
					rpx[texel] = spx[texel];
				}
			}
			
			rctx.putImageData(rdat, 0, 0);
			document.body.appendChild(rimg);
			return rimg;	
		};
		
		//imageOps.alphaComplement = function(){};
		//imageOps.chromakey = function(){};
		
		return imageOps;
		
	})({});
	
return Ü;
	
}(Ü || {}));