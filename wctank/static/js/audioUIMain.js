define(
    [
        'audioCore',
        'featureDetection',
        'jquery'
    ],

function(audioCore, featureDetection, $) { var audioUIMain = {};
    var $mute = $("#mute-button"),
        mute_clicked = false,
        button_fade = 0.4,
        overlay_fade = 1.1,
        overlay_mute = false,
        manual_mute = false;
   
    var vol_up = "icon-volume-up",
        vol_off = "icon-volume-off";

    var toOff = function() {
        $mute.removeClass(vol_up).addClass(vol_off);
    };
    var toUp = function() {
        $mute.removeClass(vol_off).addClass(vol_up);
    };
    var toError = function() {
        $mute.removeClass(vol_off).removeClass(vol_up).addClass('icon-cancel-circled');
    };

    var muteHookCallbacks = [],
        last_gain = 1;
    var mainGainFade = function(val, time) {
        last_gain = val;
        if (!disableMuteButton) {
            if (featureDetection.webaudio) {
                audioCore.out.gain.linearRampToValueAtTime(val, audioCore.ctx.currentTime + time);
            }
            muteHookCallbacks.forEach(function(cb) {
                cb(val, time);
            });
        }
    };

    /*
     * Mostly for if web audio fails; provides a mechanism by which
     * fallback audio can still be muted. 
     */
    audioUIMain.muteHook = function(callback) {
        muteHookCallbacks.push(callback);
    };

    // disable mute button functionality if something goes terribly wrong
    var disableMuteButton = false;
    audioUIMain.disableMuteButton = function() {
        disableMuteButton = true;
        if ('out' in audioCore) audioCore.out.gain.value = 0;
        toError();
    };

    // if audio fails, reflect error in UI
    if (!featureDetection.audioext && !featureDetection.webaudio) {
        audioUIMain.disableMuteButton(); 
    }

    $mute.click(function() {
        if (!disableMuteButton) {
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
    //$mute.click(); // fake click

    $mute.mouseenter(function() {
        var cl = $mute.attr('class');               
        if (!mute_clicked && !disableMuteButton) {
            if (last_gain) {
                if (cl === vol_up) toOff();
            } else {
                if (cl === vol_off) toUp();
            }
        }
    });
    
    $mute.mouseleave(function() {
        var cl = $mute.attr('class');
        if (!mute_clicked && !disableMuteButton) {
            if (last_gain) {
                if (cl === vol_off) toUp();
            } else {
                if (cl === vol_up) toOff();
            }
        }
    });
    
    document.addEventListener('post_overlay', function(e) {
        if (!disableMuteButton) {
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
return audioUIMain; });

