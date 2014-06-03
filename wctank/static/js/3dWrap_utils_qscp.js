/*
 * this file, with the exception of the "QSCP.transform" function, 
 * is a port of the "QuadSphere" gem
 * license: https://github.com/cix/QuadSphere/blob/master/COPYING
 */

var Ü = (function(Ü) {
	
	Ü._utils = Ü._utils || {};
	Ü._utils.QSCP = {};
	
	Ü._utils.QSCP.transform = function(canvas) {
		var canvas_to_transform = canvas,
			width = canvas_to_transform.width,
			height = canvas_to_transform.height;
		
		var side_length = Math.floor(Math.sqrt(width * height / 6));

		//make canvas, context, and data objects for each face
		var face_tex = [];
		for (i = 0; i < 6; i++) {
			face_tex[i] = document.createElement('canvas');
			face_tex[i].width = face_tex[i].height = side_length;
		}		

		//normalizes point in texels between -1 and 1
		function normalizeCartesian(point) {
			return point * (2 / side_length) - 1;
		}
		function phiToX(phi) {
			return phi + Math.PI * (width/(2 * Math.PI));
		}
		function thetaToY(theta) {
			return height - (theta + (Math.PI/2) * (height/Math.PI));
		}
		
		//get location on face, retreive proper pixel on original sphere
		var tex_ctx = canvas_to_transform.getContext('2d');
		var	tex_dat = tex_ctx.getImageData(0, 0, width, height);
		var tex_px = new Int32Array(tex_dat.data.buffer);
		
				
		for (face = 0; face < 6; face++) {
			var face_ctx = face_tex[face].getContext('2d');
			var face_dat = face_ctx.getImageData(0, 0, side_length, side_length);
			var face_px = new Int32Array(face_dat.data.buffer);
			
			for (y = 0; y < side_length; y++) {
				var csy = normalizeCartesian(y) * -1;
				for (x = 0; x < side_length; x++) {
					var	loc = transforms.inverse(face, normalizeCartesian(x), csy);
					
					var	sph_pt = Math.floor(phiToX(loc[0]) + (width * thetaToY(loc[1])));
					var face_pt = x + side_length * y;
					//console.log('face = '+face+' lat lng = '+loc+' sph_pt ='+sph_pt+' face_pt = '+face_pt+' x = '+x+' y = '+y+' side = '+side_length);
					face_px[face_pt] = tex_px[sph_pt];
				}
			}		
			
			face_ctx.putImageData(face_dat, 0, 0);

		}
						
		return face_tex;
		
	};

		var transforms = (function(transforms) {
					
			transforms.inverse = function(face, x, y) {
				var chi = distort.inverse(x, y),
					psi = distort.inverse(y, x);
			
				return tangential.inverse(face, chi, psi);	
			};
			
			return transforms;
			
		})({});
		
		var distort = (function(distort) {
						
			distort.inverse = function(x, y) {
				
				var x2  = x * x,
      				x4  = Math.pow(x, 4),
      				x6  = Math.pow(x, 6),
      				x8  = Math.pow(x, 8),
      				x10 = Math.pow(x, 10),
      				x12 = Math.pow(x, 12),
      				y2  = y * y,
      				y4  = Math.pow(y, 4),
      				y6  = Math.pow(y, 6),
     				y8  = Math.pow(y, 8),
      				y10 = Math.pow(y, 10),
      				y12 = Math.pow(y, 12);
      				
      			return  x + x*(1 - x2) *
        				(-0.27292696 - 0.07629969 * x2 -
         				0.22797056 * x4 + 0.54852384 * x6 -
         				0.62930065 * x8 + 0.25795794 * x10 +
     				    0.02584375 * x12 - 0.02819452 * y2 -
      				  	0.01471565 * x2 * y2 + 0.48051509 * x4 * y2 -
       					1.74114454 * x6 * y2 + 1.71547508 * x8 * y2 -
         				0.53022337 * x10 * y2 + 0.27058160 * y4 -
         				0.56800938 * x2 * y4 + 0.30803317 * x4 * y4 +
        				0.98938102 * x6 * y4 - 0.83180469 * x8 * y4 -
         				0.60441560 * y6 + 1.50880086 * x2 * y6 -
         				0.93678576 * x4 * y6 + 0.08693841 * x6 * y6 +
        				0.93412077 * y8 - 1.41601920 * x2 * y8 +
         				0.33887446 * x4 * y8 - 0.63915306 * y10 +
         				0.52032238 * x2 * y10 + 0.14381585 * y12);
      			
			};
			
			return distort;
			
		})({});
		
		var tangential = (function(tangential) {
						
			var INVERSE_PARAMETERS = [ function (xi, eta, zeta) { return [-eta, xi, zeta]; }, 
									   function (xi, eta, zeta) { return [zeta, xi, eta]; },
									   function (xi, eta, zeta) { return [-xi, zeta, eta]; },
									   function (xi, eta, zeta) { return [-zeta, -xi, eta]; },
									   function (xi, eta, zeta) { return [xi, -zeta, eta]; },
									   function (xi, eta, zeta) { return [eta, xi, -zeta]; } ];
			
			tangential.inverse = function(face, chi, psi) {
				var zeta = 1 / Math.sqrt(1.0 + Math.pow(chi, 2) + Math.pow(psi, 2)),
					xi = chi * zeta,
					eta = psi * zeta;
					
				var exz = INVERSE_PARAMETERS[face](xi, eta, zeta);
				
				var l = exz[0],
					m = exz[1],
					n = exz[2];
								
				return [Math.atan2(m, l), Math.asin(n)];
			};
			
			return tangential;
			
		})({});

      	return Ü;
	
}(Ü || {}));