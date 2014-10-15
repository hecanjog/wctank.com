var wctank = (function(wctank) {
    
    wctank.aliasNamespace = function() {
        this.div = wctank.div;
        this.posts = wctank.posts;
        this.gMap = wctank.gMap;
        this.core = wctank.core;
        this.filterDefs = wctank.filterDefs;
        this.markers = wctank.markers;
        this.alphaStrut = wctank.alphaStrut;
        this.sequencer = wctank.sequencer;
        this.tableux = wctank.tableux;
    };

    wctank.objectLength = function() {
        var l = 0;
        for (var p in this) {
            if ( this.hasOwnProperty(p) ) l++;
        }
        this.length = l;
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
