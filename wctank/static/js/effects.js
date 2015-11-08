/**
 * @module effects
 * contains subclasses of rudy.visualCore.Effect that implement
 * different visual effects.
 */
import $ from "jquery";
import $f from "froogaloop2";
import "lib/rudy/rudy";

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


const __gauss_std_deviation__ = Symbol(),
      __gauss_blur_element__ = Symbol(),
      __blur_radius_value__ = Symbol(),
      __blur_animation_duration__ = Symbol(),
      __blur_animation_element__ = Symbol(),
      __luma_exponent_value__ = Symbol(),
      __luma_element__ = Symbol(),
      __vimeo_player__ = Symbol(),
      __vimeo_player_ready__ = Symbol(),
      __mouse_interval_id__ = Symbol(),
      __caustic_bg_elem__ = Symbol();


export class CausticGlow extends CssEffect
{
    constructor()
    {
        super("CausticGlow", "caustic-glow");
        
        // prepare background video
        this[__caustic_bg_elem__] = document.createElement("div");
        this[__caustic_bg_elem__].setAttribute("id", "caustic-glow-back");  
    
        let vid_id = "107871876",
            player_elem = document.createElement("iframe");
        player_elem.setAttribute("id", "vimeo-background-player");
        player_elem.src = 
            `//player.vimeo.com/video/${vid_id}?api=1&player_id=vimeo-background-player&autopause=0&loop=1`;
        this[__caustic_bg_elem__].appendChild(player_elem);
         
        document.body.appendChild(this[__caustic_bg_elem__]);

        this[__vimeo_player__] = $f($('#vimeo-background-player')[0]);
        this[__vimeo_player_ready__] = false;
        this[__mouse_interval_id__] = null;
        
        player.addEvent('ready', () => {
            this[__vimeo_player_ready__] = true;
            this[__vimeo_player__].api("setVolume", 0);
            this[__vimeo_player__].api('pause');

            // the second part of the nasty hack from posts.js
            // this is, I think, the worst bit of code I've ever written.
            // ... it only completely works about 50 - 60% of the time
            // .. although, it's kinda neat in a deconstructive sort of way...
            window.addEventListener('overlay_iframe_mouse', e => {
                if (e.detail.status === 'mouseover') {
                    this[__mouse_interval_id__] = window.setInterval(() => {
                        this[__vimeo_player__].api('setVolume', 0);
                    }, 1); // floors at ca. 8 - 14
                } else if (e.detail.status === 'mouseout') {
                    window.clearInterval(this[__mouse_interval_id__]);
                }
            });
        });

        this[__gauss_std_deviation__] = 10.6;
        this[__gauss_blur_element__] = document.getElementById("cg-glow-radius");

        this[__blur_radius_value__] = 0;
        this[__blur_animation_duration__] = 1000;
        this[__blur_animation_element__] = document.getElementById('caustic-glow-post-blur-animate');

        this[__luma_exponent_value__] = 3.1;
        this[__luma_element__] = document.getElementById('caustic-glow-green-exponent');
    }
    
    init() 
    {
        if (this[__vimeo_player_ready__]) {
            this[__vimeo_player__].api("play");
        } else {
            window.setTimeout(() => {
                init();
            }, 250);
            this[__caustic_bg_elem__].style.visibility = "visible";
        }
    }
   
    teardown()
    {
        this[__vimeo_player__].api("pause");
        this[__caustic_bg_elem__].style.visibility = "hidden";
    }    

    get alpha_blur_radius() { return this[__gauss_std_deviation__]; }
    set alpha_blur_radius(v) {
        this[__gauss_std_deviation__] = v;
        this[__gauss_blur_element__].setAttribute('stdDeviation', this[__gauss_std_deviation__].toString());
    }

    get animated_post_blur_radius() { return this[__blur_radius_value__]; }
    set animated_post_blur_radius(v) {
        this[__blur_radius_value__] = v;
        this[__blur_animation_element__].setAttribute("values", `0 0;${v} 0;0 0`);
    }

    get animated_post_blur_duration() { return this[__blur_animation_duration__]; }
    set animated_post_blur_duration(v) {
        this[__blur_animation_duration__] = v;
        this[__blur_animation_element__].setAttribute('dur', `${v.toString()}ms`);
    }

    get luma_exponent() { return this[__luma_exponent_value__]; }
    set luma_exponent(v) {
        this[__luma_exponent_value__] = v;
        this[__luma_element__].setAttribute('exponent', v.toString());
    }
}
