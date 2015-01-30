define( 

{
   /*
    * .call on obj to define a static read-only length prop
    * TODO: make dynamic
    */
    objectLength: function() {
       var len = 0;
       for (var p in this) {
           if ( this.hasOwnProperty(p) ) len++;
       }
       Object.defineProperty(this, "length", {
           value: len,
           writable: false,
           enumerable: false
       });
    },

    /*
     * A small Object.watch that works on configurable
     * properties with defined accessors
     * TODO: expand to include properties w/o accessors
     * TODO: !!!!! if used to modify a property in the prototype,
     *             the change will be mirrored in any object inheriting
     *             the same prototype.
     *             This behavior is NOT GOOD.
     */
    watchProperty: function(obj, props, callback) {
        var p = [];
        if (Array.isArray(props)) {
            p = props;
        } else {
            p.push(props);
        }

        p.forEach(function wrap(v, i, a, overr) { //ignore index and array
            var targ = overr ? overr : obj,
                desc = Object.getOwnPropertyDescriptor(targ, v);

            if (desc) {
                Object.defineProperty(obj, v, {
                    configurable: true,
                    get: desc.get,
                    set: function(val) {
                        desc.set(val);
                        callback(val);
                    }
                });
            } else if (typeof Object.getPrototypeOf(targ) === 'object') {
                wrap(v, null, null, Object.getPrototypeOf(targ)); 
            } else {
                //failed!
                throw new Error("util.watchProperty error! Property name "+v+
                                " not found in prototype chain!");
            }         
        });
    },
    
    // destructively enumerate obj 
    enumerate: function(obj) {
        var i = 0,
            r = {};
        for (var prop in obj) {
            if (obj.hasOwnProperty(prop)) {
                r[i++] = obj[prop];
            }
        }
        return r;
    },

    hasBit: function(x, y) {
        return ( (x & y) === y ) ? true : false;
    },

    /*
     * given a number n, return a new random number 
     * within a range n * +/-percentage f
     */
    smudgeNumber: function(n, f) {
        var s = n * f * 0.01;
        if (Math.random() < 0.5) s *= -1;
        return Math.random() * s + n;  
    },

    getRndItem: function rndItem(set) {
        if ( Array.isArray(set) ) { 
            var idx = (Math.random() * set.length) | 0;
            return set[idx];
        } else {
            var keys = Object.keys(set);
            return set[ rndItem(keys) ];
        }
    },

    shuffleArray: function(arr) {
         
    },

    // a nice implementation of java's hashCode I ripped from stack overflow: 
    // http://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript-jquery
    hashCode: function(s){
        return s.split("").reduce(function(a,b){a=((a<<5)-a)+b.charCodeAt(0);return a&a},0);
    },

    log: function(n, base) {
        return Math.log(n) / Math.log(base);
    },

    time: {
        msec2sec: function(msec) {
            return msec / 1000;
        }
    }

});
