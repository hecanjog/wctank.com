/**
 * @module div
 */
import "jquery";

export let $overlay = $('#overlay');
export let $map = $("#map-canvas");

// useful css selectors
export const selectors = {
    $_map_imgs: "#map-canvas :nth-child(1) :nth-child(1)" + 
        ":nth-child(1) :nth-child(5) :nth-child(1) > div"
};
