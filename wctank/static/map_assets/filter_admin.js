var div = {
	$overlay: $('#overlay'),
	$map: $('#map-canvas')
};

var filter_admin = {}; 
// for some reason, firefox is not playing nice with svg filters in external
// files, so I guess I'm just going to dynamically inline it then
$.get("static/map_assets/map_filters.xml", function(data) {
	var cont = document.createElement("svg_filters");
	cont.style.position = "fixed";
	cont.style.bottom = 0;
	cont.style.zIndex = -99999999;
   	document.body.appendChild(cont);
   	cont.innerHTML = new XMLSerializer().serializeToString(data);
    
	//container for all filters and related functionality 	
	filter_admin = (function(filter_admin) {
		
		var cat = {
			GENERAL: 	0x0F000000,
			ZOOMED: 	0x00F00000,
			TAKEOVER: 	0x000F0000
		};

		//stack + render loop	
		filter_admin.render = (function(render) {
			var doees = [];
			var id;
			render.push = function(funct) {
				doees.push(funct);
			};
			render.rm = function(funct) {
				var idx = doees.indexOf(funct);
				if (idx !== -1) doees.splice(idx, 1);
			};
			render.doIt = function() {
				requestAnimationFrame(render.doIt);
				for (var i = 0; i < doees.length; i++) {
					doees[i]();
				}
			};
			render.has = function() {
				return (doees.length > 0) ? true : false;
			}
			render.stop = function() {
				cancelAnimationFrame(id);
			}
			return render;
		}({}))

		filter_admin.webglSetup = function(canvas, shader_path) {
			//handle context loss	
			canvas.addEventListener("webglcontextlost", function(e) {
				e.preventDefault();
			}, false);		
			canvas.addEventListener("webglcontextrestored", function() { 
				filter_admin.webglSetup(canvas, shader_path); 
			}, false);
			
			var r = {};
			
			gl = (function() {
				try {
					return canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
				} catch (err) {
					throw "WebGL is good to have? I like to fart";
					return false;
				}
			}())

			if (gl) {
				gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
				gl.clearColor(0.0, 0.0, 0.0, 0.0);
				
				//draw two big triangles
				var buffer = gl.createBuffer();
				gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
				gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
					-1.0, -1.0,
					 1.0, -1.0,
					-1.0,  1.0,
					-1.0,  1.0,
					 1.0, -1.0,
					 1.0,  1.0]), gl.STATIC_DRAW);
				gl.enableVertexAttribArray(buffer);	
				gl.vertexAttribPointer(buffer, 2, gl.FLOAT, false, 0, 0);
				gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
				
				// get shader src, do typical initialization
				$.get(shader_path, function(data) {
					var matches = data.match(/\n(\d|[a-zA-Z])(\s|.)*?(?=END|^@@.*?$)/gm);
					var vert_src = matches[0];
					var frag_src = matches[1];
					var vert_shader = gl.createShader(gl.VERTEX_SHADER);
					var frag_shader = gl.createShader(gl.FRAGMENT_SHADER);
					gl.shaderSource(vert_shader, vert_src);
					gl.shaderSource(frag_shader, frag_src); 
					gl.compileShader(vert_shader);
					gl.compileShader(frag_shader);
					var prgm = gl.createProgram();
					gl.attachShader(prgm, vert_shader);
					gl.attachShader(prgm, frag_shader);
					gl.linkProgram(prgm);
					gl.useProgram(prgm);
					r.program = prgm;
				});
				r.gl = gl;
				return r;
			}
		};

		// ...the boundingbox units in the svg spec seems a bit buggy,
		// and it is not possible to change svg filter attributes in CSS.
		// So, if not involved in some sort of animation, attributes are exposed
		// here to make adjustments for the local device
		
		filter_admin.attrs = {};
		
		filter_admin.attrs.none = {
			categories: cat.GENERAL | cat.ZOOMED
		};

		filter_admin.attrs.print_analog = {
    		categories: cat.GENERAL | cat.ZOOMED | cat.TAKEOVER,
			denoise: document.getElementById("pa-denoise"),
   			bypass: document.getElementById("pa-bypass")
   		};
		
   		filter_admin.attrs.caustic_glow = {
			categories: cat.GENERAL | cat.ZOOMED,
   			glow_radius: document.getElementById("cg-glow-radius")
   		};

		//caustic with noise olay

   		filter_admin.attrs.cmgyk = (function(cmgyk) {
			cmgyk.categories = cat.GENERAL | cat.ZOOMED;
			cmgyk.denoise = document.getElementById("cmgyk-denoise");
			cmgyk.hueRotate = document.getElementById("cmgyk-hueRotate");
			cmgyk.rainbow = document.getElementById("cmgyk-rainbow");
			var cmgyk_canv = document.createElement('canvas');
			var idx = 0;
			var rot;
			var rainbow_rot = ["rotate(45)", "rotate(90)", "rotate(135)", "rotate(0)"];
			cmgyk.sequence = function() {
				rot = Number(cmgyk.hueRotate.getAttribute("values"));
				cmgyk.hueRotate.setAttribute("values", rot+(10 * Math.PI / 11));
				cmgyk.rainbow.setAttribute("gradientTransform", rainbow_rot[idx]);
				idx = (idx + 1) % rainbow_rot.length;
			};
			return cmgyk;
		}({}))
				
		//perhaps only allow at certain locations and at low-mid & max zoom lvls
		filter_admin.attrs.fauvist = (function(fauvist) {
			fauvist.categories = cat.ZOOMED;
			fauvist.saturate = document.getElementById("fauvist-saturate");
			var defv = fauvist.saturate.getAttribute("values");
			fauvist.sequence = function(map) {
				var zoom = map.zoom;
				if( (zoom >= 11) && (zoom <= 18) ) {
					switch(zoom) {
						case 11:
							fauvist.saturate.setAttribute("values", "18.5");
							break;
						case 12:
							fauvist.saturate.setAttribute("values", "17.2");
							break;
						case 13:
							fauvist.saturate.setAttribute("values", "16.3");
							break;
						case 14:
							fauvist.saturate.setAttribute("values", "12.5");
							break;
						case 15:
							fauvist.saturate.setAttribute("values", "11.7");
							break;
						case 16:
							fauvist.saturate.setAttribute("values", "10");
							break;
						case 17:
							fauvist.saturate.setAttribute("values", "9");
							break;
						case 18:
							fauvist.saturate.setAttribute("values", "14");
							break;
					} 
				} else {
					fauvist.saturate.setAttribute("values", defv);
				}
			};	
			return fauvist;
		}({}))
		
		// this one is sorta convoluted - the white noise is realized within a separate
		// WebGl layer
		filter_admin.attrs.vhs = (function(vhs) {
			vhs.categories = cat.GENERAL | cat.ZOOMED;
			vhs.offset = document.getElementById("vhs-offset");
			
			vhs.init = function() {
				vhs.webgl.init();
			}
			vhs.teardown = function() {
				vhs.webgl.teardown();
			}
			
			var jit;
			var jit_offset = 3;
			var jit_delay = 150;
			var jit_frame_div = 2;

			var frct = 0;
			var os = 0;	
			vhs.animate = function() {
				if ( jit && ( (frct % jit_frame_div) === 0 ) ) {
					vhs.offset.setAttribute("dy", os);
					os = (os === jit_offset) ? 0 : jit_offset;
				}
				frct++;
				vhs.webgl.update();
			};
			var jit_tmp;
			vhs.jitter = function(idle) {
				jit_tmp = idle;
				window.setTimeout(function() {
					jit = jit_tmp;
				}, jit_delay);
			};

			vhs.webgl = (function(webgl) {
				var js_random;
				var glcan = document.createElement('canvas');
				glcan.width = window.innerWidth;
				glcan.height = window.innerHeight;
				glcan.setAttribute("id", "glcan");
				
				var z = new filter_admin.webglSetup(glcan, "/static/map_assets/white_noise.glsl");
				webgl.update = function() {
					z.gl.clear(z.gl.COLOR_BUFFER_BIT | z.gl.DEPTH_BUFFER_BIT);
					js_random = z.gl.getUniformLocation(z.program, "js_random");
					z.gl.uniform1f(js_random, Math.random());
					z.gl.drawArrays(z.gl.TRIANGLES, 0, 6);
				};

				webgl.init = function() {
					document.body.appendChild(glcan);
				}
				webgl.teardown = function() {
					document.body.removeChild(glcan);
				}
				return webgl;
			}({}))
			return vhs;
	   	}({}))
	
		// coordinate switching between filters		
		var coord = (function(coord) {
			var general = [];
			var zoomed = [];
			var takeover = [];

			for (filter in filter_admin.attrs) {
				if ( filter_admin.attrs.hasOwnProperty(filter) ) {
					var cats = filter_admin.attrs[filter].categories;
					if ( (cats & cat.GENERAL) === cat.GENERAL ) general.push(filter);
					if ( (cats & cat.ZOOMED) === cat.ZOOMED ) zoomed.push(filter);
					if ( (cats & cat.TAKEOVER) === cat.TAKEOVER ) takeover.push(filter);
				}
			}

			var close_thresh = 17;
			var idle_interval = 30000;
			var was_in_close = false;
			var new_filter;
			var old_filter;

			coord.applyFilter = function(filter) {
				var render = filter_admin.render;
				if (new_filter) {
					div.$map.removeClass(new_filter);
					var this_filter = filter_admin.attrs[new_filter];
					if ( this_filter.hasOwnProperty('animate') ) 
						filter_admin.render.rm(this_filter.animate);
					if ( this_filter.hasOwnProperty('teardown') )
						this_filter.teardown();
					if ( !render.has() ) render.stop();
				}
				div.$map.addClass(filter);
				var this_filter = filter_admin.attrs[filter]; 
				if ( typeof this_filter !== 'undefined') {
					if ( this_filter.hasOwnProperty('init') ) 
						this_filter.init();
					if ( this_filter.hasOwnProperty('animate') ) 
						render.push(this_filter.animate);
						render.doIt();
				}
				old_filter = new_filter;
				new_filter = filter;
				if ( takeover.indexOf(filter) !== -1 ) old_filter = filter;	
			};
			
			var rndIdxInArr = function(arr) {
				return (Math.random() * arr.length + 0.5) | 0;
			}

			// If we are at zoom level 17 (where the view in some places changes to 45deg),
			// then switch to a filter different from the one currently being used
			coord.zoomListener = function(map_obj) {
				if ( was_in_close && (map_obj.zoom <= close_thresh) ) {
					coord.applyFilter(old_filter);
					was_in_close = false;
				} else if ( !was_in_close && (map_obj.zoom > close_thresh) ) {
					var zfil = zoomed[ rndIdxInArr(zoomed) ];
					
					(function check_dup() {
						if (zfil === new_filter) {
							zfil = zoomed[ rndIdxInArr(zoomed) ];
							check_dup();
						}
					}())

					coord.applyFilter(zoomed[ rndIdxInArr(zoomed) ]);
					was_in_close = true;
				}		
			};

			//start with random filter
			coord.applyFilter(general[ rndIdxInArr(general) ]);
			
			//just switch every so often 
			window.setInterval(function() { 
				coord.applyFilter(general[ rndIdxInArr(general) ]); 
			}, idle_interval);
		
			return coord;
		
		}({}))

		// provided a google.map object, adds listeners for whatever in filter_admin needs it
		filter_admin.eventHandler = function(map_obj) {
			google.maps.event.addListener(map_obj, 'zoom_changed', function() { 
				filter_admin.attrs.cmgyk.sequence(map_obj); 
				filter_admin.attrs.fauvist.sequence(map_obj);
				filter_admin.attrs.vhs.jitter(false);
				coord.zoomListener(map_obj);
			});
			google.maps.event.addListener(map_obj, 'drag', function() { 
				filter_admin.attrs.vhs.jitter(false);		
			});
			google.maps.event.addListener(map_obj, 'idle', function() {
				filter_admin.attrs.vhs.jitter(true);
			});
		};
		
		return filter_admin;
	
	}({}))	
		
	// media queries for filters
	var dppx1dot2 =  window.matchMedia("only screen and (min-resolution: 1.0dppx),"+
					   "only screen and (-webkit-min-device-pixel-ratio: 1.0)");
	if (dppx1dot2.matches) {
		filter_admin.attrs.print_analog.denoise.setAttribute("stdDeviation", "1.16");
   		filter_admin.attrs.print_analog.bypass.setAttribute("in2", "flip");
   		filter_admin.attrs.caustic_glow.glow_radius.setAttribute("stdDeviation", "10.6");
		filter_admin.attrs.cmgyk.denoise.setAttribute("stdDeviation", "0.5");
	}
			
});

