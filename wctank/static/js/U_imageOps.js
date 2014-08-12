/*
 * imageOps contains handy image transforms and utilities
 * load this second
 * 
 * TODO: Single Thread reduce functionality --- perhaps in another keyword... then or something
 */
var Ü = Ü || {}; /*_utils_*/ Ü._ = Ü._ || {};

Ü._.imageOps = (function(imageOps) {

	/* 
	 * Whether or not to do image processing in the GPU. This app requires WebGl, and it 
	 * is better to use WebGL image processing in almost every circumstance. However, it 
	 * may be useful for future use of this code to detect if WebGL is available.
	 * 
	 * This should be set depending on the result of a feature detection test.
	 */
	imageOps.useWebGlTransforms = true;
	
	/*
	 * Data set override flags - Interpreted in "...Transform" modules
	 */
	var overrideFlags = {
		SOURCE_FLAG: "sdat",
		CURRENT_FLAG: "cdat",
		isFlag: function(chkstr) {
			var isof = ( (chkstr === this.SOURCE_FLAG) || (chkstr === this.CURRENT_FLAG) ) ? true : false;
			return isof;
		}
	};
	
	/*
	 * TODO: update docs!, incorporate promises, map across arrays of canvases
	 */
	var Canvas2dTransform = function(canvas, preprocess, process, addl_args_obj, callback, requires, proc_chain, reassign_flags) {

		var parent = this;
		
		var little_endian = Ü._.littleEndian;
		var orient_GL = false;
		
		var w = canvas.width;
		var h = canvas.height;
		var sctx = canvas.getContext('2d');
		
		// if getContext returns null, then we are operating 
		// on a canvas with a preexisting webgl context
		if (sctx === null) { 
			var sdat = new Uint8Array(w * h * 4);
			var wgl = canvas.getContext('webgl', {preserveDrawingBuffer: true});	
			wgl.readPixels(0, 0, w, h, wgl.RGBA, wgl.UNSIGNED_BYTE, sdat); //reads 0, 0 as bottom-left!
			orient_GL = true; // hide this by performing reversal w/o prompting
		} else {
			var sdat = sctx.getImageData(0, 0, w, h);
		}
		
		this.img = document.createElement('canvas');
		this.img.width = w;
		this.img.height = h;
		
		var rctx = this.img.getContext('2d');
		var rdat = rctx.createImageData(w, h);
		
		var addl_args = addl_args_obj || {};
		var proc_chain = proc_chain || [];
		var req_chain = requires; //must be array

		var data = 
			{	w: w, 
				h: h, 
				sdat: sdat,
				rdat: rdat,
				little_endian: little_endian, 
				orient_GL: orient_GL,
				addl_args: addl_args,	
				proc_chain: proc_chain,	
				reassign_flags: reassign_flags	};
				
		var drawSetup = function(scope, data) {
			
			scope.W = data.w;
			scope.H = data.h;
			scope.SDAT = data.sdat; //keep a copy of the orig data around
			scope.CDAT = data.sdat; 
			scope.RDAT = data.rdat;
			scope.LITTLE_ENDIAN = data.little_endian;
			scope.ORIENT_GL = data.orient_GL;
		
			var teardown = [];
			for (var prop in data.addl_args) {
				if ( data.addl_args.hasOwnProperty(prop) ) {
					var pnm = prop.toUpperCase(); //assign ref here. find "sdat"
					scope[pnm] = data.addl_args[prop];
					teardown.push(pnm);
				}
			}
			
			if(scope.ORIENT_GL) {
				scope.SPX = new Int32Array(SDAT.buffer);
				scope.CPX = new Int32Array(CDAT.buffer);
				} else {
					scope.SPX = new Int32Array(SDAT.data.buffer);
					scope.CPX = new Int32Array(CDAT.data.buffer);
			}
			scope.RPX = new Int32Array(RDAT.data.buffer);
			
			/*
			 * Utility functions available within ImgOp transform function scope;
			 * N.B. within critical loops, calling one of the MAKE_{COLOR CHANNEL} functions
			 * will save a bit of time, but, if more than 1 color is required, MAKE_RGBA is recommended
			 * as the overhead of multiple function calls makes processing a bit slower.
			 */	
			if(scope.LITTLE_ENDIAN) {
				scope.MAKE_RGBA = function(int32) {
					scope.CR = int32 & 0x000000ff;
					scope.CG = (int32 & 0x0000ff00) >>> 8;
					scope.CB = (int32 & 0x00ff0000) >>> 16;
					scope.CA = (int32 & 0xff000000) >>> 24;
				};
				scope.PACK_PXL = function(r, g, b, a) {
					return (a << 24) | (b << 16) | (g << 8) | r;
				};
				scope.MAKE_RED = function(int32) {
					scope.CR = int32 & 0x000000ff;
				};
				scope.MAKE_GREEN = function(int32) {
					scope.CG = (int32 & 0x0000ff00) >>> 8;
				};
				scope.MAKE_BLUE = function(int32) {
					scope.CB = (int32 & 0x00ff0000) >>> 16;
				};
				scope.MAKE_ALPHA = function(int32) {
					scope.CA = (int32 & 0xff000000) >>> 24;
				};
			} else {
				scope.MAKE_RGBA = function(int32) {
					scope.CR = (int32 & 0xff000000) >>> 24;
					scope.CG = (int32 & 0x00ff0000) >>> 16;
					scope.CB = (int32 & 0x0000ff00) >>> 8;
					scope.CA = int32 & 0x000000ff;
				};
				scope.PACK_PXL = function(r, g, b, a) {
					return (r << 24) | (g << 16) | (b << 8) | a;
				};
				scope.MAKE_RED = function(int32) {
					scope.CR = (int32 & 0xff000000) >>> 24;
				};
				scope.MAKE_GREEN = function(int32) {
					scope.CG = (int32 & 0x00ff0000) >>> 16;
				};
				scope.MAKE_BLUE = function(int32) {
					scope.CB = (int32 & 0x0000ff00) >>> 8;
				};
				scope.MAKE_ALPHA = function(int32) {
					scope.CA = int32 & 0x000000ff;
				};
			}
			
			scope.CHAN_VAL_BOUND = function(channel_value) {
				return (channel_value < 0x00) ? 0x00 : ( (0xff < channel_value) ? 0xff : channel_value );
			};
				
			teardown = teardown.concat([
				"W", "H", "SDAT", "RDAT", "CDAT", "LITTLE_ENDIAN", "ORIENT_GL", "SPX", "RPX", "CPX", 
				"MAKE_RGBA", "PACK_PXL", "CA", "CG", "CB", "CR", "CHAN_VAL_BOUND", "MAKE_GREEN", 
				"MAKE_RED", "MAKE_BLUE", "MAKE_ALPHA"]);
			return teardown;
			
		};
								
		this.execute = function() { 

			if ( typeof callback === 'function' ) {
				
				var worker = new Parallel(data, Ü._.workerPaths.eval)
					.require({fn: process, name: 'process'}, {fn: drawSetup, name: 'drawSetup'}, 
					{fn: Ü._.utils.cloneArray, name: 'cloneArray'});
				for (var req = 0; req < req_chain.length; req++) {
					worker.require(req_chain[req]);
				}
				
				// call preprocess, which as of now, has access to this.img and its dimensions
				if (typeof preprocess === 'function') {
					preprocess();
				}
				
				//what about non webgl video processing? cant spawn thread for each frame
				worker.spawn(function(data) {

					var scope = self;
					var proc_chain = data.proc_chain;
					var reassign_flags = data.reassign_flags;
					drawSetup(scope, data);
					
					process.call(scope);
					
					ORIENT_GL = false; // TODO: figure out a better way to handle this
					
					for (var i = 0; i < proc_chain.length; i++) { 

						var cid = proc_chain[i];
						
						// Look for flags, make reassignments as necessary
						var cflags = reassign_flags[cid];
						if (cflags.canvas === "sdat") {
							CPX = cloneArray(SPX);
						} else {
							CPX = cloneArray(RPX); // advance
						}
						for (var prop in cflags) {
							if ( cflags.hasOwnProperty(prop) && (prop !== "canvas") ) {
								if (cflags[prop] === "sdat") { 
									scope[prop.toUpperCase()] = SDAT; 
								} else if (cflags[prop] === "cdat") {
									scope[prop.toUpperCase()] = RDAT;
								}
							}
						} 
								
						var mystik_zone = eval([
							"function mystik_zone() { ",
								cid+"();",
							"}; mystik_zone"
						].join("\n"));
						mystik_zone();
						
					}
					
					return scope.RDAT;

				}).then(function(rdat) {	
					rctx.putImageData(rdat, 0, 0);
					callback(parent.img, canvas);
				});
		
			} else {
				
				/*
				 * No one is going to like this, and rightly so - this is DANGEROUS.
				 * However, since we are not operating concurrently here (as far as JS is concerned),
				 * as long as we cleanup behind us, we *should* be OK, and, this way makes a lot of 
				 * potentially elegant things in the ImgOp constructor possible.
				 * 
				 * TODO: Write test cases to verify this!
				 */
				var scope = window;
				var teardown = drawSetup(scope, data);
				
				process.call(parent);
				rctx.putImageData(RDAT, 0, 0);
				
				for (var i = 0; i < teardown.length; i++) {
					delete scope[ teardown[i] ];
				}
								
				return this.img;
				
			}	
		};
		
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

	var Torso = function(canvas, callback, preprocess, transform, additional, required, try_funct) {
		
		// execution state
		var addl_args = additional || {};
		var requires = required || [];
		var proc_chain = [];
		var reassign_flags = {};

		var catapult = canvas.catapult;

		// lets do some reflection to see if we are chaining on construction!
		var chaining = (function() {
			var name = arguments.callee.caller.caller.name;	
			var err = new Error();
			var stack = err.stack;
			stack = stack.replace(/((\n|\r).*?){4}(\n|\r)\s*?/, ""); // remove first 4 lines of stack trace
			var location = stack.match(/(\d*?:\d*?[)]*?\s*?\n)/)[0]; // grab first ##:##)\n
			var loc = location.match(/\d+/g); // [line, column] 
			if (!catapult.UEID) { // ref to context with ImgOp instance in it
				Ü._.utils.appendUEID(catapult);
			}
			var UEID = catapult.UEID;
			var src = catapult.toString();
			return imgOpHeap.lookUp(UEID, name, loc, src);
		}());

		// public props, methods
		
		this.ret_img = null; // if returning immediately, this will be filled with a ref to a canvas element
		
		this.getExecutionState = function() {
			return	{ 	addl_args: addl_args,
						requires: requires,
						proc_chain: proc_chain,
						reassign_flags: reassign_flags	};	
						//preprocess: preprocess	};
		};
				
		this.also = function(funct_obj) {
			var substate = funct_obj.getExecutionState();
			addl_args = Ü._.utils.catObj(addl_args, substate.addl_args);
			requires = requires.concat(substate.requires);
			proc_chain = proc_chain.concat(substate.proc_chain);
			reassign_flags = Ü._.utils.catObj(reassign_flags, substate.reassign_flags);
			//preprocess = substate.preprocess; //need to create another process chain that will do this
			return this;
		};
		
		this.then = function(ultimate) {
			var p = new Canvas2dTransform( canvas, preprocess, transform, addl_args, ultimate, requires, proc_chain, reassign_flags )
				.execute();
			return this;
		};

		if (!chaining.is_chained) { //also check if WebGL transforms
			
			if(typeof callback === 'function') {
				var q = new Canvas2dTransform( canvas, preprocess, transform, addl_args, callback, requires )
					.execute();
							
			} else {
			
				try {
					
					if (typeof try_funct === 'function') {
						this.ret_img = try_funct(canvas); //expanded argumaaants?
					} else {
						throw "nothing";
					}
					
				} catch(err) {
					this.ret_img = new Canvas2dTransform( canvas, preprocess, transform, addl_args, null, requires )
						.execute();
				}
			}
			
		} else {
			
			if(!chaining.is_top) {
				
				var fnid = Ü._.utils.UEID();  
				
				proc_chain.push(fnid);
				requires.push( {fn: transform, name: fnid} );
				
				reassign_flags[fnid] = {};
				reassign_flags[fnid].canvas = canvas.flag || false;
				for (var prop in addl_args) {
					if ( addl_args.hasOwnProperty(prop) ) {
						if ( overrideFlags.isFlag(addl_args[prop]) ) 
							reassign_flags[fnid][prop] = addl_args[prop];
					}
				}
				
			}
			
		}
			
	};

	imageOps.ImgOp = function ImgOp(name, args, preprocess, transform, additional, required, try_funct) {
		// careful with the whitespace at the ends of strings here! 
				
		var expression = "function " + name + "(";
		var argument_list = "";
		for (var i = 0; i < args.length; i++) {
			argument_list += args[i]+","; 
		}
		argument_list = argument_list.slice(0, -1);

		expression += [argument_list+") {",
			"if (typeof canvas !== 'object') {",
				"if ( overrideFlags.isFlag(canvas) ) {",
					"var flag = canvas;",
					"var canvas = {};",
					"canvas.flag = flag;",
				"} else {",
					"var canvas = {};",
					"canvas.flag = false;",
				"}",
			"} else if ( !( canvas.width || canvas.catapult ) ) {",
					"var canvas = {};",
					"canvas.flag = false;",
			"}",	
			"if ( !(this instanceof "+name+") ) {", 
				// append a reference of the calling context to the canvas object 
				// and pass it in before we seal ourselves inside this ImgOp with the constructor
				"canvas.catapult = arguments.callee.caller;",	
				"return new "+name+"("+argument_list+");",
			"} else {",
				"if (!canvas.catapult) {",
					"canvas.catapult = arguments.callee.caller;",
				"}",
			"}",
		].join("\n");
		
		/*
		 * Here, we are regexing the source of addl_args functions so we can resolve them
		 * in context with the appropriate parameters passed from the function call
		 */
		if (additional && typeof additional === 'object') {
			expression += "var resolved = Object.create(additional);";
			var funct_args = {};
			var props = Object.getOwnPropertyNames(additional);
			for (var i = 0; i < props.length; i++) {
				if (typeof additional[props[i]] === 'function') {
					var src = additional[props[i]].toString(); 
					var farg = [];
					for (var j = 0; j < args.length; j++) {
						var found = src.search("function.*?[(].*?"+args[j]+".*?[)]");
						if (found > -1) {
							farg.push(args[j]);
						}
					}
//result is an object where each item is property: ["arguments", "that", "property', "function", "takes"];
					funct_args[props[i]] = farg;
				}
			}
			
			/*
			 * If the value of any function parameters is an override flag, then any 
			 * addl_arg functions dependent on that parameter are overriden with that flag,
			 * and references to the addl_arg in the main transform will point to the 
			 * override flag's corresponding data set. 
			 * 
			 * TODO: Is this a really bad idea?
			 */
			for (var addl in funct_args) {
				if ( funct_args.hasOwnProperty(addl) ) {
					for (var i = 0; i < funct_args[addl].length; i++) {
						var cur_prop = funct_args[addl][i];
						expression += ["if ( overrideFlags.isFlag("+cur_prop+") ) {",
								"resolved."+addl+" = "+cur_prop+";",
							"}"
						].join("\n");
					}
				}
			}
			
			/*
			 * Resolve addl_args within function scope if the addl_arg is a function
			 * dependent on the parent function parameters
			 */
			for (var prp in additional) {
				if ( (typeof additional[prp] === 'function') && (additional.hasOwnProperty(prp)) ) {
					expression += ["if (typeof resolved."+prp+" === 'function') {",
						"resolved."+prp+" = resolved."+prp+"("
					].join("\n"); 
					for (var i = 0; i < funct_args[prp].length; i++) {
						expression += funct_args[prp][i]+",";
					}
					expression = expression.slice(0, -1).concat([");",
					"}"
					].join("\n"));
				}
			}	
		
		} else {
			expression += "var resolved = null;";
		}
		
		expression += [
			"Torso.call(this, canvas, callback, preprocess, transform, resolved, required, try_funct);", 
			"if (this.ret_img) {",
				"return this.ret_img;",
			"}",
		"}"
		].join("\n");
		
		return eval(expression+name);
		
	};
	imageOps.ImgOp.prototype = Object.create(Torso.prototype); 
	
	/*
	 * For ImgOp reflection; heap of objects in the form:
	 * 
	 * UEID: { // unique ID for context containing ImgOp functions (c.f. Ü._.utils.UEID)
	 * 		src: source code of context,
	 * 		mod_src: copy of src to destructively modify
	 * 		ctr: number for labeling successive instances of ImgOps member functions in context
	 * 		complete: BOOL signaling if every ImgOp instance has been identified in this context
	 * 		inst##: { // contains info on a specifc invocation of an ImgOp function
	 * 			name: all ImgOps are named functions
	 * 			loc: array with instance location info in the form [line, column]
	 * 			chained: this is the information we are after - whether or not 
	 * 				this instance is part of an ImgOp chain, and whether it is at the top
	 * 		`		of this chain (not passed in an .also())
	 * 				{is_chained: BOOL,
	 * 				is_top: BOOL}
	 * 		}
	 * 		inst##: {...
	 * 		...
	 * }
	 * 
	 *  TODO: include subset search in findSrc for nested scopes, 
	 * 	shouldn't need to do any culling unless dynamically generating A LOT of code 
	 *  that invokes imgOps, but it's something to keep in mind
	 */
	var imgOpHeap = (function(heap) {
		
		var instances = {};
		
		var method_list = Object.getOwnPropertyNames(imageOps);
		heap.isImgOp = function(to_check) { //takes string
			if (method_list.indexOf(to_check) === -1) {
				return false;
			} else {
				return true;
			}
		};
		
		heap.lookUp = function(caller_UEID, fctn_name, fctn_loc, caller_src) {
			
			if(typeof instances[caller_UEID] === 'object') {
				for(var obj in instances[caller_UEID]) {
					var inst = instances[caller_UEID][obj];
					if( inst.hasOwnProperty('loc') ) {
						if( (inst.name === fctn_name) && Ü._.utils.arraysIdentical(inst.loc, fctn_loc) ) {
							return inst.chaining;
						}
					}
				}
				return put(caller_UEID, fctn_name, fctn_loc);
			} else {
				return findSrc(caller_UEID, fctn_name, fctn_loc, caller_src);
			}
			
		};
		
		var findSrc = function(cUEID, fname, floc, csrc) {
			var mUEID = false;
			for (var ID in instances) {
				if ( instances.hasOwnProperty(ID) ) {
					if ( (instances[ID].src === csrc) && (instances[ID].complete === true) ) {
						mUEID = ID;
						break;
					}	
				}
			}
			if (mUEID) {
				return heap.lookUp(mUEID, fname, floc);
			} else {
				return put(cUEID, fname, floc, csrc);
			}
		};
		
		heap.dbug = function() {
			return instances;
		};

		var put = function(cUEID, fname, floc, csrc) {
			
			if(typeof csrc === 'string') {
				instances[cUEID] = 
					{	src: csrc,
						mod_src: "", 
						ctr: 0,
						complete: false	};		
														
				var nix = /(\/\/(\S| |\t)*(\n|\r)?)|(\/\*(\S|\s)*?\*\/)/g; //strip comments
				instances[cUEID].mod_src = csrc.replace(nix, "");
			}
			
			instances[cUEID].ctr++;
			var ctr = instances[cUEID].ctr;
			
			instances[cUEID][ "inst"+ctr ] = 
				{	name: fname,
					loc: floc, 
					chaining: { is_chained: false, is_top: true }	};
			
			var not_chained = instances[cUEID].mod_src.search("(?!(\n|\r))"+fname+".*?(;|{)"); //this is fragile 
			var chained_l = instances[cUEID].mod_src.search("also(.|\n|\r)*?"+fname);
			var chained_r = instances[cUEID].mod_src.search(fname+"(.|\n|\r)*?(also|then)");
			instances[cUEID].mod_src = instances[cUEID].mod_src.replace(fname, ""); // !!
			
			if (not_chained === -1) {
				if ( (chained_l > -1) || (chained_r > -1) ) {
					instances[cUEID][ "inst"+ctr ].chaining.is_chained = true;
				} 
				if ( (chained_l > -1) && (chained_r > -1) ) {
					instances[cUEID][ "inst"+ctr ].chaining.is_top = false;
				}
			}
						
			var alive = -1;
			for (var i = 0; i < method_list.length; i++) { //this is a problem -- account for reassignment
				var alive = instances[cUEID].mod_src.search(method_list[i]);
				if (alive > -1) { 
					break; 
				}
			}
			if (alive === -1) { 
				instances[cUEID].complete = true; 
			}

			return instances[cUEID][ "inst"+ctr ].chaining;	 
	
		};
	
		return heap;
	
	}({}));

	return imageOps;
		
}({}));
