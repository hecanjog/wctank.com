//TODO: refine map_canvas selector, handle non-webgl and non-svg (disable filters that use webgl, 
//svg and substitutions), create pop-up suprises, do something with wes's text
//animate caustic glow filter and add a bit of color maybe

// aliases for yt iframe API
var onYouTubeIframeAPIReady;
var onPlayerReady;

var filter_admin; 
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
		
		var div = {
			$overlay: $('#overlay'),
			$map: $("#map-canvas")
		};

		var cat = {
			GENERAL: 	0x0F000000,
			ZOOMED: 	0x00F00000,
			TAKEOVER: 	0x000F0000,
			START: 		0x0000F000,
			NONE:  		0x00000000
		};

		filter_admin.current = null;

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
				id = window.requestAnimationFrame(render.doIt);
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
			/*
			//handle context loss	
			canvas.addEventListener("webglcontextlost", function(e) {
				e.preventDefault();
			}, false);		
			canvas.addEventListener("webglcontextrestored", function() { 
				filter_admin.webglSetup(canvas, shader_path); 
			}, false);
			*/

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
    		categories: cat.GENERAL | cat.ZOOMED | cat.TAKEOVER | cat.START,
			denoise: document.getElementById("pa-denoise"),
   			bypass: document.getElementById("pa-bypass")
   		};
   		
		filter_admin.attrs.caustic_glow = (function(caustic_glow) {
			caustic_glow.categories = cat.GENERAL | cat.ZOOMED | cat.START;
   			caustic_glow.glow_radius = document.getElementById("cg-glow-radius");
			
			var caustic_glow_back = document.createElement("div");
			caustic_glow_back.setAttribute("id", "caustic_glow_back");	
			
			var yt_player = document.createElement("div");
			yt_player.setAttribute("id", "yt_player");
			caustic_glow_back.appendChild(yt_player);
			
			var yt_tag = document.createElement("script");
			yt_tag.src = "https://www.youtube.com/iframe_api";
			caustic_glow_back.appendChild(yt_tag);

			var player;
			onYouTubeIframeAPIReady = function() {
				player = new YT.Player('yt_player', {
					playerVars: {
						controls: 0,
						disablekb: 1,
						loop: 1,
						modestbranding: 0
					},
					events: {
						onReady: onPlayerReady
					}			
				});
			};
			
			var start_time = 0;	
			onPlayerReady = function(event) {
				player.mute();
				player.loadVideoById('X2QFL-PHb1A', start_time);
			};
			caustic_glow.init = function() {
				document.body.appendChild(caustic_glow_back);
			};
			caustic_glow.teardown = function() {
				start_time = ( start_time + player.getCurrentTime() ) % player.getDuration();
				document.body.removeChild(caustic_glow_back);

			};

			return caustic_glow;
		}({}));

   		filter_admin.attrs.cmgyk = (function(cmgyk) {
			cmgyk.categories = cat.GENERAL | cat.ZOOMED;
			cmgyk.denoise = document.getElementById("cmgyk-denoise");
			
			var cmgyk_back = document.createElement("div");
			cmgyk_back.setAttribute("id", "cmgyk_back");
			var cmgyk_grad = document.createElement("div");
			cmgyk_grad.setAttribute("id", "cmgyk_grad");
			cmgyk_back.appendChild(cmgyk_grad);	
			var cmgyk_steady_back = document.createElement("div");
			cmgyk_steady_back.setAttribute("id", "cmgyk_steady_back");
				
			var engaged = false;
			var times_engaged = 0;
			var should_ko = function() {
				if (times_engaged > 2) return true;
				return false;
			};
			var should_blink = function() {
				if (times_engaged > 5) {
					//coord.pushCategory(cat.TAKEOVER, "cmgyk");	
					return true;
				}
				return false;
			};

			cmgyk.init = function() {
				engaged = true;
				times_engaged++;
				document.body.appendChild(cmgyk_steady_back);
				document.body.appendChild(cmgyk_back);
			};
			cmgyk.teardown = function() {
				engaged = false;
				document.body.removeChild(cmgyk_steady_back);
				document.body.removeChild(cmgyk_back);
				$kos.css("display", "block");
			};
			
			var gaussDist = function() {
				// snippet from http://memory.psych.mun.ca/tech/snippets/random_normal/
				var x1, x2, rad;
	    		do {
           			x1 = 2 * Math.random() - 1;
        			x2 = 2 * Math.random() - 1;
        			rad = x1 * x1 + x2 * x2;
    			} while(rad >= 1 || rad == 0);
 
    			var c = Math.sqrt(-2 * Math.log(rad) / rad); 
    			return x1 * c;
			};
			var $kos = $();
			var blink$ = []; //array with items of form [$, blink_speed in ms]	
			
			cmgyk.onMovement = function() {
				if ( engaged && should_ko() ) {
					var $map_imgs = $("#map-canvas :nth-child(1) :nth-child(1) :nth-child(1) "+
								  ":nth-child(5) :nth-child(1)").children();
					$kos = $();		
					var s_idx, e_idx;
					//blink$ = [];
					(function() {
						var mdn = ($map_imgs.length * 0.5 + 0.5) | 0;
						var idxGen = function() {
							return (gaussDist() * 2 + mdn + 0.5) | 0;
						};
						var x = idxGen();
						var y = idxGen();
						if (x > y) {
							s_idx = x;
							e_idx = y;
						} else {
							s_idx = y;
							e_idx = x;
						}
						s_idx--;
						e_idx++;
					}())
					var b_mod = (function() {
						var range = [5, 6, 7, 8, 9, 10, 11];
						var rtn = [];
						var num = (Math.random() * 4 + 0.5) | 0
						for (var i = 0; i < num; i++) {
							rtn.push(range[ (Math.random() * range.length - 1 + 0.5) | 0 ]);
						}
						return rtn;
					}())
					for (var i = s_idx; i <= e_idx; i++) {
						var $img = $map_imgs.eq(i);
						$kos = $kos.add($img);
						if ( should_blink() ) {
							for (var j = 0; j < b_mod.length; j++) {
								if ( (i % b_mod[j]) === 0 ) blink$[j] = [$img, (Math.random() * 3000) | 0];
							}	
						}
					}
					$kos.css("display", "none");
				}
			};
			
			/*	
			cmgyk.webgl = (function(webgl) {
				var cmgyk_wgl_canv = document.createElement('canvas');
				cmgyk_wgl_canv.width = window.innerWidth * 0.75;
				cmgyk_wgl_canv.height = window.innerHeight * 0.75;
				cmgyk_wgl_canv.setAttribute("id", "cmgyk_wgl_canv");

				var js_clock;
				
				window.addEventListener('resize', function(e) {
					cmgyk_wgl_canv.width = window.innerWidth * 0.75;
					cmgyk_wgl_canv.height = window.innerHeight * 0.75;
				});
				
				var z = filter_admin.webglSetup(cmgyk_wgl_canv, "/static/map_assets/stars.glsl");			

			/////////////////HERE DUDE

			}({}))
			*/
		   
			cmgyk.animate = function() {
				if ( should_blink() ) {
					var time = new Date().getTime();
					for (var i = 0; i < blink$.length; i++) {
						if ( blink$[i] && ( ((time % blink$[i][1]) <= 16) || ((Math.random() * 10 ) < 0.5 )) )	{
							if (blink$[i][0].css("display") === "none") {
								blink$[i][0].css("display", "block");
							} else {
								blink$[i][0].css("display", "none");
							}
						}
					}
				}
			};
			
			var rot_interval = 22.5;
			var rot = 0;
			var lzoom = 0;
			cmgyk.onLoad = function(map_obj) {
				lzoom = map_obj.zoom;
			}
			cmgyk.onZoom = function(map_obj) {
				var zoom = map_obj.zoom;
				rot = rot + ( (zoom - lzoom) * rot_interval );
				var str = "rotate("+rot.toString()+"deg)";
				cmgyk_back.style.transform = "rotate("+rot.toString()+"deg)";
				cmgyk_back.style.webkitTransform = "rotate("+rot.toString()+"deg)";
				lzoom = zoom;			
			};

			return cmgyk;
		}({}))
				
		filter_admin.attrs.fauvist = {
			categories: cat.ZOOMED
		};
		
		filter_admin.attrs.vhs = (function(vhs) {
			vhs.categories = cat.GENERAL | cat.ZOOMED | cat.START;
			vhs.offset = document.getElementById("vhs-offset");
			
			var vhs_back = document.createElement('div');	
			vhs_back.setAttribute("id", "vhs_back");

			vhs.init = function() {
				document.body.appendChild(vhs_back);
				vhs.webgl.init();
			}
			vhs.teardown = function() {
				document.body.removeChild(vhs_back);
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
				if (!jit_tmp) vhs.offset.setAttribute("dy", 0);
				window.setTimeout(function() {
					jit = jit_tmp;
				}, jit_delay);
			};

			vhs.webgl = (function(webgl) {
				var vhs_canv = document.createElement('canvas');
				vhs_canv.width = window.innerWidth * 0.75;
				vhs_canv.height = window.innerHeight * 0.75;
				vhs_canv.setAttribute("id", "vhs_canv");
				
				var js_random;
				
				window.addEventListener('resize', function(e) {
					vhs_canv.width = window.innerWidth * 0.75;
					vhs_canv.height = window.innerHeight * 0.75;
				});
				
				var z = filter_admin.webglSetup(vhs_canv, "/static/map_assets/white_noise.glsl");
				
				webgl.update = function() {
					z.gl.clear(z.gl.COLOR_BUFFER_BIT | z.gl.DEPTH_BUFFER_BIT);
					js_random = z.gl.getUniformLocation(z.program, "js_random");
					z.gl.uniform1f(js_random, Math.random());
					z.gl.drawArrays(z.gl.TRIANGLES, 0, 6);
				};

				webgl.init = function() {
					document.body.appendChild(vhs_canv);
				}
				webgl.teardown = function() {
					document.body.removeChild(vhs_canv);
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
			var start = [];

			for (var filter in filter_admin.attrs) {
				if ( filter_admin.attrs.hasOwnProperty(filter) ) {
					var cats = filter_admin.attrs[filter].categories;
					if ( (cats & cat.GENERAL) === cat.GENERAL ) general.push(filter);
					if ( (cats & cat.ZOOMED) === cat.ZOOMED ) zoomed.push(filter);					
					if ( (cats & cat.TAKEOVER) === cat.TAKEOVER ) takeover.push(filter);
					if ( (cats & cat.START) === cat.START ) start.push(filter);
				}
			}
			coord.pushCategory = function(catObj, filter) {
				switch(catObj) {
					case cat.GENERAL:
						general.push(filter);
						break;
					case cat.ZOOMED:
						zoomed.push(filter);
						break;
					case cat.TAKEOVER:
						takeover.push(filter);
						break;
					case cat.START:
						start.push(filter);
						break;
				}
			}

			var close_thresh = 17;
			var idle_interval = 30000;
			var was_in_close = false;
			var new_filter;
			var old_filter;

			coord.applyFilter = function(filter) {
				filter_admin.current = filter;
				var render = filter_admin.render;
				if (new_filter) {
					div.$map.removeClass(new_filter);
					var this_filter = filter_admin.attrs[new_filter];
					if ( this_filter.hasOwnProperty('animate') ) filter_admin.render.rm(this_filter.animate);
					if ( this_filter.hasOwnProperty('teardown') ) this_filter.teardown();
					if ( !render.has() ) render.stop();
				}
				div.$map.addClass(filter);
				var this_filter = filter_admin.attrs[filter]; 
				if (typeof this_filter !== "undefined") {	
					if ( this_filter.hasOwnProperty('init') ) this_filter.init();
					if ( this_filter.hasOwnProperty('animate') ) render.push(this_filter.animate);
					if ( render.has() ) render.doIt();
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
			coord.onZoom = function(map_obj) {
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

					coord.applyFilter(zfil);
					was_in_close = true;
				}		
			};
			
			// start with start filter
			coord.applyFilter(start[ rndIdxInArr(start) ]);
			
			//just switch every so often 
			window.setInterval(function() { 
				coord.applyFilter(general[ rndIdxInArr(general) ]); 
			}, idle_interval);
		
			return coord;
		
		}({}))

		// provided a google.map object, adds listeners for whatever in filter_admin needs it
		filter_admin.eventHandler = function(map_obj) {
			google.maps.event.addListener(map_obj, 'zoom_changed', function() { 
				filter_admin.attrs.cmgyk.onZoom(map_obj); 
				filter_admin.attrs.vhs.jitter(false);
				coord.onZoom(map_obj);
			});
			google.maps.event.addListener(map_obj, 'drag', function() { 
				filter_admin.attrs.vhs.jitter(false);		
			});
			google.maps.event.addListener(map_obj, 'idle', function() {
				filter_admin.attrs.vhs.jitter(true);
			});
			google.maps.event.addListener(map_obj, 'bounds_changed', function() {
				filter_admin.attrs.cmgyk.onMovement();
			});
			google.maps.event.addListenerOnce(map_obj, 'tilesloaded', function() {
				filter_admin.attrs.cmgyk.onLoad(map_obj);		
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
		filter_admin.attrs.cmgyk.denoise.setAttribute("stdDeviation", "1");
	}
			
});

