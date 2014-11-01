define(
    [
        'mapFilter',
        'mapFilterDefs',
        'core',
        'text!filterXML.xml',
        'require'
    ],

function(mapFilter, mapFilterDefs, core, XML, require) { var instances = {};
    /*
     *  Here, we get the XML component of the visual filters and instantiate
     */
    console.log(core);
    var cont = document.createElement("svg_filters");
    cont.style.position = "fixed";
    cont.style.bottom = 0;
    cont.style.zIndex = -99999999;
    document.body.appendChild(cont);
    cont.innerHTML = XML;   
    
    for (var f in mapFilterDefs) {
        if ( mapFilterDefs.hasOwnProperty(f) )
            instances[ f.toLowerCase() ] = new mapFilterDefs[f]();
    }
    require(['core'], function(core) {
        core.filters.parse();
        document.dispatchEvent(mapFilter._mapFiltersReady);
    });

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
return instances; });
