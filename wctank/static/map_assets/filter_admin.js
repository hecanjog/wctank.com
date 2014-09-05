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

		// ...the boundingbox units in the svg spec seems a bit buggy,
		// and it is not possible to change svg filter attributes in CSS.
		// So, if not involved in some sort of animation, attributes are exposed
		// here to make adjustments for the local device
		
		filter_admin.attrs = {};

		filter_admin.attrs.print_analog = {
    		denoise: document.getElementById("pa-denoise"),
   			bypass: document.getElementById("pa-bypass")
   		};
		
   		filter_admin.attrs.caustic_glow = {
   			glow_radius: document.getElementById("cg-glow-radius")
   		};

		//caustic with noise olay

   		filter_admin.attrs.cmgyk = (function(cmgyk) {
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
			vhs.offset = document.getElementById("vhs-offset");
			var jit;
			var os = 2;
			var frdiv = 5;
			var frct = 0;
			vhs.init = function() {
				vhs.webgl.init();
			}
			vhs.animate = function() {
				if ( jit && ( (frct % frdiv) === 0 ) ) {
					vhs.offset.setAttribute("dy", os);
					os = (os === 2) ? 0 : 2;
				}
				frct++;
				vhs.webgl.update();
			};
			vhs.jitter = function(idle) {
				jit = idle;
			};
			vhs.webgl = (function(webgl) {
				var glcan;
				var gl;
				var fragmentClock;
				var noise_prgm;
				var buffer;		
				(function() {
					//create canvas (w/id for css)
					glcan = document.createElement('canvas');
					glcan.width = window.innerWidth;
					glcan.height = window.innerHeight;
					glcan.setAttribute("id", "glcan");
					//document.body.appendChild(glcan); // for switch function
				
					gl = (function() {
						try {
							return glcan.getContext("webgl") || glcan.getContext("experimental-webgl");
						} catch (err) {
							throw "WebGL is good to have? I like to fart";
							return false;
						}
					}())

					if (gl) {
						gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
						gl.clearColor(0.0, 0.0, 0.0, 0.0);
						
						//draw two big triangles
						buffer = gl.createBuffer();
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
					
						var position = gl.getAttribLocation(noise_prgm, "position");
						gl.enableVertexAttribArray(position);
						gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
	
						// get shader src, do typical initialization
						$.get("/static/map_assets/white_noise.glsl", function(data) {
							var matches = data.match(/\n(\d|[a-zA-Z])(\s|.)*?(?=END|^@@.*?$)/gm);
							var vert_src = matches[0];
							var frag_src = matches[1];
							var vert_shader = gl.createShader(gl.VERTEX_SHADER);
							var frag_shader = gl.createShader(gl.FRAGMENT_SHADER);

							gl.shaderSource(vert_shader, vert_src);
							gl.shaderSource(frag_shader, frag_src); 
							gl.compileShader(vert_shader);
							gl.compileShader(frag_shader);

							noise_prgm = gl.createProgram();
							gl.attachShader(noise_prgm, vert_shader);
							gl.attachShader(noise_prgm, frag_shader);
							gl.linkProgram(noise_prgm);
							gl.useProgram(noise_prgm);
						});
					}
				}())

				webgl.init = function() {
					document.body.appendChild(glcan);
				}

				//called in every animation frame
				webgl.update = function() {
					window.requestAnimationFrame(filter_admin.attrs.vhs.webgl.update, glcan);
					
					gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
					
					//gl.enableVertexAttribArray(buffer);	
					//gl.vertexAttribPointer(buffer, 2, gl.FLOAT, false, 0, 0);

					fragmentClock = gl.getUniformLocation(noise_prgm, "clock");
					gl.uniform1f(fragmentClock, new Date().getMilliseconds());
					
					gl.drawArrays(gl.TRIANGLES, 0, 6);
				};	
				//webgl resize listener
				return webgl;
			}({}))
			return vhs;
	   	}({}))
	
		// coordinate switching between filters		
		var coord = (function(coord) {
			var general = ["print_analog", "caustic_glow", "vhs"];
			var close_up = general.concat(["fauvist"]); 
			var close_thresh = 17;
			var idle_interval = 120000;
			var was_in_close = false;
			var new_filter;
			var old_filter;
			coord.applyFilter = function(filter) {
				var fa = filter_admin;
				for (var i = 0; i < close_up.length; i++) {
					div.$map.removeClass(close_up[i]);
					if ( fa.attrs[ close_up[i] ].hasOwnProperty('animate') ) 
						fa.render.rm(fa.attrs[ close_up[i] ].animate);
					if ( !fa.render.has() ) fa.render.stop();
				}
				div.$map.addClass(filter);
				if ( typeof fa.attrs[filter] !== 'undefined') {
					if ( fa.attrs[filter].hasOwnProperty('init') ) 
						fa.attrs[filter].init();
					if ( fa.attrs[filter].hasOwnProperty('animate') ) 
						fa.render.push(fa.attrs[filter].animate);
						fa.render.doIt();
				}
				new_filter = filter;	
			};
			coord.zoomListener = function(map_obj) {
				if ( was_in_close && (map_obj.zoom < close_thresh) ) {
					coord.applyFilter(old_filter);
					old_filter = false;
					was_in_close = false;
				} else if ( !was_in_close && (map_obj.zoom > close_thresh) ) {
					coord.applyFilter(close_up[(Math.random() * 4) | 0]);
					was_in_close = true;
					old_filter = new_filter;	
				}		
			};
			//start with random filter
			//coord.applyFilter(general[(Math.random() * 5) | 0]);
			coord.applyFilter('vhs');
			//just switch every so often 
			window.setInterval(function() { 
				coord.applyFilter(general[(Math.random() * 4) | 0]); 
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

