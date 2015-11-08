/**
 * @module effects
 * contains subclasses of rudy.visualCore.Effect that implement
 * different visual effects.
 */
import "jquery"; 
import "froogaloop2";
import * as posts from "./posts";
import * as rudy from "lib/rudy/rudy";

import * as tableux from "./tableux";
import * as div from "./div";
import * as gMap from "./gMap";
import filterXML from "assets/map_filters.xml!systemjs/plugin-text";


// first, render the filter xml in the document so it is available via css selectors
var filters = document.createElement("svg_filters");  // will function basically like a div
filters.style.position = "fixed";
filters.style.bottom = 0;
filters.style.zIndex = -99999999;
document.body.appendChild(filters);
filters.innerHTML = filterXML; 


const __css_class__ = Symbol(),
      __name__ = Symbol();

      
class CssEffect extends rudy.visualCore.Effect
{
    constructor(name, css_class)
    {
        super();
        this[__css_class__] = css_class;
        this[__name__] = name;
        tableux.registerEffect(this[__name__]);
    }

    operate(stage)
    {
        let hook_op = stage ? "addClass" : "removeClass";
        super.operate(stage, 
            [
                {
                    address: 1, 
                    fn: () => div.$map[hook_op](this.css_class)
                }
            ]
        );
    }
    
    get name() { return this[__name__]; }  
    get css_class() { return this[__css_class__]; }  
}

export class PrintAnalog extends CssEffect
{
    constructor()
    {
        super("PrintAnalog", "print-analog");
    }
    init() {}
    teardown() {}
}
