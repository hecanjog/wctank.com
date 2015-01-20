define(
    [
        'audioCore',
        'jquery'
    ],

function(audioCore, $) {
    var $mute = $("#mute-button"),
        mute_clicked = false,
        button_fade = 0.4,
        overlay_fade = 1.1,
        overlay_mute = false;
    
    var vol_up = "icon-volume-up",
        vol_off = "icon-volume-off";

    var toOff = function() {
        $mute.removeClass(vol_up).addClass(vol_off);
    };
    var toUp = function() {
        $mute.removeClass(vol_off).addClass(vol_up);
    };

    var mainGainFade = function(val, time) {
        audioCore.out.gain.linearRampToValueAtTime(val, audioCore.ctx.currentTime + time);
    };

    $mute.click(function() {
        if (audioCore.out.gain.value) {
            toOff();
            mainGainFade(0, button_fade);
        } else {
            overlay_mute = false;
            toUp();
            mainGainFade(1, button_fade);
        }
        mute_clicked = true;
        window.setTimeout(function() {
            mute_clicked = false;
        }, button_fade * 1000);
    });

    $mute.mouseenter(function() {
        var cl = $mute.attr('class');               
        if (!mute_clicked) {
            if (audioCore.out.gain.value) {
                if (cl === vol_up) toOff();
            } else {
                if (cl === vol_off) toUp();
            }
        }
    });
    
    $mute.mouseleave(function() {
        var cl = $mute.attr('class');
        if (!mute_clicked) {
            if (audioCore.out.gain.value) {
                if (cl === vol_off) toUp();
            } else {
                if (cl === vol_up) toOff();
            }
        }
    });
    
    document.addEventListener('post_overlay', function(e) {
        if (audioCore.out.gain.value) {
            if (e.detail.postType === 'video' || e.detail.postType === 'audio' ||
                    e.detail.content.search("iframe")) {
                mainGainFade(0, overlay_fade);
                toOff(); 
                overlay_mute = true;
            }
        } else if (overlay_mute) {
            mainGainFade(1, overlay_fade);
            toUp();
            overlay_mute = false;
        }
    });
});

