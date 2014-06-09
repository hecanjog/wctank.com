var Ü = (function(Ü) {
	
	Ü._utils = Ü._utils || {};
	Ü._utils.project = {};
	Ü._utils.project.eq2Cube = {};
	
	var FLOOR = Math.floor,
		SQRT = Math.sqrt,
		RND = Math.round,
		PI = Math.PI;
	
	Ü._utils.project.eq2Cube.transCanvas = function(canvas) {
		//clearly need to rewrite this using the inverse transform
		
		var can = canvas, 
			width = can.width,
			height = can.height,
			total = width * height;
			
		//prepare data
		var ctx = can.getContext('2d'),
			dat = ctx.getImageData(0, 0, width, height),
			px = new Int32Array(dat.data.buffer);
		
		//length of side on face on output cube
		var slen = FLOOR(SQRT((width * height) / 6));
		
		//create canvas and init data for each face
		var faces = [];
		for (face = 0; face < 6; face++) {
			var _can = document.createElement('canvas');
			_can.width = _can.height = slen;
			
			var _ctx = _can.getContext('2d'),
				_dat = _ctx.createImageData(slen, slen);
				_px = new Int32Array(_dat.data.buffer);
			
			faces[face] = [_can, _ctx, _dat, _px];
		}
		
		for (texel = 0; texel < total; texel++) {
			
			//get spherical coord (phi, theta) of texel in rad
			var x = ((texel % width) / (width / 2)) - 1,
				y = 1 - (FLOOR(texel / width) / (height / 2));
			
			var phi = PI * x,
				theta = (PI / 2) * y;
						
			//project, get normalized face, x, y
			var loc = Ü._utils.project.eq2Cube.forward(phi, theta),
				face = loc[0],
				norx = loc[1],
				nory = loc[2];
			
			//denormalize x, y to coords on face with (0,0) at upper left
			var facx = (norx + 1) * (slen / 2),
				facy = slen - ((nory + 1) * (slen / 2));

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
		//simpler cubic projection from equirectangular panorama
		//here, phi = azimuth, theta = inclination
		
		//phi, theta to spherical coordinates, with y and z same as world space:
		//z = in/out (depth), y = elevation	
		var sx = SIN(theta) * COS(phi),
			sy = COS(theta),
			sz = SIN(theta) * SIN(theta);
						
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
		 * For each value of idx, if the value of the vector with the largest magnitude is positive, increment sign
		 * and get face index by adding sign and idx so that 1 = x_pos, 3 = y_pos, 5 = z_pos.
		 * 
		 * Then, normalize (x, y) by maximum magnitude, and invert so that (x, y) on each face
		 * corresponds to world space, e.g. +x dimen of face 0 (x_neg - to the left at world origin) = 
		 * -z in world space, or 'away' from camera along world axis at the camera's initial positon.
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