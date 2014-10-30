var wctank = (function(wctank) {

    wctank.util = {
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
        }
       /* 
        arg2Array: function(argObj) {
            return Array.slice(argObj);   
        }*/

    };
     
    /*
     * just the jQuery objs we need a lot
     */
    wctank.div = {
        $overlay: $('#overlay'),
        $map: $("#map-canvas"),
        $map_U_markers: $("#map-canvas").add("#markers-a").add("#markers-b"),
        
        // useful css selectors
        selectors: {
            $_map_imgs: "#map-canvas :nth-child(1) :nth-child(1)" + 
                ":nth-child(1) :nth-child(5) :nth-child(1) > div" 
        }
    };

    return wctank;
}({}))
