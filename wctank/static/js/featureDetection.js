define(
    [
        'modernizr',
        'jquery'
    ],

function(Modernizr, $) { var featureDetection = {};

    var fatal = [];

    var fail = function() {
        if (failed.fatal === 1 && fatal[0] === 'webgl') {
            window.location.replace("feature-fail/webgl");
        } else {
            window.location.replace("feature-fail/"+failed);
        }
    };

    featureDetection.audioExt = Modernizr.audio.ogg ? '.ogg' :
                                Modernizr.audio.mp3 ? '.mp3' : failed.push('audiocodec');

    if (!Modernizr.webgl) fatal.push('webgl');
    if (!Modernizr.webworkers) fatal.push('webworkers');
    if (fatal.length > 0) fail();

    // mostly here to aid debugging.
    featureDetection.webaudio = Modernizr.webaudio;    

    /*
     * TODO: Instead of just hard failing if there is a driver or other 
     * enviornment problem, try to be a bit more graceful. 
     */
    featureDetection.fatal = function(mess) {
        window.location.replace("feature-fail/"+mess);
    }; 

return featureDetection; });
