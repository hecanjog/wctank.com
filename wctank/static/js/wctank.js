var wctank = (function(wctank) {

    wctank.util = {
        /*
         * .call on module prototypes
         */
        aliasNamespace: function() {
            this.util = wctank.util;
            this.div = wctank.div;
            this.posts = wctank.posts;
            this.gMap = wctank.gMap;
            this.core = wctank.core;
            this.filterDefs = wctank.filterDefs;
            this.markers = wctank.markers;
            this.specialDefs = wctank.specialDefs;
            this.sequencer = wctank.sequencer;
            this.tableux = wctank.tableux;
        },
        
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
        
        appendNameProps: function(obj) {
            for (var p in obj) {
                if ( obj.hasOwnProperty(p) )
                    obj[p].name = p;
            }
        }
    };
     
    /*
     * just the jQuery objs we need a lot
     */
    wctank.div = {
        $overlay: $('#overlay'),
        $map: $("#map-canvas"),
        $map_U_markers: $("#map-canvas").add("#markers-a").add("#markers-b")
    };

    return wctank;
}({}))
