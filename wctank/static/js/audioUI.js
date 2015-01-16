define(
    [
        'audioCore',
        'jquery'
    ],

function(audioCore, $) {
    var $mute = $("#mute-button"),
        fade = 0.4;
    
    var vol_up = "icon-volume-up",
        vol_off = "icon-volume-off";

    var toOff = function() {
        $mute.removeClass(vol_up).addClass(vol_off);
    };
    var toUp = function() {
        $mute.removeClass(vol_off).addClass(vol_up);
    };

    $mute.click(function() {
        if (audioCore.out.gain.value) {
            toOff();
            audioCore.out.gain.linearRampToValueAtTime(0, audioCore.ctx.currentTime + fade);
        } else {
            toUp();
            audioCore.out.gain.linearRampToValueAtTime(1, audioCore.ctx.currentTime + fade);
        }
    });

    $mute.mouseenter(function() {
        var cl = $mute.attr('class');               
        if (audioCore.out.gain.value) {
            if (cl === vol_up) toOff();
        } else {
            if (cl === vol_off) toUp();
        }
        
    });
    
    $mute.mouseleave(function() {
        var cl = $mute.attr('class');
        if (audioCore.out.gain.value) {
            if (cl === vol_off) toUp();
        } else {
            if (cl === vol_up) toOff();
        }
    });
});

