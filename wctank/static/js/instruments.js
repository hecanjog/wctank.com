define(
    [
        'audioCore',
        'audioModules',
        'audioNodes',
        'audioUtil',
        'instrumentCore',
        'envelopeCore',
        'envelopeAsdr',
        'util',
        'featureDetectionMain',
        'text!bassDrumSprites.TextGridIntervals',
        'text!wesSprites.TextGridIntervals'
    ],

function(audioCore, audioModules, audioNodes, audioUtil, instrumentCore, 
            envelopeCore, envelopeAsdr, util, featureDetectionMain, 
            bassDrumSprites, wesSprites) { var instruments = {};
    
    var au_ext = featureDetectionMain.audioExt;

    //TODO: normalize ParameterizedAction target naming conventions
    instruments.RaspyCarpark = function() {
        var noise = audioModules.Noise(); 
        noise.gain.gain.value = 0.0;
        noise.start();

        var convo = audioModules.Convolution("/static/assets/carpark"+au_ext);
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
    instruments.RaspyCarpark.prototype = new instrumentCore.Instrument();

    instruments.AngularNastay = function() {
        this.osc = audioModules.Osc('square');
        this.osc.start();
        this.osc.gain.gain.value = 0;
        
        this.gain = audioNodes.Gain();
        this.gain.gain.value = 0.2;

        this.osc.link(this.gain);

        this._link_alias_out = this.gain;

        var oscAsdr = new envelopeAsdr.Generator(envelopeAsdr.presets.roughStart);

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
    instruments.AngularNastay.prototype = new instrumentCore.Instrument(); 

    // TODO: reimplement in future to incorporate Sonorities
    // for now, constructs with array of frequencies
    instruments.SubtractiveChoir = function(arr) {
        var outer = this,
            q = 200,
            amp = 1;
        
        this.noise = audioModules.Noise();
        this.gain = audioNodes.Gain();

        this.bp_bank = [];

        var pushBp = function(freq) {
            var bp = audioModules.Bandpass(freq, q, amp);
            outer.noise.link(bp).link(outer.gain);
            outer.bp_bank.push(bp);
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
            outer.bp_bank.forEach(function(v) {
                v.accent();
            });
        };

        var attackAsdrParams = {
            a: {
                dur: 400,
                inter: {type: 'linear'}, // TODO: setting exponential here breaks everything
                val: [0.01, 0,  
                      0.43, 99]
            },
            s: {
                dur: 100,
                val: 0.43
            },
            d: {
                dur: 500, 
                inter: {type: 'linear'},
                val: [0.43, 0,    
                      0.3, 99]
            },
            r: {
                dur: 200,
                inter: {type: 'linear'},
                val: [0.3, 0, 
                      0, 99]
            }
        };
        attackAsdr = new envelopeAsdr.Generator(attackAsdrParams);

        this.attack = new instrumentCore.ParameterizedAction(this.gain.gain); 
        //TODO: allow variable returns in envelopeAsdr.Generator attack and decay stages
        // to avoid this kind of confusing munging
        this.attack.createEnvelope = function(dur) {
            attackAsdr.attack.duration = 
                util.smudgeNumber(attackAsdr.attack.duration, 5);
            attackAsdr.decay.duration = util.smudgeNumber(200, 5);
            outer.attack.envelope = attackAsdr.getASDR();
            return outer.attack.envelope;
        };
    };
    instruments.SubtractiveChoir.prototype = new instrumentCore.Instrument();
    
    instruments.Organ = function() {
        var outer = this;

        var max_voices = 10,
            partials = 10,
            q = 250;

        var atten = audioNodes.Gain();
        this.outGain = audioNodes.Gain();
        atten.link(this.outGain);
    
        this._link_alias_out = this.outGain;

        var noise = audioModules.Noise(1, 8);
        noise.start();

        var voices = [];

        var Voice = function() {
            var outer = this;
            
            var inNode = audioNodes.Gain(),
                bp_bank = [];
            
            this.outGain = audioNodes.Gain();
            this.outGain.gain.value = 0;

            for (var j = 0; j < partials; j++) {
                (function() {
                    var bp = audioModules.Bandpass(100, q);
                    bp.setFrequency = null;
                    audioCore.moduleExtensions.setValue(
                        bp, bp.biquad, 'frequency', 'setFrequency', false
                    );
                    bp_bank.push(bp);
                    inNode.link(bp).link(outer.outGain);
                }());
            }
            
            this.setFrequency = function(freq) {
                for (var l = 0; l < bp_bank.length; l++) {
                    bp_bank[l].setFrequency(freq + freq * l);
                    var gain = 1 / (l + 1);
                    if ((l + 1) % 3 === 0) gain += 0.1;
                    bp_bank[l].setGain(gain);
                }
            };

            this.attackTarget = new instrumentCore.ParameterizedAction(this.outGain.gain);
            this.attackTarget.createEnvelope = function(env) {
                outer.attackTarget.envelope = env;
                outer.attackTarget.execute();
            };

            this._link_alias_in = inNode;
            this._link_alias_out = this.outGain; 
        };
        Voice.prototype = new audioCore.AudioModule();

        for (var i = 0; i < max_voices; i++) {
            voices[i] = new Voice();
            noise.link(voices[i]).link(atten);
        }

        // paramObj: {voice: number, frequency: number}
        this.pitchTarget = new instrumentCore.ParameterizedAction(function(paramObj) {
            voices[paramObj.voice].setFrequency(paramObj.frequency);
        });

        var ptEnv = new envelopeCore.Envelope();
        ptEnv.duration = 25;
        ptEnv.interpolationType = 'none';
  
        this.pitchTarget.createEnvelope = function(paramObj) {
            ptEnv.valueSequence = [new envelopeCore.EnvelopeValue(paramObj, 0)];
            return ptEnv.toAbsolute();
        };
        
        var attackAsdr = new envelopeAsdr.Generator({
            a: {
                dur: 200,
                inter: {type: 'exponential'},
                val: [0.01, 0,  1, 99]
            },
            s: {
                dur: 100,
                val: 1
            },
            d: {
                dur: 50,
                inter: {type: 'linear'},
                val: [1, 0,  0.7, 99]
            },
            r: {
                dur: 50,
                inter: {type: 'linear'},
                val: [0.7, 0,  0.5, 99]
            }
        });

        // paramObj : {isAttack: true for yes, false for release, 'asdr' for full envelope 
        //      voices: [array of voices to trigger]}
        //      dur: {subd: if 'asdr', provide subd, clock: clock ref}
        this.attackTarget = new instrumentCore.ParameterizedAction(function(paramObj) {
            var cmd = voices[paramObj.voice].attackTarget.createEnvelope;
            
            if (paramObj.isAttack === 'asdr') {
                var dur = paramObj.dur.subd * paramObj.dur.clock.beatLength,
                    sus_len = dur - (attackAsdr.attack.duration + attackAsdr.decay.duration +
                        attackAsdr.release.duration);
                cmd(attackAsdr.getASDR(sus_len));    
            } else if (paramObj.isAttack) {
                cmd(attackAsdr.getAS());
            } else {
                cmd(attackAsdr.getDR());
            }
        });

        var atEnv = new envelopeCore.Envelope();
        atEnv.duration = 50;
        atEnv.interpolationType = 'none';
        
        this.attackTarget.createEnvelope = function(paramObj) {
            atEnv.valueSequence = [new envelopeCore.EnvelopeValue(paramObj, 0)];
            outer.attackTarget.envelope = atEnv.toAbsolute();
            return atEnv.toAbsolute();
        };
    };
    instruments.Organ.prototype = new instrumentCore.Instrument();

    instruments.Beep = function() {
        // TODO: this should be reimplemented when Sonorities are available
        var beep_sono = [
            1863.53118,
            2201.114014,
            1879.656616,
            1927.278442,
            1951.355347,
            2191.642578,
        ];

        var osc_bank = [],
            oscBankAttackGain = audioNodes.Gain();
        this.oscBankGain = audioNodes.Gain();
        
        for (var i = 0; i < 3; i++) {
            var freq = util.getRndItem(beep_sono),
                type = util.getRndItem(audioUtil.oscTypes);

            osc_bank.push(audioModules.Osc(type, freq * 1.33, 0.12));
            osc_bank[i].link(oscBankAttackGain).link(this.oscBankGain);
        }
        
        this.smudgeOscSonority = function(time) {
            osc_bank.forEach(function(v) {
                v.setFrequency(util.smudgeNumber(v.osc.frequency.value, 5), time); 
                v.setGain(util.smudgeNumber(v.gain.gain.value, 10), time);
            });
        };
        this.smudgeOscSonority(0);

        audioCore.moduleExtensions.setValue(this, this.oscBankGain, 'gain', 'setGain', false);

        var oscBankAsdr = new envelopeAsdr.Generator(envelopeAsdr.presets.roughStart);
        this.oscBankAttack = new instrumentCore.ParameterizedAction(oscBankAttackGain.gain);
        // TODO: implement mechanism to abstract out this copypasto?
        this.oscBankAttack.createEnvelope = function(stage) {
            if (stage) {
                return oscBankAsdr.getAS();
            } else {
                return oscBankAsdr.getDR();
            }
        };

        this._link_alias_out = this.oscBankGain;

        audioCore.moduleExtensions.startStopThese(this, osc_bank); 
    };
    instruments.Beep.prototype = new instrumentCore.Instrument();

    // field recording
    instruments.WesEnviron = function() {
        // TODO: moduleExtensions.startStopThese should also call .play?
        this.bigEarDOM = document.createElement('audio');
        this.bigEarDOM.src = "/streaming/bigearsample.6"+au_ext;
        this.bigEarDOM.autoplay = true;
        this.bigEarDOM.loop = true;

        this.outGain = audioNodes.Gain();
        
        var bigEar = audioNodes.MediaElementSource(this.bigEarDOM);
        bigEar.link(this.outGain);
       
        this._link_alias_out = this.outGain;
    };
    instruments.WesEnviron.prototype = new instrumentCore.Instrument();

    instruments.BigSampleDrum = function() {
        var player = new audioModules.SamplePlayer(
            "/static/assets/bass_drum_sprites"+au_ext,
            bassDrumSprites   
        );
       
        var current = 0;
        this.outGain = player.outGain;

       // envelope out if interrupting play! 
        this.bangTarget = function() {
            player.play(current);
            current = ++current % player.samples;
        };

        var gtEnv = new envelopeCore.Envelope();
        gtEnv.duration = 100;
        gtEnv.interpolationType = 'linear';

        //TODO: abstract out this boilerplate
        this.gainTarget = new instrumentCore.ParameterizedAction(player.outGain.gain);
        this.gainTarget.createEnvelope = function(paramObj) {
            gtEnv.valueSequence = [new envelopeCore.EnvelopeValue(paramObj.val, 99)];
            return gtEnv.toAbsolute(paramObj.time);
        }; 

        this._link_alias_out = player;
    };
    instruments.BigSampleDrum.prototype = new instrumentCore.Instrument();

    instruments.WesVox = function() {
        var wes = audioModules.SpritePlayer("/static/assets/wes"+au_ext, wesSprites);
        this.outGain = audioNodes.Gain();

        wes.link(this.outGain);
        
        this.actionTarget = wes.playRandomSprite;

        this._link_alias_out = this.outGain;
    };
    instruments.WesVox.prototype = new instrumentCore.Instrument();

    instruments.NoiseSquawk = function() {
        var outer = this;
        
        var noise = audioModules.Noise(0, 10);
        noise.start();
        noise.gain.gain.value = 0;

        this.outGain = audioNodes.Gain();
        this.outGain.gain.value = 0.1;

        noise.link(this.outGain);    
        
        // let's make an envelope for noise squaks
        var attackValues = [];
        for (var i = 0; i < 19; i++) {
            attackValues.push(Math.random() * 0.5 + 0.3, i * 5); 
        }
        attackValues.push(1, 100);

        var attack = new envelopeAsdr.ComponentEnvelope(200, 'none', null, attackValues),
            sustain = new envelopeAsdr.Sustain(1, 1),
            release = new envelopeAsdr.ComponentEnvelope(500, 'none', null, [0, 0]);

        var decay = new envelopeAsdr.ComponentEnvelope(500, 'none', null);

        var calcDecaySequence = function() {
            var decayValues = [];
            for (var j = attack.valueSequence.length - 1; j > 0; j--) {
                decayValues.push(attack.valueSequence[j]);
            }
            
            var decayDummy = new envelopeCore.Envelope();
            decayDummy.valueSequence = decayValues;
            decayDummy.duration = 500;
            decayDummy.interpolationType = 'none';

            var line = new envelopeCore.Envelope();
            line.duration = 100;
            line.valueSequence = envelopeCore.arrayToEnvelopeValues([1, 0,  0, 99]);
            line.interpolationType = 'none';
            
            var cooked = line.bake(decayDummy, 100, 0.8);
            envelopeAsdr.clipValueSequence(cooked);

            decay.valueSequence = cooked.valueSequence;
        };
        calcDecaySequence();

        var noiseAsdr = new envelopeAsdr.Generator(attack, sustain, decay, release);
       
        this.attackTarget = new instrumentCore.ParameterizedAction(noise.gain.gain);
        this.attackTarget.createEnvelope = function(dur) {
            noise.downsample = util.smudgeNumber(20, 75);
            noiseAsdr.attack.valueSequence.forEach(function(v) {
                v.value = Math.random();
            });
            calcDecaySequence();
            noiseAsdr.attack.duration = dur / 2;
            noiseAsdr.decay.duration = dur / 2;
            outer.attackTarget.envelope = noiseAsdr.getASDR();
            return outer.attackTarget.envelope;     
        };

        this._link_alias_out = this.outGain;
    };
    instruments.NoiseSquawk.prototype = new instrumentCore.Instrument();

return instruments; });
