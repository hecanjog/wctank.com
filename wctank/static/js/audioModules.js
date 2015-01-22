define(
    [
        'audioCore',
        'audioUtil',
        'audioNodes',
        'util'
    ],

function(audioCore, audioUtil, audioNodes, util) { var audioModules = {};

    // make a buffer for white noise
    var sr = audioCore.ctx.sampleRate;
    var samples = sr * 2.5;
    var noise_buf = audioCore.ctx.createBuffer(2, samples, sr);
    for (var channel = 0; channel < 2; channel++) {
        var channelData = noise_buf.getChannelData(channel);
        for (var i = 0; i < samples; i++) {
            channelData[i] = Math.random() * 2 - 1;
        }
    }
    
    audioModules.Noise = function Noise(amplitude) {
        if (this.constructor !== audioCore.AudioModule) 
            return new audioModules.Noise(amplitude);
        this.source = audioCore.ctx.createBufferSource();
        this.source.buffer = noise_buf;
        this.source.loop = true;
        
        audioCore.moduleExtensions.startStopThese(this, this.source);
        
        this.gain = audioCore.ctx.createGain();
        
        var val;
        if (amplitude) {
            val = amplitude;
        } else {
            val = 1;
        }
        this.gain.gain.value = val;

        this.source.connect(this.gain);
        this._link_alias_out = this.gain;
    };
    audioModules.Noise.prototype = new audioCore.AudioModule();
    
    audioModules.Osc = function Osc(oscType, frequency, amplitude) {
        if (this.constructor !== audioCore.AudioModule) 
            return new audioModules.Osc(oscType, frequency, amplitude);

        this.osc = audioCore.ctx.createOscillator();
        this.osc.frequency.value = frequency ? frequency : 440;
        this.osc.type = oscType ? oscType : 'sine';

        this.gain = audioCore.ctx.createGain();
        this.gain.gain.value = amplitude ? amplitude : 1.0;

        this.osc.connect(this.gain);
        
        this._link_alias_out = this.gain;

        audioCore.moduleExtensions.startStopThese(this, this.osc);
        audioCore.moduleExtensions.setValue(this, this.osc, 'frequency', 'setFrequency', true);
        audioCore.moduleExtensions.setValue(this, this.gain, 'gain', 'setGain', true);
    };
    audioModules.Osc.prototype = new audioCore.AudioModule();

    audioModules.Bandpass = function Bandpass(frequency, Q, initGain) {
        // construct sans new
        if (this.constructor !== audioCore.AudioModule) 
            return new audioModules.Bandpass(frequency, Q);
        
        // bp filter
        this.biquad = audioCore.ctx.createBiquadFilter();
        this.biquad.type = "bandpass";
        this.biquad.frequency.value = frequency ? frequency : 440;
        this.biquad.Q.value = Q ? Q : this.biquad.Q.value;
        var biquad = this.biquad;
                   
        // gain node
        this.gain = audioCore.ctx.createGain();
        this.gain.gain.value = initGain ? initGain : 1.0;
        var gain = this.gain;
        
        // for TWEENS 
        var updateFrequency = function() {
            biquad.frequency.value = params.frequency;
        };
        var updateQ = function() {
            biquad.Q.value = params.Q;
        };
        var updateGain = function() {
            gain.gain.value = params.amplitude;
        };
        var params = {  frequency: biquad.frequency.value, 
                        Q: biquad.Q.value,
                        amplitude: gain.gain.value }; 
       
        // routing                
        this.biquad.connect(this.gain);
        this._link_alias_in = this.biquad;
        this._link_alias_out = this.gain;

        // behaviors 
        audioCore.moduleExtensions.setValue(
            this, this.biquad, 'frequency', 'setFrequency', true);
        
        var accenting = false;
        var gen = (function(gen) {
            var _$ = {
                Q: 0,
                amplitude: 0
            };
            var ret = function(p, pos, diff_base, smdg_pcnt) {
                if (pos) {
                    _$[p] = params[p];
                    return params[p] + util.smudgeNumber(diff_base, smdg_pcnt);
                } else {
                    return _$[p];
                }
            };
            var freqTarget = function(prop, base, range) {
                var diff = (Math.random() < 0.5) ? base * -1 : base;
                return prop + util.smudgeNumber(diff, range);
            };
            gen.Q = function(pos) {
                var rq = ret('Q', pos, 70, 20);
                return rq;
            };
            gen.amp = function(pos) {
                return ret('amplitude', pos, 1, 50);
            };
            gen.freq = function(pos) {
                var freq = params.frequency;
                return pos ? freqTarget(freq, 23, 10) : freqTarget(freq, 20, 20);
            };
            return gen;
        }({}));
        
        this.accent = function() {
            if (!accenting) {        
                accenting = true;
                var accent_time = util.smudgeNumber(100, 10);
                var repeats = util.smudgeNumber(8, 50) | 0;
                var recovery_time = util.smudgeNumber(500, 20);
                var total = accent_time * repeats + recovery_time;

                var Q_trans_time = total * 0.5;
                var gain_in_portion = util.smudgeNumber(0.3, 20);
                var gain_in_time = total * gain_in_portion;
                var gain_out_time = total * (1 - gain_in_portion); 
               
                // I tried this with persistent TWEENs and it didn't seem to work as well...
                // TODO: figure out what that's about and try again, because this is awful
                var QIn = new TWEEN.Tween(params)
                            .to({Q: gen.Q(true)}, Q_trans_time)
                            .onUpdate(updateQ);
                var QOut = new TWEEN.Tween(params)
                            .to({Q: gen.Q(false)}, Q_trans_time)
                            .onUpdate(updateQ); 
                
                var gainIn = new TWEEN.Tween(params)
                            .to({amplitude: gen.amp(true)}, gain_in_time)
                            .onUpdate(updateGain);
                var gainOut = new TWEEN.Tween(params)
                            .to({amplitude: gen.amp(false)}, gain_out_time)
                            .onUpdate(updateGain);
                gainIn.chain(gainOut);
                
                var freqIn = new TWEEN.Tween(params)
                            .to({frequency: gen.freq(true)}, accent_time )
                            .easing(TWEEN.Easing.Bounce.InOut)
                            .repeat(util.smudgeNumber(8, 50) | 0)
                            .yoyo(true)
                            .onStart(function() {
                                QIn.start();
                                gainIn.start();
                            })
                            .onUpdate(updateFrequency);
                var freqOut = new TWEEN.Tween(params)
                            .to({frequency: gen.freq(false)}, recovery_time )
                            .easing(TWEEN.Easing.Bounce.InOut)
                            .onUpdate(updateFrequency)
                            .onStart(function() {
                                QOut.start();
                            })
                            .onComplete(function() {
                                accenting = false;
                                audioUtil.tween.stopTweens();
                            });
                freqIn.chain(freqOut);
                
                freqIn.start();
                audioUtil.tween.startTweens();
            }
        };

        var envelope;
        var target_amp; 
        var prior_amp = 0;
        var fading = false;
        this.fadeInOut = function(time) {
            var stopSequence = function() {
                fading = false;
                audioUtil.tween.stopTweens();
            };
            if (!fading) {
                fading = true;
                var on  = (gain.gain.value > 0) ? true : false;
                if (on) prior_amp = gain.gain.value;
                target_amp = on ? 0 : prior_amp;
                envelope = new TWEEN.Tween(params)
                        .to({amplitude: target_amp}, time)
                        .onUpdate(updateGain)
                        .onComplete(stopSequence)
                        .start();
                audioUtil.tween.startTweens();
            } else {
                envelope.stop();
                if (target_amp < gain.gain.value) {
                    target_amp = prior_amp;
                    envelope.to({amplitude: prior_amp}, time).start();
                } else { 
                    target_amp = 0;
                    envelope.to({amplitude: 0}, time).start();
                }
            }
        };
    };
    audioModules.Bandpass.prototype = new audioCore.AudioModule();      

    audioModules.Player = function(pathToFile) {
        if (this.constructor !== audioCore.AudioModule) 
            return new audioModules.Player(pathToFile);

        var media = document.createElement('audio');

        // TODO: there is no longer a reason to keep this weirdness!
        // switch to arraybuffer.
        this.loadFile = function(path) {
            var req = new XMLHttpRequest();
            req.open("GET", path, true);
            req.responseType = 'blob';
            req.onload = function() {
                var reader = new FileReader();
                reader.readAsDataURL(req.response);
                reader.onloadend = function() {
                    media.src = reader.result;
                };
            };
            req.send();
        };
        if (pathToFile) this.loadFile(pathToFile);

        var playing = false;

        this.play = function() {
            playing = true;
            media.play();
        };
        this.pause = function() {
            playing = false;
            media.pause();
        };
        this.setTime = function(time) {
            media.currentTime = time;
        };
        this.stop = function() {
            this.pause();
            this.setTime(0);  
        };

        Object.defineProperties(this, {
            'currentTime': {
                get: function() { return media.currentTime; } 
            },
            'isPlaying': {
                get: function() { return playing; }
            }
        });

        this.mediaSource = audioCore.ctx.createMediaElementSource(media);
        this._link_alias_out = this.mediaSource;
    };
    audioModules.Player.prototype = new audioCore.AudioModule();

    audioModules.SpritePlayer = function(path, TextGridIntervals) {
        if (this.constructor !== audioCore.AudioModule) 
            return new audioModules.SpritePlayer(path, TextGridIntervals);
       
        var player = new audioModules.Player(path);

        this.gain = audioCore.ctx.createGain();
        this.gain.gain.value = def_gain;    

        player.link(this.gain);
        
        var sprites = audioUtil.parseSpriteIntervals(TextGridIntervals); 
        util.objectLength.call(sprites); 
        
        var outer = this;
        this.playRandomSprite = function() {
            if (!player.isPlaying) {        
                var sprite = sprites[(Math.random() * sprites.length) | 0],
                    dur = sprite.end - sprite.start;
                player.setTime(sprite.start);
                this.gain.gain.value = 0;
                this.gain.gain.setValueAtTime(def_gain, audioCore.ctx.currentTime + 0.01);
                player.play();    
                window.setTimeout(function() {
                    outer.gain.gain.setValueAtTime(0, audioCore.ctx.currentTime + 0.01);
                    player.pause(); 
                }, dur * 1000);
            }
        };
        
        this._link_alias_out = this.gain;
    };
    audioModules.SpritePlayer.prototype = new audioCore.AudioModule();

    audioModules.SchroederReverb = function() {
        if (this.constructor !== audioCore.AudioModule) 
            return new audioModules.SchroederReverb();

        var outer = this;

        function AllPass(delay) {
            var nop = audioNodes.Gain();
            this.delay = audioNodes.Delay(delay);
            this.delay.delayTime.value = delay * audioCore.ctx.sampleRate;
            this.feedforwardGain = audioNodes.Gain();
            this.feedforwardGain.gain.value = 0.7;
            var nopOut = audioNodes.Gain();

            nop.link(this.delay).link(this.feedforwardGain).link(nopOut);
            nop.link(nopOut);

            this._link_alias_in = nop;
            this._link_alias_out = nopOut;
        }
        AllPass.prototype = new audioCore.AudioModule();

        function FeedbackCombFilter(delay, feedback) {
            var nop = audioNodes.Gain();
            this.delay = audioNodes.Delay(delay);
            this.delay.delayTime.value = delay * audioCore.ctx.sampleRate;
            this.feedbackGain = audioNodes.Gain();
            this.feedbackGain.gain.value = feedback;
            var nopOut = audioNodes.Gain();
            
            nop.link(this.delay).link(this.feedbackGain).link(nop);
            nop.link(nopOut);

            this._link_alias_in = nop;
            this._link_alias_out = nopOut;
        }
        FeedbackCombFilter.prototype = new audioCore.AudioModule();
       
        var base_time = 0.011,
            series_B_div = 3,
            series_C_div = 9.1,
            par_A_mult = 4.86167,
            par_A_gain = 0.773,
            par_B_mult = 4.61383,
            par_B_gain = 0.802,
            par_C_mult = 5.91642,
            par_C_gain = 0.753,
            par_D_mult = 6.48703,
            par_D_gain = 0.733;

        var dry = audioNodes.Split(2);

        var all1 = new AllPass(base_time),
            all2 = new AllPass(base_time / series_B_div),
            all3 = new AllPass(base_time / series_C_div);

        var split = audioNodes.Split(4);

        var comb1 = new FeedbackCombFilter(base_time * par_A_mult, par_A_gain),
            comb2 = new FeedbackCombFilter(base_time * par_B_mult, par_B_gain),
            comb3 = new FeedbackCombFilter(base_time * par_C_mult, par_C_gain),
            comb4 = new FeedbackCombFilter(base_time * par_D_mult, par_D_gain);

        var mergeL = audioNodes.Merge(2),
            mergeR = audioNodes.Merge(2);
        
        this.wetGain = audioNodes.Gain();
        this.dryGain = audioNodes.Gain();
        this.outGain = audioNodes.Gain();

        /*
         * connections
         */
        dry.link(all1).link(all2).link(all3).link(split); 

            split.link(comb1, 0).link(mergeL, 0, 0);
            split.link(comb2, 1).link(mergeR, 0, 0);
            split.link(comb3, 0).link(mergeL, 0, 1).link(this.wetGain);
            split.link(comb4, 1).link(mergeR, 0, 1).link(this.wetGain).link(this.outGain);

        dry.link(this.dryGain).link(this.outGain);

        /*
         * aliases
         */
        this._link_alias_in = dry;
        this._link_alias_out = this.outGain;

        /*
         * cool stuff to do!
         */
        // it's really easy to break audio playback with this
        // TODO: just set this with operator
        this.setFeedbackCoeffMultiplier = function(n, time) {
            var t = time ? time : 0;
            comb1.feedbackGain.gain
                .linearRampToValueAtTime(par_A_gain * n, audioCore.ctx.currentTime + t);
            comb2.feedbackGain.gain
                .linearRampToValueAtTime(par_B_gain * n, audioCore.ctx.currentTime + t);
            comb3.feedbackGain.gain
                .linearRampToValueAtTime(par_C_gain * n, audioCore.ctx.currentTime + t);
            comb4.feedbackGain.gain
                .linearRampToValueAtTime(par_D_gain * n, audioCore.ctx.currentTime + t);
        };
        
        audioCore.moduleExtensions.wetDry(this, this.dryGain, this.wetGain);
        this.wetDry(50);
       
        audioCore.moduleExtensions.setValue(this, this.outGain, 'gain', 'setGain');
    };
    audioModules.SchroederReverb.prototype = new audioCore.AudioModule();

    audioModules.Convolution = function(path_to_audio) {
        if (this.constructor !== audioCore.AudioModule) 
            return new audioModules.Convolution(path_to_audio);

        var nop = audioNodes.Gain(),
            conv = audioNodes.Convolve();
        conv.normalize = true;
        
        var dryGain = audioNodes.Gain(),
            wetGain = audioNodes.Gain();
        this.gain = audioNodes.Gain();

        nop.link(dryGain).link(this.gain);
        nop.link(conv).link(wetGain).link(this.gain);

        var req = new XMLHttpRequest();
        req.responseType = "arraybuffer";
        req.open("GET", path_to_audio, true);
        req.onload = function() {
            audioCore.ctx.decodeAudioData(req.response, function(audioBuffer) {
                conv.buffer = audioBuffer;
            });
        };
        req.send();

        this._link_alias_in = nop;
        this._link_alias_out = this.gain;
    
        audioCore.moduleExtensions.wetDry(this, dryGain, wetGain);
        this.wetDry(50);
    };
    audioModules.Convolution.prototype = new audioCore.AudioModule();

    // mostly here until audioworkers are implemented
    audioModules.Analysis = function() {
        if (this.constructor !== audioCore.AudioModule) 
            return new audioModules.Analysis();
         
        var analyser = audioCore.ctx.createAnalyser(),
            data = new Uint8Array(analyser.frequencyBinCount);

        analyser.fftSize = 2048;

        var bin_size = audioCore.ctx.sampleRate / analyser.fftSize,
            mag_scalar = 1 / 145; 

        this.getData = function() {
            var r = [];
            
            analyser.getByteFrequencyData(data);

            function Bin(frequency, amplitude) {
                this.frequency = frequency;
                this.amplitude = amplitude;
            }

            for (var i = 0; i < analyser.frequencyBinCount; i++) {
                if (data[i] > 0) {
                    r.push( new Bin(bin_size * i, data[i] * mag_scalar) );
                }
            }
            return r; 
        };

        this._link_alias_in = analyser;
    };
    audioModules.Analysis.prototype = new audioCore.AudioModule();

    // TODO: This is incomplete and broken.
    audioModules.SubtractiveSynthesis = function(withNoise) {
        if (this.constructor !== audioModules.SubtractiveSynthesis) 
            return new audioModules.SubtractiveSynthesis(withNoise);

        var dryIn = audioNodes.Gain(),
            anaIn = audioNodes.Gain(),
            analyser = audioModules.Analysis(),
            noise = audioModules.Noise(),
            dryGain = audioNodes.Gain(),
            wetGain = audioNodes.Gain(),
            outGain = audioNodes.Gain();

        anaIn.link(analyser);
        dryIn.link(dryGain).link(outGain);
        wetGain.link(outGain);

        var driver = withNoise ? noise : dryIn;

        this._link_alias_in = [dryIn, anaIn];
        this._link_alias_out = outGain;    

        audioCore.moduleExtensions.startStopThese(this, noise); 
        audioCore.moduleExtensions.wetDry(this, dryGain, wetGain);

        var bp_bank = [];
        this.updateFromSound = function() {
            var dat = analyser.getData();
            bp_bank.forEach(function(bp) {
                bp = null;
            });
            bp_bank = [];

            dat.forEach(function(val) {
                var bp = audioModules.Bandpass(val.frequency, 1000, val.amplitude);
                driver.link(bp).link(wetGain);
            });
        };
        this.setQ = function(q) {
            // set all bandpass q values 
        };
    };
    audioModules.SubtractiveSynthesis.prototype = new audioCore.AudioModule();

    // this is inefficient, but fine for small numbers of short sounds
    // TODO: Instead, take a file + annotations and split audio into array buffers
    audioModules.SamplePlayer = function(arr) {
        if (this.constructor !== audioModules.SamplePlayer)
            return new audioModules.SamplePlayer(arr);
        
        var players = [];
        this.outGain = audioNodes.Gain();
        this.outGain.gain.value = 1.0;

        for (var i = 0; i < arr.length; i++) {
            players.push(new audioModules.Player(arr[i]));
            players[i].link(this.outGain); 
        }
        
        Object.defineProperty(this, 'samples', {
            value: players.length
        });
        // with index
        this.play = function(n) {
            if (players[n].isPlaying) players[n].stop();
            players[n].play();
        }; 
        this.killAll = function() {
            players.forEach(function(v) {
                v.stop();
            });
        };
        //limit concurrent sounds?
        this._link_alias_out = this.outGain;
    };
return audioModules; });
