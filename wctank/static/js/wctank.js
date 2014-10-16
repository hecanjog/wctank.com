var wctank = (function(wctank) {
    
    wctank.aliasNamespace = function() {
        this.div = wctank.div;
        this.posts = wctank.posts;
        this.gMap = wctank.gMap;
        this.core = wctank.core;
        this.filterDefs = wctank.filterDefs;
        this.markers = wctank.markers;
        this.specialDefs = wctank.specialDefs;
        this.sequencer = wctank.sequencer;
        this.tableux = wctank.tableux;
    };

    wctank.objectLength = function() {
        this.length = 0;
        for (var p in this) {
            if ( this.hasOwnProperty(p) ) this.length++;
        }
        this.length--;
        Object.defineProperty(this, "length", {
            writable: false
        });
    };
   
    wctank.hasBit = function(x, y) {
        return ( (x & y) === y ) ? true : false;
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
