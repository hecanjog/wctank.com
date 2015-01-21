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
        'featureDetectionMain'
    ],

function(audioCore, audioModules, audioNodes, audioUtil, instrumentCore, 
            envelopeCore, envelopeAsdr, util, featureDetectionMain) { var instruments = {};
   
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

        var attackAsdrParams = {
            a: {
                dur: 400,
                inter: {type: 'exponential'},
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
                      0, 100]
            }
        };
        attackAsdr = new envelopeAsdr.Generator(attackAsdrParams);
        this.asdr = attackAsdr;

        this.attack = new instrumentCore.ParameterizedAction(this.gain.gain); 
        //TODO: allow variable returns in envelopeAsdr.Generator attack and decay stages
        // to avoid this kind of confusing munging
        this.attack.createEnvelope = function(dur) {
            attackAsdr.attack.duration = 
                util.smudgeNumber(attackAsdr.attack.duration, 5);
            attackAsdr.decay.duration = util.smudgeNumber(200, 5);
            this.envelope = attackAsdr.getASDR(dur);
            return this.envelope;
        };
    };
    instruments.SubtractiveChoir.prototype = new instrumentCore.Instrument();

    // field recording / osc bank
    instruments.WesEnviron = function() {
        // TODO: moduleExtensions.startStopThese should also call .play?
        this.bigEarDOM = document.createElement('audio');
        this.bigEarDOM.src = "/streaming/bigearsample.6"+au_ext;
        this.bigEarDOM.autoplay = true;
        this.bigEarDOM.loop = true;

        var bigEar = audioNodes.MediaElementSource(this.bigEarDOM);
        this.bigEarGain = audioNodes.Gain();
        bigEar.link(this.bigEarGain);

        // TODO: this should be reimplemented when Sonorities are available
        var choir_sonority = [
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
        for (var i = 0; i < 2; i++) {
            var freq = util.getRndItem(choir_sonority),
                type = util.getRndItem(audioUtil.oscTypes);

            osc_bank.push(audioModules.Osc(type, freq, 0.12));
            osc_bank[i].link(oscBankAttackGain);
        }

        var lowDroner = new audioModules.Osc('sine', 40, 1);
        lowDroner.link(oscBankAttackGain);
        osc_bank.push(lowDroner);

        oscBankAttackGain.link(this.oscBankGain);

        this.outGain = audioNodes.Gain();
        
        this.bigEarGain.link(this.outGain);
        this.oscBankGain.link(this.outGain);

        this._link_alias_out = this.outGain;

        this.smudgeOscSonority = function(time) {
            osc_bank.forEach(function(v) {
                v.setFrequency(util.smudgeNumber(v.osc.frequency.value, 5), time); 
                v.setGain(util.smudgeNumber(v.gain.gain.value, 10), time);
            });
        };
        this.smudgeOscSonority(0);

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
        
        audioCore.moduleExtensions.wetDry(this, this.bigEarGain, this.oscBankGain);
        audioCore.moduleExtensions.startStopThese(this, osc_bank); 
    };
    instruments.WesEnviron.prototype = new instrumentCore.Instrument();

    instruments.BigSampleDrum = function() {
        var p = "static/assets/c-bass_strike_f_0",
            paths = [];

        for (var i = 1; i <= 9; i++) {
            paths.push(p + i + au_ext);
        }
        var player = audioModules.SamplePlayer(paths);

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

return instruments; });
