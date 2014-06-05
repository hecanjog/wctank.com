/*
 * this file, with the exception of the "QSCP.transform" function, 
 * is a partial port of the "QuadSphere" gem
 * license: https://github.com/cix/QuadSphere/blob/master/COPYING
 */

var Ü = (function(Ü) {
	
	Ü._utils = Ü._utils || {};
	Ü._utils.QSCP = {};
	
	Ü._utils.QSCP.transform = function(canvas) {
		var canvas_to_transform = canvas,
			width = canvas_to_transform.width,
			height = canvas_to_transform.height,
			total = width * height;
		
		var side_length = Math.floor(Math.sqrt(total / 6));

		//make canvas, context, and data objects for each face	

		//normalizes point in texels between -1 and 1
		function normalizeCartesian(point) {
			return point * (2 / side_length) - 1;
		}
		function phiToX(phi) {
			//return (phi * Math.cos(std_parallel)) + Math.PI * (width/(2 * Math.PI));
			return phi + Math.PI * (width/(2 * Math.PI)) * (1/Math.sin(phi));
		}
		function thetaToY(theta) {
			return height - (theta + (Math.PI/2) * (height/Math.PI)) * Math.cos(theta);
		}
		
		//make canvas, context, and data objects for each face
		var tex_ctx = canvas_to_transform.getContext('2d'),
			tex_dat = tex_ctx.getImageData(0, 0, width, height),
			tex_px = new Int32Array(tex_dat.data.buffer);

		var face_tex = [];
		for (i = 0; i < 6; i++) {
			var canvas = document.createElement('canvas');
				canvas.width = canvas.height = side_length;
							
			var	ctx = canvas.getContext('2d'),
				dat = ctx.getImageData(0, 0, side_length, side_length),
				px = new Int32Array(dat.data.buffer);
			
			face_tex[i] = [canvas, ctx, dat, px];
		}	
		
		//pixel on image, to cartesian, to spherical (-pi., pi, -pi/2, pi/2)
		//get location on image, place proper pixel on face		
		for (tex_pt = 0; tex_pt < total; tex_pt++) {
			
			var x = tex_pt % width,
				y = Math.floor(tex_pt / width);
			
			//normalize x between -pi - pi, y between -pi/2, pi/2
			var phi = ((x / width) * 2 * Math.PI) - Math.PI,
				theta = ((y / height) * Math.PI) - (Math.PI / 2);
				
			var loc = transforms.forward(phi, theta),
				face = loc[0],
				sx = (loc[1] + 1) * (side_length / 2),
				sy = side_length - ((loc[2] + 1) * (side_length / 2));
			
			var texel = Math.floor(sy * side_length + sx);
			
			face_tex[face][3][texel] = tex_px[tex_pt]; 
			
			//console.log(x, y, phi, theta, texel, face, sx, sy );
		}
		
		for (face = 0; face < 6; face++) {
			face_tex[face][1].putImageData(face_tex[face][2], 0, 0);
		}
						
		return [face_tex[0][0], face_tex[1][0], face_tex[2][0], face_tex[3][0], face_tex[4][0], face_tex[5][0]];
		
	};

		var transforms = (function(transforms) {
			
			transforms.forward = function(phi, theta) {
				var tgf = tangential.forward(phi, theta),
					face = tgf[0],
					chi = tgf[1],
					psi = tgf[2];
				
				return [face, distort.forward(chi, psi), distort.forward(psi, chi)];	
			};	
			transforms.inverse = function(face, x, y) {
				var chi = distort.inverse(x, y),
					psi = distort.inverse(y, x);
			
				return tangential.inverse(face, chi, psi);	
			};
			
			return transforms;
			
		})({});
		
		var distort = (function(distort) {
			
			distort.forward = function(chi, psi) {
				var chi2 = Math.pow(chi, 2),
					chi3 = Math.pow(chi, 3),
					psi2 = Math.pow(psi, 2),
					omchi2 = 1 - chi2;
					
				return chi*(1.37484847732 - 0.37484847732*chi2) +
        					chi*psi2*omchi2*(-0.13161671474 +
                         						0.136486206721*chi2 +
                         						(1.0 - psi2) *
                         						(0.141189631152 +
                         						 psi2*(-0.281528535557 + 0.106959469314*psi2) +
                         						 chi2*(0.0809701286525 +
                                						0.15384112876*psi2 -
                                						0.178251207466*chi2))) +
        				chi3*omchi2*(-0.159596235474 -
                     				(omchi2 * (0.0759196200467 - 0.0217762490699*chi2)));
			};
						
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
			
			var FORWARD_PARAMETERS = [	function (l, m, n) { return [  m, -l,  n ]; },
										function (l, m, n) { return [  m,  n,  l ]; },
										function (l, m, n) { return [ -l,  n,  m ]; },
										function (l, m, n) { return [ -m,  n, -l ]; },
										function (l, m, n) { return [  l,  n, -m ]; },
										function (l, m, n) { return [  m,  l, -n ]; } ];
										
			tangential.forward = function(phi, theta) {
				var l = Math.cos(theta) * Math.cos(phi),
					m = Math.cos(theta) * Math.sin(phi),
					n = Math.sin(theta);
				
				var max = null,
					face = -1;
					
				var arr = [ n, l, m, -l, -m, -n ];
				
				for (i = 0; i < 6; i++) {
					var v = arr[i];
					if (typeof max === "undefined" || v > max) {
						max = v;
						face = i;
					}
				}
				
				var xietazeta = FORWARD_PARAMETERS[face](l, m, n),
					xi = xietazeta[0],
					eta = xietazeta[1],
					zeta = xietazeta[2];
				
				var chi = xi / zeta,
					psi = eta / zeta;
					
				return [face, chi, psi];
				
			};
													
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