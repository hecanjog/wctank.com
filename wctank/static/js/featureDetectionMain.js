define(
    [
        'modernizr',
        'jquery'
    ],

function(Modernizr, $) { var featureDetectionMain = {};

    var failed = [];
    var fail = function() {
        if (failed.length === 1 && failed[0] === 'webgl') {
            window.location.replace("feature-fail/webgl");
        } else {
            window.location.replace("feature-fail/"+failed);
        }
    };

    featureDetectionMain.audioExt = Modernizr.audio.ogg ? '.ogg' :
                                Modernizr.audio.mp3 ? '.mp3' : failed.push('audiocodec');

    if (!Modernizr.webgl) failed.push('webgl');
    if (!Modernizr.webaudio) failed.push('webaudioapi');
    if (!Modernizr.webworkers) failed.push('webworkers');
    if (failed.length > 0) fail();

    featureDetectionMain.audioProblemFatal = function() {
        window.location.replace("feature-fail/audio-fatal");
    }; 

return featureDetectionMain; });
