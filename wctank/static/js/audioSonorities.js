define(

{
    VoiceTuple: function VoiceTuple(frequency, amplitude) {
        this.frequency = frequency;
        this.amplitude = amplitude;
    },

    Sonority: function Sonority() {
        this.values = {};
        var args = arguments;
        for (var i = 0; i < args.length; i++) {
            if ( Array.isArray(args[i]) ) {
                this.values[i] = new sonorities.VoiceTuple(args[i][0], args[i][1]);
            } else if ( args[i].constructor.name === 'VoiceTuple'  ) {
                this.values[i] = args[i]; 
            }
        }
        /* TODO:
        this.detune // in cents
        this.deform 
        this.transpose // in mels
        this.invert // around what point
        this.addVoice 
        this.removeVoice
        */
    }
   
    //TODO: a pool of neat chords

return sonorities; });
