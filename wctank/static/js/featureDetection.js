/**
 * @module featureDetection
 * detect status of webgl, webaudio, and webworkers
 * on the client, hard fail in certain circumstances
 */ 
import $ from "jquery";
import Modernizr from "lib/modernizer";


export const audioext = Modernizr.audio.ogg ? '.ogg' :
                        Modernizr.audio.mp3 ? '.mp3' : false;


export const webaudio = !!(Modernizr.webaudio && audioext); 


export function redirect_fatal(mess)
{
    window.location.replace(`feature-fail/${mess}`);
} 


if (!Modernizr.webgl) redirect_fatal('webgl');
if (!Modernizr.webworkers) redirect_fatal('webworkers');
