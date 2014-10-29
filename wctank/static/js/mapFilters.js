wctank = wctank || {};

/*
 *  Here, we get the XML component of the visual filters and instantiate
 */
wctank.mapFilters = (function(mapFilters) {
    var filterDefs = wctank.filterDefs;
    var core = wctank.core;

    $.get("static/map_filters.xml", function(data) {
        var cont = document.createElement("svg_filters");
        cont.style.position = "fixed";
        cont.style.bottom = 0;
        cont.style.zIndex = -99999999;
        document.body.appendChild(cont);
        cont.innerHTML = new XMLSerializer().serializeToString(data);   
        
        for (var f in filterDefs.filters) {
            if ( filterDefs.filters.hasOwnProperty(f) )
                mapFilters[ f.toLowerCase() ] = new filterDefs.filters[f]();
        }
        
        core.filters.parse();
        document.dispatchEvent(filterDefs._mapFiltersReady);

        (function() {
            var dppx1dot2 = window.matchMedia("only screen and (min-resolution: 1.0dppx),"+
                                "only screen and (-webkit-min-device-pixel-ratio: 1.0)");
            if (dppx1dot2.matches) {
                mapFilters.print_analog.denoise.setAttribute("stdDeviation", "1.16");
                mapFilters.print_analog.bypass.setAttribute("in2", "flip");
                mapFilters.caustic_glow.glow_radius.setAttribute("stdDeviation", "10.6");
                mapFilters.cmgyk.denoise.setAttribute("stdDeviation", "1");
            }
        }())
    });
    return mapFilters;
}({}))
