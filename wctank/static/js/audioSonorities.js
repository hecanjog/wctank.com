define(
    [
        'audioUtil'
    ],    
/*
 * TODO: This is incomplete and not ready for use!
 */
function(audioUtil) { var audioSonorities = {};

    audioSonorities.VoiceTuple = function VoiceTuple(frequency, amplitude, unit) {
        this.frequency = frequency;
        
        if (typeof amplitude === 'undefined') {
            this.amplitude = 1.0;
        } else {
            this.amplitude = amplitude;
        }
        
        if (typeof unit === 'undefined') {
            this.unit = 'hz';
        } else {
            this.unit = unitEnum;
        }
    };

    audioSonorities.Sonority = function Sonority() {
        this.voices = [];

        var args = arguments;
        for (var i = 0; i < args.length; i++) {
            if ( Array.isArray(args[i]) ) {
                var cntr = 0;
                while (cntr < args[i].length) {
                    if (args[i][cntr].constructor.name === 'VoiceTuple') {
                        this.voices.push(args[i][cntr++]);
                    } else {
                        var f, a, u,
                            b = 0;
                        f = args[i][cntr + b++];
                        if (args[i][cntr + b] > 1.0) {
                            a = args[i][cntr + b++];
                            if (typeof args[i][cntr + b] === 'string') 
                                u = args[i][cntr + b++]; 
                        }
                        this.voices.push(new audioSonorities.VoiceTuple(f, a, u);
                        cntr += b;
                    }
                }
            } else if (args[i].constructor.name === 'VoiceTuple') {
                this.voices.push(args[i]);
            } else {
                // if passing numbers   
            }
        }
   
        // uniform detune
        // detune map
        // the uniform detune is trivial,
        // but what about a detune map? 
        // or set functions
        // also detune odds, evens
        this.detune = function(cents) {
            this.voices.forEach(function(voice) {
                voice.frequency = audioUtil.units.cents2Hz(cents, voice.frequency);   
            });
        }; 
        

        //this.transpose

        /* TODO:
        this.detune // in cents
        this.deform 
        this.transpose // in mels
        this.invert // around what point
        this.addVoice 
        this.removeVoice
        */
    };
   
    //TODO: a pool of neat chords

return audioSonorities; });
