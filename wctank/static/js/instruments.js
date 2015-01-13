define(
    [
        'audioCore',
        'audioModules',
        'audioNodes',
        'instrumentCore',
        'envelopeCore',
        'envelopeAsdr',
        'util'
    ],

function(audioCore, audioModules, audioNodes, instrumentCore, 
            envelopeCore, envelopeAsdr, util) { var instruments = {};

    instruments.raspyCarpark = function() {
        var noise = audioModules.Noise(); 
        noise.gain.gain.value = 0.0;
        noise.start();

        var convo = audioModules.Convolution("/static/assets/carpark.mp3");
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
        this.osc = audioModules.Osc('square');
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

    // TODO: reimplement in future to incorporate Sonorities
    // for now, constructs with array of frequencies
    instruments.SubtractiveChoir = function(arr) {
        var parent = this,
            q = 200,
            amp = 1;
        
        this.noise = audioModules.Noise();
        this.gain = audioNodes.Gain();

        this.bp_bank = [];

        var pushBp = function(freq) {
            var bp = audioModules.Bandpass(freq, q, amp);
            parent.noise.link(bp).link(parent.gain);
            parent.bp_bank.push(bp);
        };

        if (Array.isArray(arr)) {
            arr.forEach(function(v) {
                pushBp(v);                
            });
        }
       
        this._link_alias_out = this.gain;

        // actions
        audioCore.moduleExtensions.startStopThese(this, this.noise);
        
        this.accent = function() {
            parent.bp_bank.forEach(function(v) {
                v.accent();
            });
        };

        this.fadeInOut = function(time) {
            parent.bp_bank.forEach(function(v) {
                v.fadeInOut(time);
            }); 
        };
        
        this.sonority = new instrumentCore.ParameterizedAction(function(arr, time) {
            var vals = arr;
            if (vals.length < bp_bank.length) {
                var diff = bp_bank.length - vals.length;
                while (diff-- > 0) {
                    bp_bank.pop();
                }
            }
            this.bp_bank.forEach(function(v) {
                v.setFrequency(vals.shift()); 
            });
            if (vals.length > 0) {
                vals.forEach(function(v) {
                    pushBp(v);
                });
            } 
        });

        var attackAsdrParams = {
            a: {
                dur: 400,
                inter: {
                    type: 'exponential'
                },
                val: [0.01, 0,    0.5, 99]
            },
            s: {
                dur: 100,
                val: 0.6
            },
            d: {
                dur: 500, 
                inter: {
                    type: 'linear'
                },
                val: [0.5, 0,    0.2, 99]
            },
            r: {
                dur: 200,
                inter: {
                    type: 'linear'        
                },
                val: [0.2, 0,   0, 100]
            }
        };
        attackAsdr = new envelopeAsdr.Generator(attackAsdrParams);

        this.attack = new instrumentCore.ParameterizedAction(this.gain.gain); 
        //TODO: allow variable returns in envelopeAsdr.Generator attack and decay stages
        //to avoid this kind of munging
        // takes an obj of the form {dur: number, stage: boolean(true for as, false for dr)}
        this.attack.createEnvelope = function(dur) {
            attackAsdr.attack.duration = 
                util.smudgeNumber(attackAsdr.attack.duration, 5);
            attackAsdr.decay.duration = 
                util.smudgeNumber(200, 5);
            this.envelope = attackAsdr.getASDR(dur);
            return this.envelope;
        };
    };
    instruments.SubtractiveChoir.prototype = new instrumentCore.Instrument();

    // just stream a few field recordings and expose crossfading functionality
    // TODO: this was interacting oddly with the dragstart event in Rooms,
    // take time to figure that out.
    instruments.WesEnviron = function() {
        var bigEarDOM = document.createElement('audio');
        bigEarDOM.src = "/streaming/bigear.mp3";
        bigEarDOM.autoplay = true;
        bigEarDOM.loop = true;

        var bigEar = audioCore.ctx.createMediaElementSource(bigEarDOM),
            bigEarGain = audioNodes.Gain();
        bigEar.connect(bigEarGain);

        var outGain = audioNodes.Gain();

        bigEarGain.connect(outGain);

        this._link_alias_out = outGain;

        var gainAsdrParams = {
            a: {
                dur: 1000,
                inter: {
                    type: 'exponential'
                },
                val: [0.01, 0,  1, 99]
            },
            s: {
                dur: 1000,
                val: 1
            },
            d: {
                dur: 1000,
                inter: {
                    type: 'exponential'
                },
                val: [0.01, 0,  1, 99]
            },
            r: {
                dur: 10,
                inter: {
                    type: 'none'
                },
                val: [0, 0,  0, 99]
            }
        };
        var gainAsdr = new envelopeAsdr.Generator(gainAsdrParams);

        this.gain = new instrumentCore.ParameterizedAction(outGain.gain);
        this.gain.createEnvelope = function(valObj) {
            if (valObj.stage) {
                return gainAsdr.attack.toAbsolute(valObj.dur);
            } else {
                return gainAsdr.decay.toAbsolute(valObj.dur);
            }
        };

    };
    instruments.WesEnviron.prototype = new instrumentCore.Instrument();

return instruments; });
