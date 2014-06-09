var Ü = (function(Ü) {
	
	Ü._utils = Ü._utils || {};
	Ü._utils.project = {};
	Ü._utils.project.eq2Cube = {};
	
	var FLOOR = Math.floor,
		ASIN = Math.asin,
		SQRT = Math.sqrt,
		RND = Math.round,
		PI = Math.PI;
	
	Ü._utils.project.eq2Cube.transCanvas = function(canvas) {
		/*
		 * given a canvas containing an equirectangular image
		 * for projection onto a sphere, return 6 canvases
		 * corresponding to faces of cube
		 */
					
		//clearly need to rewrite this using the inverse transform
		//here, phi = azimuth, theta = inclination
		var can = canvas, 
			width = can.width,
			height = can.height,
			total = width * height;
			
		//prepare pixels of input image as array of 32-bit Ints
		var ctx = can.getContext('2d'),
			dat = ctx.getImageData(0, 0, width, height),
			px = new Int32Array(dat.data.buffer);
		
		//length of side of face on output cube
		var slen = FLOOR(SQRT((width * height) / 6));

		//create canvas and prepare data for each face
		var faces = [];
		for (face = 0; face < 6; face++) {
			var _can = document.createElement('canvas');
			_can.width = _can.height = slen;
			
			var _ctx = _can.getContext('2d'),
				_dat = _ctx.createImageData(slen, slen);
				_px = new Int32Array(_dat.data.buffer);
			
			faces[face] = [_can, _ctx, _dat, _px];
		}
		
		//texel = pixel on original panorama
		for (texel = 0; texel < total; texel++) {
			
			//get spherical coord (phi, theta) of texel in rad
			//u, v for point in original image
			var u = texel % width,
				v = FLOOR(texel / width);
			
			//normalize between -1 and 1 in both dimensions
			var nu = (2 * u / width) - 1,
				nv = 1 - (2 * v / height);
			
			//normalize between azimuth [-pi, pi] and inclination [-pi/2, pi/2],
			//correcting for vertical spherical distortion 
			var phi = PI * nu,
				theta = ASIN(nv);
						
			//call projection, get face and normalized x, y
			var loc = Ü._utils.project.eq2Cube.forward(phi, theta),
				face = loc[0],
				x = loc[1],
				y = loc[2];
			
			//denormalize x, y to coords in image space with (0,0) at upper left
			var facx = (x + 1) * (slen / 2),
				facy = slen - ((y + 1) * (slen / 2));

			//copy over point from pano into face
			faces[face][3][RND(facy * slen + facx)] = px[texel];
						
		}
		
		//write image data to each face canvas
		for (face = 0; face < 6; face++) {
			faces[face][1].putImageData(faces[face][2], 0, 0);
		}
		//return canvases -x, +x, -y, +y, -z, +z
		return [faces[0][0], faces[1][0], faces[2][0], faces[3][0], faces[4][0], faces[5][0]];
			
	};	
	
	var COS = Math.cos,
		SIN = Math.sin,
		ABS = Math.abs;
	
	Ü._utils.project.eq2Cube.forward = function(phi, theta) {
		/*
		 * given phi (azimuth) and theta (inclination), 
		 * get normalized x, y coord and face of cube containing it
		 */

		//phi, theta to spherical coordinates, with y and z same as world space:
		//z = in/out (depth), y = elevation
		var sx = COS(phi) * COS(theta),
			sy = SIN(theta),
			sz = SIN(phi) * COS(theta);
						
		var mmax = 0, 
			idx = 0; 
		
		//get magnitudes of coords	
		var msx = ABS(sx),
			msy = ABS(sy),
			msz = ABS(sz);
		
		//find max magnitude, set idx to neg face index (0 = x_neg, 2 = y_neg, 4 = z_neg)
		if (msx > msy) {
			mmax = msx;
			idx = 0;
		} else {
			mmax = msy;
			idx = 2;
		}
		if (msz > mmax) {
			mmax = msz;
			idx = 4;
		}
		
		/*
		 * For each value of idx, if the value of the largest vector is positive, increment sign
		 * and get face index by adding sign and idx so that 
		 * 0 = x_neg, 1 = x_pos, 2 = y_neg, 3 = y_pos, 4 = z_neg, 5 = z_pos.
		 * 
		 * Then, normalize (x, y) by maximum magnitude, and invert so that (x, y) on each face
		 * corresponds to world space, e.g. +x dimen of face 0 (x_neg - to the left at world origin) = 
		 * -z in world space, or 'away' from camera along world axis from the camera's initial positon.
		 */		
		var sign = 0,
			face = 0,
			x = 0,
			y = 0;
		
		switch (idx) {
			case 0: 
				if (sx > 0) { sign++; }
				face = idx + sign;
				x = sz / mmax;
				if (sign === 0) { x = -x; }
				y = sy / mmax;
				break;
			case 2:
				if (sy > 0) { sign++; }
				face = idx + sign;
				x = sx / mmax;
				y = sz / mmax;
				if (sign === 0) { y = -y; }
				break;
			case 4:
				if (sz > 0) { sign++; }
				face = idx + sign;
				x = sx / mmax;
				y = sy / mmax;
				if (sign === 1)  { x = -x; }
				break;
		}

		return [face, x, y];
			
	};
			
	return Ü;
	
}(Ü || {}));