define( 

{
   /*
    * .call on obj to define a static read-only length prop
    */
    objectLength: function() {
       this.length = 0;
       for (var p in this) {
           if ( this.hasOwnProperty(p) ) this.length++;
       }
       this.length--;
       Object.defineProperty(this, "length", {
           writable: false
       });
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
        if (Math.random() < 0.5) s*=-1;
        return Math.random() * s + n;  
    },

    getRndItem: function(set) {
        if ( Array.isArray(set) ) { 
            var idx = (Math.random() * set.length) | 0;
            return set[idx];
        } else {
            var keys = Object.keys(set);
            return set[ util.getRndItem(keys) ];
        }
    },
    
    // a nice implementation of java's hashCode I ripped from
    // stack overflow: 
    // http://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript-jquery
    hashCode: function(s){
        return s.split("").reduce(function(a,b){a=((a<<5)-a)+b.charCodeAt(0);return a&a},0);         
    },

    log: function(n, base) {
        return Math,log(n) / Math.log(base);
    }

});
