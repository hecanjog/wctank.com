var Ü = (function(Ü) {
	
	Ü._utils = Ü._utils || {};
	Ü._utils.project = {};
	Ü._utils.project.eq2Cube = {};
	
	var FLOOR = Math.floor,
		RND = Math.round,
		PI = Math.PI;
	
	Ü._utils.project.eq2Cube.transCanvas = function(canvas) {
		//clearly need to rewrite this using the inverse transform
		
		var can = canvas, 
			width = can.width,
			height = can.height,
			total = width * height;
			
		//prepare for extraction
		var ctx = can.getContext('2d'),
			dat = ctx.getImageData(0, 0, width, height),
			px = new Int32Array(dat.data.buffer);
		
		//length of side on face on cube we're pooping out
		var slen = Math.floor(Math.sqrt((width * height) / 6));
		
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
			
			//get spherical coord (phi, theta) of texel tuplet
			var x = texel % width,
				y = FLOOR(texel / width);
			
			var phi = ((2 * PI * x) / width) - PI,
				theta = (PI / 2) - ((PI * y) / height);
			
			//transform, get face, x, y
			var loc = Ü._utils.project.eq2Cube.forward(phi, theta),
				face = loc[0],
				norx = loc[1],
				nory = loc[2];
			
			var facx = (norx + 1) * (slen / 2),
				facy = slen - ((nory + 1) * (slen / 2));
						
			//copy over point
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
		//simple cubic projection from equirectangular panorama
		//OR, wherein we make javascript look like COBOL and call it optimized
					
		var sx = COS(phi) * COS(theta),
			sy = COS(phi) * SIN(theta),
			sz = COS(theta);
						
		var mmax = 0, 
			idx = 0; 
			
		var msx = ABS(sx),
			msy = ABS(sy),
			msz = ABS(sz);
		
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
				y = sy / mmax;
				if (sign === 0) { y = -y; }
				break;
			case 4:
				if (sz > 0) { sign++; }
				face = idx + sign;
				x = sx / mmax;
				y = sy / mmax;
				if (sign === 0)  { y = -y; }
				break;
		}
					
		return [face, x, y];
			
	};
		
	return Ü;
	
}(Ü || {}));