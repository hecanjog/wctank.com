define( 
    [
        'audio',
        'audioElements'
    ],

function(audio, audioElements) { var actors = {};
    
    actors.Driver = function(sonority, amplitude) {
        this.noise = audioElements.Noise();
     
        var osc_bank; 
    }; 
    actors.Driver.prototype = new audio.AudioModule();

return actors; });

