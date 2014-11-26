define( 
    [
        'audio',
        'audioElements'
    ],

function(audio, audioElements) { var actors = {};

    actors.SubtractiveResynthesis = function() {
        // in -> analysis -> 
        //     noise -> bp bank
        var nop = audio.ctx.createGain(),
            analyser = audioElements.Analysis(),
            noise = audioElements.Noise(),
            outGain = audio.ctx.createGain();

        audio.AudioModule.call(nop);
        audio.AudioModule.call(outGain);

        nop.link(analyser);
        nop.link(outGain);

        var bp_bank = [];

        this.update = function() {
            // grab frequencies, spawn bandpasses at frequency
        };
        this.setQ = function(q) {
            // set all bandpass q values 
        };
               
    };
    actors.SubtractiveResynthesis.prototype = new audio.AudioModule();

return actors; });

