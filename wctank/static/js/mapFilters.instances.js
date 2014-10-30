wctank = wctank || {};
wctank.mapFilters = wctank.mapFilters || {};

/*
 *  Here, we get the XML component of the visual filters and instantiate
 */
wctank.mapFilters.instances = (function(instances) {
    var mapFilters = wctank.mapFilters;
    var defs = wctank.mapFilters.defs;
    var core = wctank.core;

    $.get("static/map_filters.xml", function(data) {
        var cont = document.createElement("svg_filters");
        cont.style.position = "fixed";
        cont.style.bottom = 0;
        cont.style.zIndex = -99999999;
        document.body.appendChild(cont);
        cont.innerHTML = new XMLSerializer().serializeToString(data);   
        
        for (var f in defs) {
            if ( defs.hasOwnProperty(f) )
                instances[ f.toLowerCase() ] = new defs[f]();
        }
        core.filters.parse();
        document.dispatchEvent(mapFilters._mapFiltersReady);

        (function() {
            var dppx1dot2 = window.matchMedia("only screen and (min-resolution: 1.0dppx),"+
                                "only screen and (-webkit-min-device-pixel-ratio: 1.0)");
            if (dppx1dot2.matches) {
                instances.print_analog.denoise.setAttribute("stdDeviation", "1.16");
                instances.print_analog.bypass.setAttribute("in2", "flip");
                instances.caustic_glow.glow_radius.setAttribute("stdDeviation", "10.6");
                instances.cmgyk.denoise.setAttribute("stdDeviation", "1");
            }
        }())
    });
    return instances;
}({}))
