/**
 * @module featureDetection
 * detect status of webgl, webaudio, and webworkers
 * on the client, hard fail in certain circumstances
 */ 

import {$} from "jquery";
import {Modernizr} from "modernizer";


export let audioext = Modernizr.audio.ogg ? '.ogg' :
                      Modernizr.audio.mp3 ? '.mp3' : false;


export let webaudio = !!(Modernizr.webaudio && featureDetection.audioext); 


export let redirect_fatal = (mess) => {
    window.location.replace(`feature-fail/${mess}`);
}; 


if (!Modernizr.webgl) redirect_fatal('webgl');
if (!Modernizr.webworkers) redirect_fatal('webworkers');
