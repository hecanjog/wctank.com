/**
 * @module audioUI
 * basically the mute button
 */


import {$} from "jquery";
import * as featureDetection from "featureDetection";
import * as audioCore from "rudy/audio/core";


///////// module private stuff
let $mute = $("#mute-button"),
    mute_clicked = false,
    button_fade = 0.4,
    overlay_fade = 1.1,
    overlay_mute = false,
    manual_mute = false,
    disable_mute_button = false;


let vol_up = "icon-volume-up",
    vol_off = "icon-volume-off";

let toOff = function() {
    $mute.removeClass(vol_up).addClass(vol_off);
};
let toUp = function() {
    $mute.removeClass(vol_off).addClass(vol_up);
};
let toError = function() {
    $mute.removeClass(vol_off).removeClass(vol_up).addClass('icon-cancel-circled');
};

let mute_callbacks = [],
    last_gain = 1;

let mainGainFade = (val, time) => {
    last_gain = val;
    if (!disable_mute_button) {
        if (featureDetection.webaudio) {
            audioCore.out.gain.linearRampToValueAtTime(val, audioCore.ctx.currentTime + time);
        }
        mute_callbacks.forEach(x => { x(val, time); });
    }
};
//////////////////////////////


export function muteHook(callback) 
{
    mute_callbacks.push(callback);
}


export function disableMuteButton()
{
    disable_mute_button = true;
    if ("out" in audioCore) audioCore.out.gain.value = 0;
    toError();
}


////////////// init button behavior

// if audio fails, reflect error in UI
if (!featureDetection.audioext && !featureDetection.webaudio) {
    disableMuteButton(); 
}

$mute.click(() => {
    if (!disable_mute_button) {
        if (last_gain === 1) {
            toOff();
            mainGainFade(0, button_fade);
            manual_mute = true;
        } else {
            overlay_mute = false;
            toUp();
            mainGainFade(1, button_fade);
            manual_mute = false;
        }
        mute_clicked = true;
        window.setTimeout(function() {
            mute_clicked = false;
        }, button_fade * 1000);
    }
});

$mute.mouseenter(() => {
    let cl = $mute.attr('class');               
    if (!mute_clicked && !disable_mute_button) {
        if (last_gain) {
            if (cl === vol_up) toOff();
        } else {
            if (cl === vol_off) toUp();
        }
    }
});

$mute.mouseleave(() => {
    let cl = $mute.attr('class');
    if (!mute_clicked && !disable_mute_button) {
        if (last_gain) {
            if (cl === vol_off) toUp();
        } else {
            if (cl === vol_up) toOff();
        }
    }
});

document.addEventListener('post_overlay', e => {
    if (!disable_mute_button) {
        if (!overlay_mute) {
            if (e.detail.postType === 'video' || e.detail.postType === 'audio' ||
                    e.detail.content.search("iframe") >= 0) {
                mainGainFade(0, overlay_fade);
                toOff(); 
                overlay_mute = true;
            }
        } else if (overlay_mute && !manual_mute) {
            mainGainFade(1, overlay_fade);
            toUp();
            overlay_mute = false;
        }
    }
});
