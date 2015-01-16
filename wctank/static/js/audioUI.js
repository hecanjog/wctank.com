define(
    [
        'audioCore',
        'jquery'
    ],

function(audioCore, $) {
    var $mute = $("#mute-button"),
        fade = 0.4;
    
    var toOff = function() {
        $mute.removeClass("icon-volume-up").addClass("icon-volume-off");
    };
    var toOn = function() {
        $mute.removeClass("icon-volume-off").addClass("icon-volume-up");
    };

    $mute.click(function() {
        if (audioCore.out.gain.value) {
            toOff();
            audioCore.out.gain.linearRampToValueAtTime(0, audioCore.ctx.currentTime + fade);
        } else {
            toOn();
            audioCore.out.gain.linearRampToValueAtTime(1, audioCore.ctx.currentTime + fade);
        }
    });
    
    var vol_up = "icon-volume-up",
        vol_off = "icon-volume-off";

    $mute.mouseenter(function() {
        var cl = $mute.attr('class');               
        if (audioCore.out.gain.value) {
            if (cl === vol_up) toOff();
        } else {
            if (cl === vol_off) toOn();
        }
        
    });
    $mute.mouseleave(function() {
        var cl = $mute.attr('class');
        if (audioCore.out.gain.value) {
            if (cl === vol_off) toOn();
        } else {
            if (cl === vol_up) toOff();
        }
    });
});

