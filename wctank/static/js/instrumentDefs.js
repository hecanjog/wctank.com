define(
    [
        'audio',
        'audioElements',
        'instrument',
        'asdr',
        'envelopeCore'
    ],

function(audio, audioElements, instrument, asdr, envelopeCore) { var instrumentDefs = {};

    instrumentDefs.noiseBass = function() {
        var noise = audioElements.Noise(); 
        noise.gain.gain.value = 0.0;
        noise.start();

        var verb = audioElements.SchroederReverb();
        verb.wetDry(10);

        noise.link(verb).link(audio.out);

        var noiseAsdrParams = {
            a: {
                dur: 10,
                inter: {
                    type: 'none'
                },
                val: [0, 0,  1, 99]
            },
            s: {
                dur: 50,
                val: 0.8
            },
            d: {
                dur: 200,
                inter: {
                    type: 'linear'
                },
                val: [0.8, 0,  0.5, 99]
            },
            r: {
                dur: 50,
                inter: {
                    type: 'linear'
                },
                val: [0.001, 100] 
            }
        };

        var noiseAsdr = new asdr.Generator(noiseAsdrParams);

        var noiseAction = new instrument.ParameterizedAction(noise.gain.gain);
        noiseAction.envelope = noiseAsdr.getASDR();

        this.play = function() {
            noiseAction.execute();
        };
       
        this.actionTarget = this.play;

    };
    instrumentDefs.noiseBass.prototype = new instrument.Instrument();

    // instrument.getTarget method?

return instrumentDefs; });
