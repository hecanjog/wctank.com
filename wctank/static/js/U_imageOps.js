/*
 * imageOps contains handy image transforms and utilities
 * load this second
 */
var Ü = Ü || {}; /*_utils_*/ Ü._ = Ü._ || {};

Ü._.imageOps = (function(imageOps) {
	
	imageOps.getImage = function(path) {
		var img = new Image();
		img.src = path;
		return img;
	};
	imageOps.getVideo = function(path) {
		var vid = document.createElement('video');
		vid.src = path;
		return vid;
	};

	/*
	 * CanvasCopyPrep bootstraps image transforms
	 * consider using in conjunction with CanvasDataPrep for functions with higher arity
	 * note on variable names: sctx = source context, rctx = returned context, etc.
	 * 
	 * if provided a CALLBACK, spawns a webworker to execute the transform, then runs the 
	 * callback when complete. REQUIRE allows the inclusion as many libraries and functions as 
	 * needed in the thread, and is either a path string relative to static/lib, or an 
	 * object in the form {fn: function, name: 'name'}
	 * 
	 * the PUSH_HOOK provides a means by which to pass additional arguments to the worker
	 * via an object, e.g., imageOps.alphaIntersect, where alpha mask (map) data is passed
	 * to the worker inside an object literal
	 */
	imageOps.CanvasCopyPrep = function(canvas, process, push_hook, callback, requires) {
		
		var little_endian = Ü._.littleEndian;
		
		var w = canvas.width;
		var h = canvas.height;
		
		var sctx = canvas.getContext('2d');
		var sdat = sctx.getImageData(0, 0, w, h);
		
		this.img = document.createElement('canvas');
		this.img.width = w;
		this.img.height = h;
		var that = this;
		
		var rctx = this.img.getContext('2d');
		var rdat = rctx.createImageData(w, h);
		
		//push to data to add arguments
		var data = [w, h, sdat, rdat, little_endian];
		
		if(typeof callback === 'function') {
			
			if (typeof push_hook === 'object') {
				data.push(push_hook);
			}
			
			if (requires) {
				
				var worker = new Parallel(data, Ü._.workerPaths.eval)
					.require({fn: process, name: 'process'});
	
				for (var i = arguments.length - 1; i > 3; i--) {
					worker.require(arguments[i]);
				}
					
			} else {
				var worker = new Parallel(data)
					.require({fn: process, name: 'process'});
			}
				
			worker.spawn(function(data) {
				
				var w = data[0];
				var h = data[1];
				var sdat = data[2];
				var rdat = data[3];
				var little_endian = data[4];
				var addl_args = data[5];
			
				var spx = new Int32Array(sdat.data.buffer);
				var rpx = new Int32Array(rdat.data.buffer);
			
				process(w, h, spx, rpx, sdat, rdat, little_endian, addl_args);
								
				return rdat;

			}).then(function(rdat) {
				rctx.putImageData(rdat, 0, 0);
				callback(that.img);
			});
		
		} else {
			
			var spx = new Int32Array(sdat.data.buffer);
			var rpx = new Int32Array(rdat.data.buffer);
			process(w, h, spx, rpx, sdat, rdat, little_endian);
			rctx.putImageData(rdat, 0, 0);
			
		}
		
	};
		
	/*
	 * canvasDataPrep prepares and exposes data for a given canvas
	 */
	imageOps.CanvasDataPrep = function(canvas) {
			
		this.w = canvas.width;
		this.h = canvas.height;
			
		this.ctx = canvas.getContext('2d'),
		this.dat = this.ctx.getImageData(0, 0, this.w, this.h);
			
		this.px = new Int32Array(this.dat.data.buffer);
			
		this.putData = function() {
			this.ctx.putImageData(this.dat, 0, 0);
		};
				
	};
		
	imageOps.copy = function(canvas, callback) {
			
		var copyFunct = function(spx, rpx) {
			for (var texel = 0; texel < spx.length; texel++) {
				rpx[texel] = spx[texel];
			}
		};
			
		if(typeof callback === 'function') {
			
			var p = new imageOps.CanvasCopyPrep(canvas, function(w, h, spx, rpx) {
					copyFunct(spx, rpx);
				},
				'',
				function(img) {
					callback(img);
				},
				{fn: copyFunct, name: 'copyFunct'}
			);
			
		} else {
			
			// for some reason, the try clause here doesn't work in all circumstances
			try {
				var r = new imageOps.CanvasCopyPrep(canvas, function(w, h, spx, rpx) {
					copyFunt(spx, rpx);
				});
			
				return r.img;
				
			} catch(err) {
				var ret_canv = document.createElement('canvas');
				ret_canv.width = canvas.width;
				ret_canv.height = canvas.height;
			
				var ret_ctx = ret_canv.getContext('2d');
				ret_ctx.drawImage(canvas, 0, 0);
				
				return ret_canv;
			}
		
		}
				
	};
	
	imageOps.flipX = function(canvas) {
			
		var r = new imageOps.CanvasCopyPrep(canvas, function(w, h, spx, rpx) {
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
			
		var r = new imageOps.CanvasCopyPrep(canvas, function(w, h, spx, rpx){
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
			
		var r = new imageOps.CanvasCopyPrep(canvas, function(w, h, spx, rpx){
			var length = w * h;
			for (var texel = 0; texel < length; texel++) {
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
	 * alphaIntersect:
	 * given a source canvas and an alpha mask, returns new canvas
	 * with source pixels that do not correspond to white (or black)
	 * pixels in mask, normalized to source dimensions
	 * 
	 * invert: if truthy, will remove pixels in source corresponding with
	 * white pixels in map, instead of black.
	 * 
	 */
	imageOps.alphaIntersect = function(source, map, invert, callback) {
		
		var filter = -16777216; // black - r 0 g 0 b 0 a 255 
		if (invert) { filter = -1; } //white - r 255 g 255 b 255 a 255
		
		var scmap = imageOps.resize(map, source.width, source.height, true);
		var scmapdat = new imageOps.CanvasDataPrep(scmap);

		var alphaIntersectFunct = function(mpx, filter, spx, rpx) {
			
			for (var texel = 0; texel < mpx.length; texel++) {
				if (mpx[texel] === filter) {
					rpx[texel] = 0x00000000;
				} else {
					rpx[texel] = -16777216; //spx[texel];
				}
			}
			
		};
		
		if(typeof callback === 'function') {
			
			var map_args = {
				filter: filter,
				mdat: scmapdat.dat
			};
			
			var p = new imageOps.CanvasCopyPrep(source, function(w, h, spx, rpx, sdat, rdat, little_endian, map_args) {
					var mpx = new Int32Array(map_args.mdat.data.buffer);
					alphaIntersectFunct(mpx, map_args.filter, spx, rpx);
				}, 
				
				map_args, 
				
				function(img) {
					callback(img);
				},
				{fn: alphaIntersectFunct, name: 'alphaIntersectFunct'}
			);
		
		} else { 
			
			var r = new imageOps.CanvasCopyPrep(source, function(w, h, spx, rpx) {
				alphaIntersectFunct(scmapdat.px, filter, spx, rpx);	
			});
			
			return r.img;
			
		}	
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
		
	/*
	 * for constructing an image from depth data got through 
	 * GSVPanoDepths
	 */
	imageOps.makeDisplacementMap = function(depths, width, height) {
			
		var rimg = document.createElement('canvas');
		rimg.width = width;
		rimg.height = height;
			
		var r = new imageOps.CanvasDataPrep(rimg);
			
		var little = Ü._.littleEndian;
			
		for (var i = 0; i < depths.length; i++) {
				
			var x = width - (i % width); //flipped
			var y = (i / width) | 0; //floor
			var txl = y * width + x;
				
			var depth = depths[i];
			var q = 0;		
			
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
	 * uses jsfeat for canny edge detection
	 * if provided a callback, spawns a webworker to perform transform in background, calls back
	 * otherwise, executes the transform in the UI thread and returns a new canvas
	 */
	imageOps.cannyEdge = function(canvas, callback) {
		
		var cannyEdgeFunct = function(w, h, rpx, sdat, little_endian) {
			
			var mtx = new jsfeat.matrix_t(w, h, jsfeat.U8C1_t);
			
			jsfeat.imgproc.grayscale(sdat.data, mtx.data);
			jsfeat.imgproc.canny(mtx, mtx, 95, 105);
			
			if(little_endian) {
				
				for (var txl = 0; txl < rpx.length; txl++) {
					var val = mtx.data[txl];
					rpx[txl] = (0xff << 24) | (val << 16) | (val << 8) | val;
				}
				
			} else {
				
				for (var txl = 0; txl < rpx.length; txl++) {
					var val = mtx.data[txl];
					rpx[txl] = (val << 24) | (val << 16) | (val << 8) | 0xff;
				}
				
			}
			
		};
		
		if(typeof callback === 'function') {
		
			var p = new imageOps.CanvasCopyPrep(canvas, function(w, h, spx, rpx, sdat, rdat, little_endian) {
					cannyEdgeFunct(w, h, rpx, sdat, little_endian);
				},
				
				'', 
				
				function(img) {	
					callback(img);	
				},
				
				Ü._.workerPaths.jsfeat, 
				{fn: cannyEdgeFunct, name: 'cannyEdgeFunct'}
				
			);
		
		} else {
			
			var r = new imageOps.CanvasCopyPrep(canvas, function(w, h, spx, rpx, sdat, rdat, little_endian) {
				cannyEdgeFunct(w, h, rpx, sdat, little_endian);
			});
			
			return r.img;
			
		}
	};
	
	return imageOps;
		
})({});
