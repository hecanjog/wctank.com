var div = {
	$overlay: $('#overlay'),
	$map: $('#map-canvas')
};

var filter_admin = {}; 
// unfortunately, changing svg filter props is not possible in css 
// for some reason, firefox is not playing nice with svg filters in external
// files, so I guess I'm just going to dynamically inline it then
$.get("static/map_assets/map_filters.xml", function(data) {
	var cont = document.createElement("svg_filters");
	cont.style.position = "fixed";
    cont.style.bottom = 0;
    cont.style.zIndex = -99999999;
   	document.body.appendChild(cont);
   	cont.innerHTML = new XMLSerializer().serializeToString(data);
         	
	filter_admin = {
        		
		webgl: (function(webgl) {
			var gl;
			webgl.success = false;
			webgl.init = function() {
				var glcan = document.createElement('canvas');
				glcan.width = window.innerWidth;
				glcan.height = window.innerHeight;
				glcan.setAttribute("id", "glcan");
				//document.body.appendChild(glcan);
				gl = (function() {
					try {
						return glcan.getContext("webgl") || glcan.getContext("experimental-webgl");
					} catch (err) {
						throw "WebGL is good to have? I like to fart";
						return false;
					}
				}())
				if (gl) {
					webgl.success = true;
					gl.clearColor(0.0, 0.0, 0.0, 0.0);
					gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
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
						var noise_prgm = gl.createProgram();
						gl.attachShader(noise_prgm, vert_shader);
						gl.attachShader(noise_prgm, frag_shader);
						gl.linkProgram(noise_prgm);
						gl.useProgram(noise_prgm);
					});
				}
			}
			//webgl resize listener
			return webgl;
		}({})),

		print_analog: {
    		denoise: document.getElementById("pa-denoise"),
   			bypass: document.getElementById("pa-bypass")
   		},

   		caustic_glow: {
   			glow_radius: document.getElementById("cg-glow-radius")
   		},

   		cmgyk: (function(cmgyk) {
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
		}({})),
				
		//perhaps only allow at certain locations and at low-mid & max zoom lvls
		fauvist: (function(fauvist) {
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
		}({})),
			
		vhs: (function(vhs) {
	   		vhs.noise = document.getElementById("vhs-noise");
			vhs.offset = document.getElementById("vhs-offset");
			var jit;
			var os = 2;
			var frdiv = 5;
			var frct = 0;
			vhs.fuzz = function() {
				run();
				function run() {
					vhs.noise.setAttribute( "seed", Math.random() * 100 );
					if ( jit && ( (frct % frdiv) === 0 ) ) {
						vhs.offset.setAttribute("dy", os);
						os = (os === 2) ? 0 : 2;
					}
					frct++;
					requestAnimationFrame(run);
				}
			};
			vhs.jitter = function(idle) {
				jit = idle;
			};
			return vhs;
	   	}({})),
				
		automateFilters: (function(automateFilters) {
			var general = ["print-analog", "caustic-glow", "vhs"];
			var close_up = general.concat(["fauvist"]); 
			var close_thresh = 17;
			var idle_interval = 120000;
			var was_in_close = false;
			var new_filter;
			var old_filter;
			automateFilters.applyFilter = function(filter) {
				for (prop in filter_admin) {
					if ( filter_admin.hasOwnProperty(prop) ) {
						div.$map.removeClass(prop);	
					}
				}
				div.$map.addClass(filter);
				new_filter = filter;	
			};
			automateFilters.zoomListener = function(map_obj) {
				if ( was_in_close && (map_obj.zoom < close_thresh) ) {
					automateFilters.applyFilter(old_filter);
					old_filter = false;
					was_in_close = false;
				} else if ( !was_in_close && (map_obj.zoom > close_thresh) ) {
					automateFilters.applyFilter(close_up[(Math.random() * 4) | 0]);
					was_in_close = true;
					old_filter = new_filter;	
				}		
			};
			//start with random filter
			automateFilters.applyFilter(general[(Math.random() * 5) | 0]);
			//just switch every so often 
			window.setInterval(function() { 
					automateFilters.applyFilter(general[(Math.random() * 4) | 0]); 
			}, idle_interval);
			return automateFilters;
		}({})),

		eventHandler: function(map_obj) {
			google.maps.event.addListener(map_obj, 'zoom_changed', function() { 
				filter_admin.cmgyk.sequence(map_obj); 
				filter_admin.fauvist.sequence(map_obj);
				filter_admin.vhs.jitter(false);
				filter_admin.automateFilters.zoomListener(map_obj);
			});
			google.maps.event.addListener(map_obj, 'drag', function() { 
				filter_admin.vhs.jitter(false);		
			});
			google.maps.event.addListener(map_obj, 'idle', function() {
				filter_admin.vhs.jitter(true);
				filter_admin.vhs.fuzz();
			});
		}

	};
		
	// media queries for filters
	var dppx1dot2 =  window.matchMedia("only screen and (min-resolution: 1.0dppx),"+
					   "only screen and (-webkit-min-device-pixel-ratio: 1.0)");
	if (dppx1dot2.matches) {
		filter_admin.print_analog.denoise.setAttribute("stdDeviation", "1.16");
   		filter_admin.print_analog.bypass.setAttribute("in2", "flip");
   		filter_admin.caustic_glow.glow_radius.setAttribute("stdDeviation", "10.6");
		filter_admin.cmgyk.denoise.setAttribute("stdDeviation", "0.5");
	}
			
	filter_admin.webgl.init();

});

