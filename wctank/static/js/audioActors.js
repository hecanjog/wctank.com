define( 
    [
        'audio',
        'audioElements'
    ],

function(audio, audioElements) { var actors = {};
    
    actors.Driver = function(sonority, amplitude) {
        this.noise = elements.Noise();
     
        this.oscBank = [];
        for (var i = 0; i < num_osc; i++) {
            this.oscBank.push(elements.Osc);
            this.noise.link(oscBank[i]);
        }
     
    }; 
    actors.Driver.prototype = new audio.AudioModule();

return actors; });

