define(
    [
        'audioElements',
        'audioNodes',
        'instrumentCore',
        'envelopeCore',
        'envelopeAsdr',
        'util'
    ],

function(audioElements, audioNodes, instrumentCore, 
            envelopeCore, envelopeAsdr, util) { var instruments = {};

    instruments.raspyCarpark = function() {
        var noise = audioElements.Noise(); 
        noise.gain.gain.value = 0.0;
        noise.start();

        var convo = audioElements.Convolution("/static/assets/carpark.mp3");
        convo.wetDry(100);
        convo.gain.gain.value = 1.0;

        noise.link(convo);

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
        var noiseAsdr = new envelopeAsdr.Generator(noiseAsdrParams);

        var noiseAction = new instrumentCore.ParameterizedAction(noise.gain.gain);
        noiseAction.envelope = noiseAsdr.getASDR();

        this.actionTarget = function() {
            noiseAction.execute();
        };
        
        this._link_alias_out = convo;
    };
    instruments.raspyCarpark.prototype = new instrumentCore.Instrument();

    instruments.angularNastay = function() {
        
        this.osc = audioElements.Osc('square');
        this.osc.start();
        this.osc.gain.gain.value = 0;
        
        this.gain = audioNodes.Gain();
        this.gain.gain.value = 0.2;

        this.osc.link(this.gain);

        this._link_alias_out = this.gain;

        var oscAsdrParams = {
            a: {
                dur: 100,
                inter: {
                    type: 'none'
                },
                val: [0.01, 0,      1, 10,
                      0.2, 20,      0.9, 30,
                      0.4, 40,      0.8, 50,
                      0.3, 57,      0.75, 64,
                      0.45, 73,     0.83, 83,
                      0.15, 90,     1, 99]
            },
            s: {
                dur: 100,
                val: 1
            },
            d: {
                dur: 200,
                inter: {
                    type: 'linear'
                },
                val: [1, 0,  0.5, 99]              
            },
            r: {
                dur: 50,
                inter: {
                    type: 'exponential'
                },
                val: [0.5, 0,  0.0001, 99]
            }
        };
        var oscAsdr = new envelopeAsdr.Generator(oscAsdrParams);

        this.attack = new instrumentCore.ParameterizedAction(this.osc.gain.gain);
        this.attack.createEnvelope = function(stage) {
            if (stage) {
                return oscAsdr.getAS();
            } else {
                return oscAsdr.getDR();
            }
        };

        var pEnv = new envelopeCore.Envelope();
        pEnv.interpolationType = 'none';
        pEnv.duration = 100;

        this.pitch = new instrumentCore.ParameterizedAction(this.osc.osc.frequency);
        this.pitch.createEnvelope = function(freq) {
            pEnv.valueSequence = [new envelopeCore.EnvelopeValue(freq, 0)];
            return pEnv.toAbsolute();
        };
    };
    instruments.angularNastay.prototype = new instrumentCore.Instrument(); 

return instruments; });
