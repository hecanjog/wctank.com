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

        var convo = audioElements.Convolution("/static/assets/carpark.mp3");
        convo.wetDry(100);
        convo.gain.gain.value = 1.0;

        window.convo = convo;
        noise.link(convo).link(audio.out);

        var noiseAsdrParams = {
            a: {
                dur: 10,
                inter: {
                    type: 'none'
                },
                val: [0, 0,  1, 99]
            },
            s: {
                dur: 10,
                val: 1
            },
            d: {
                dur: 50,
                inter: {
                    type: 'linear'
                },
                val: [0.8, 0,  0.5, 99]
            },
            r: {
                dur: 10,
                inter: {
                    type: 'linear'
                },
                val: [0.001, 100] 
            }
        };

        var noiseAsdr = new asdr.Generator(noiseAsdrParams);

        var noiseAction = new instrument.ParameterizedAction(noise.gain.gain);
        noiseAction.envelope = noiseAsdr.getASDR();

        this.actionTarget = noiseAction.execute;
    };
    instrumentDefs.noiseBass.prototype = new instrument.Instrument();

    // instrument.getTarget method?

return instrumentDefs; });
