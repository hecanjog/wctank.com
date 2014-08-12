/*
 * utils utils contains actual utility functions
 * TODO: implement setTimeout concurrency primitive?
 */
var Ü = Ü || {}; /*_utils_*/ Ü._ = Ü._ || {};

Ü._.utils = (function(utils) {
	
	/*
	 * Make one big object from any number of objects
	 */
	utils.catObj = function(objects) {
		var robj = {};
		for (var obj = 0; obj < arguments.length; obj++) {
			for (prop in arguments[obj]) {
				if (arguments[obj].hasOwnProperty(prop)) {
					robj[prop] = arguments[obj][prop];
				}
			}
		}
		return robj;
	};

	/*
	 * For generating unique enough IDs, e.g., for property or variable names
	 * NOT A UUID/GUID!! NOT FOR CRITICAL USE!!
	 * 
	 * N.B. in V8, at the time of writing, working with strings is faster than working 
	 * on arrays in THIS case. In every other enviornment, the arrays are much faster. 
	 * However, I doubt we're going to be calling this enough for it to matter, and, 
	 * whatever lilliputian amount of time we manage to save with this optimization 
	 * will probably come out to a wash considering the extra work we need to do to 
	 * sniff the browser. So, I guess what I'm trying to say is that this is sort of 
	 * a defensive micro-optimization against potential future use cases that would 
	 * involve calling this hundreds of thousands of times. In other words, it's
	 * unnecessary most of the time, but *could* be helpful in the mystik zone.
	 */
	var chars = "abcefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_"; 
	var charr = chars.split("");
	var ID_length = 10;
	if(Ü._.agent === "Chrome") {
		utils.UEID = function() {
			var ID = "";
			for (var i = 0; i < ID_length; i++) {
				var idx = (Math.random() * chars.length + .5) | 0;
				ID = ID.concat(chars.charAt(idx));
			}
			return ID;
		};
	} else {
		utils.UEID = function() {
			var ID = [];
			for (var i = 0; i < ID_length; i++) {
				var idx = (Math.random() * chars.length + .5) | 0;
				ID.push(charr[idx]);
			}
			return ID.join("");
		};
	}
	
	utils.appendUEID = function(obj) {
		Object.defineProperty(obj, "_UEID", {
			writable: true
		});
		Object.defineProperty(obj, "UEID", {
			get: function() {
				if (!this._UEID) {
					this._UEID = Ü._.utils.UEID();
				}
				return this._UEID;
			}	
		});	
	};
	
	/*
	 * Compare arrays to see if they are identical; order dependent
	 */
	utils.arraysIdentical = function(arr1, arr2) {
		var length = arr1.length;
		if (length !== arr2.length) return false; 
		for (var i = 0; i < length; i++) {
			if (arr1[i] !== arr2[i]) return false; 
		}
		return true;
	};
	
	/*
	 * find the mean, min and max of a bunch of numbers
	 */
	utils.MMM = (function(MMM) {
		
		var heap = [];
		
		MMM.add = function(number) {
			heap.push(number);
		};
		MMM.clear = function() {
			heap = [];
		};
		MMM.getInfo = function() {
			
			var mean = (heap.reduce(function(previous, current) {
				return previous + current;
			}));
			var min = Math.min.apply(null, heap);
			var max = Math.max.apply(null, heap);

			return [mean, min, max];
			
		};
		
		return MMM;
		
	})({});
	
	//BAD! baaaad :-(
	utils.cloneObjSlowDeep = function(obj) {
		return JSON.parse(JSON.stringify(obj));
	};
	
	utils.cloneArray = function(arr) {
		var rarr = [];
		for (var i = 0; i < arr.length; i++) {
			rarr[i] = arr[i];
		}
		return rarr;
	};
	
	/*
	 * don't know if this actually works
	 */
	utils.cloneImgData = function(imgdata) {
		var rdata = {};
		rdata.width = new Number(imgdata.width);
		rdata.height = new Number(imgdata.height);
		rdata.data = new Uint8ClampedArray(imgdata.data);
		return rdata;				
	};
	
	return utils;
	
}({}));
