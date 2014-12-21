define( 
    [
        'audio',
        'audioNodes',
        'audioElements'
    ],

function(audio, audioNodes, audioElements) { var actors = {};

    actors.SubtractiveSynthesis = function(withNoise) {
        // in -> analysis -> 
        //     noise -> bp bank
        var dryIn = audioNodes.Gain(),
            anaIn = audioNodes.Gain(),
            analyser = audioElements.Analysis(),
            noise = audioElements.Noise(),
            dryGain = audioNodes.Gain(),
            wetGain = audioNodes.Gain(),
            outGain = audioNodes.Gain();

        anaIn.link(analyser);
        dryIn.link(dryGain).link(outGain);
        wetGain.link(outGain);

        var driver = withNoise ? noise : dryIn;

        this._link_alias_in = [dryIn, anaIn];
        this._link_alias_out = outGain;    

        audio.moduleExtensions.startStopThese(this, noise); 
        audio.moduleExtensions.wetDry(this, dryGain, wetGain);

        var bp_bank = [];
        this.updateFromSound = function() {
            var dat = analyser.getData();
            bp_bank.forEach(function(bp) {
                bp = null;
            });
            bp_bank = [];
           console.log(dat); 

            dat.forEach(function(val) {
                var bp = audioElements.Bandpass(val.frequency, 1000, val.amplitude);
                driver.link(bp).link(wetGain);
            });
        };
        this.setQ = function(q) {
            // set all bandpass q values 
        };
    };
    actors.SubtractiveSynthesis.prototype = new audio.AudioModule();

return actors; });

