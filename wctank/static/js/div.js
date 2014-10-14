var wctank = (function(wctank) {
    
    wctank.aliasNamespace = function() {
        this.div = wctank.div;
        this.posts = wctank.posts;
        this.gMap = wctank.gMap;
        this.core = wctank.core;
        this.filterDefs = wctank.filterDefs;
        this.markers = wctank.markers;
        this.alpheStrut = wctank.alphaStrut;
        this.sequencer = wctank.sequencer;
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
}(wctank || {}))
