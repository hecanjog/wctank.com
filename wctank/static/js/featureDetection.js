define(
    [
        'modernizr',
        'jquery'
    ],

function(Modernizr, $) { var featureDetection = {};

    var failed = [];
    var fail = function() {
        if (failed.length === 1 && failed[0] === 'webgl') {
            window.location.replace("feature-fail/webgl");
        } else {
            window.location.replace("feature-fail/"+failed);
        }
    };

    featureDetection.audioExt;

    if (!Modernizr.webgl) failed.push('webgl');
    if (!Modernizr.webaudio) failed.push('webaudioapi');
    if (!Modernizr.webworkers) failed.push('webworkers');

    if (Modernizr.audio.ogg) {
        featureDetection.audioExt = '.ogg';
    } else if (Modernizr.audio.mp3) {
        featureDetection.audioExt = '.mp3';
    } else {
        failed.push('audiocodec');
    }
    if (failed.length > 0) fail();

    featureDetection.audioProblemFatal = function() {
        window.location.replace("feature-fail/audio-fatal");
    }; 

return featureDetection; });
