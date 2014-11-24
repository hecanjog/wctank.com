define(
    [
        'audio',
        'audioUtil',
        'util'
    ],

function(audio, audioUtil, util) { var elements = {};
    var ctx = audio.ctx;

    // make a buffer for white noise
    var sr = ctx.sampleRate;
    var samples = sr * 2.5;
    var noise_buf = ctx.createBuffer(2, samples, sr);
    for (var channel = 0; channel < 2; channel++) {
        var channelData = noise_buf.getChannelData(channel);
        for (var i = 0; i < samples; i++) {
            channelData[i] = Math.random() * 2 - 1;
        }
    }
    
    elements.Noise = function Noise(amplitude) {
        if (this.constructor !== audio.AudioModule) 
            return new elements.Noise(amplitude);
        this.source = ctx.createBufferSource();
        this.source.buffer = noise_buf;
        this.source.loop = true;
        this._startStopThese(this.source);
        
        this.gain = ctx.createGain();
        
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
    elements.Noise.prototype = new audio.AudioModule();
    
    elements.Osc = function Osc(oscType, frequency, amplitude) {
        if (this.constructor !== audio.AudioModule) 
            return new elements.Osc(oscType, frequency, amplitude);

        this.osc = ctx.createOscillator();
        this.osc.frequency.value = frequency;
        this.osc.type = oscType;

        this.gain = ctx.createGain();
        this.gain.gain.value = amplitude;

        this.osc.connect(this.gain);
        this._link_alias_out = this.gain;

        this._startStopThese(this.osc);
        this._makeSetValue(this.osc, 'frequency', 'setFrequency');
    };
    elements.Osc.prototype = new audio.AudioModule();
   
    elements.Bandpass = function Bandpass(frequency, Q) {
        // construct sans new
        if (this.constructor !== audio.AudioModule) 
            return new elements.Bandpass(frequency, Q);
        
        // bp filter
        this.biquad = ctx.createBiquadFilter();
        this.biquad.type = "bandpass";
        this.biquad.frequency.value = frequency;
        this.biquad.Q.value = Q;
        var biquad = this.biquad;
                   
        // gain node
        this.gain = ctx.createGain();
        this.gain.gain.value = 1;
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
        this._makeSetValue(this.biquad, 'frequency', 'setFrequency');
        
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
                return pos ? freqTarget(freq, 8, 10) : freqTarget(freq, 1, 10);
            };
            return gen;
        }({}))
        
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
                // TODO: figure out what that's about and try again, because this is bullshit
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
                    envelope.to({amplitude: 0}, time).start()
                }
            }
        };
    };
    elements.Bandpass.prototype = new audio.AudioModule();      

    elements.SpritePlayer = function SpritePlayer(mp3Path, TextGridIntervals) {
        if (this.constructor !== audio.AudioModule) 
            return new elements.SpritePlayer(mp3Path, TextGridIntervals);
        
        var parent = this;
              
        var media = document.createElement('audio');
       
        var req = new XMLHttpRequest();
        req.responseType = "blob";
        req.onload = function() {
            var reader = new FileReader;
            reader.readAsDataURL(req.response);
            reader.onloadend = function() {
                media.src = reader.result;
            };
        };
        req.open("GET", mp3Path, true);
        req.send();

        var def_gain = 0.2;

        //AudioNodes 
        this.mediaSource = audio.ctx.createMediaElementSource(media);
        this.gain = audio.ctx.createGain();
        this.gain.gain.value = def_gain;    

        this.mediaSource.connect(this.gain);
        
        // parse TextGridIntervals and shove into object
        var sprites = {}; 
        function SpriteInterval(start, end) {
            this.start = start;
            this.end = end;
        }
        var arr = TextGridIntervals.match(/((\d|\.)+\s)/g);
        for (var i = 0; i < arr.length / 2; i++) {
            sprites[i] = new SpriteInterval(Number(arr[i * 2]), Number(arr[i * 2 + 1]));    
        } 
        util.objectLength.call(sprites); 
        
        var playing = false;
        this.playRandomSprite = function() {
            if (!playing) {        
                var sprite = sprites[(Math.random() * sprites.length) | 0],
                    dur = sprite.end - sprite.start;
                media.currentTime = sprite.start;
                this.gain.gain.value = 0;
                this.gain.gain.setValueAtTime(def_gain, audio.ctx.currentTime + 0.01);
                media.play();    
                playing = true;
                window.setTimeout(function() {
                    parent.gain.gain.setValueAtTime(0, audio.ctx.currentTime + 0.01);
                    media.pause(); 
                    playing = false;
                }, dur * 1000);
            }
        };
        
        this._link_alias_in = this.mediaSource;
        this._link_alias_out = this.gain;
    };
    elements.SpritePlayer.prototype = new audio.AudioModule();

    elements.SchroederReverb = function() {
        if (this.constructor !== audio.AudioModule) 
            return new elements.SchroederReverb();

        function AllPass(delay) {
            var nop = audio.ctx.createGain();
            this.delay = audio.ctx.createDelay(delay);
            this.delay.delayTime.value = delay * audio.ctx.sampleRate;
            this.feedforwardGain = audio.ctx.createGain();
            this.feedforwardGain.gain.value = 0.7;
            var nopOut = audio.ctx.createGain();

            nop.connect(this.delay);
            this.delay.connect(this.feedforwardGain);
            nop.connect(nopOut);
            this.feedforwardGain.connect(nopOut);

            this._link_alias_in = nop;
            this._link_alias_out = nopOut;
        }
        AllPass.prototype = new audio.AudioModule();

        function FeedbackCombFilter(delay, feedback) {
            var nop = audio.ctx.createGain();
            this.delay = audio.ctx.createDelay(delay);
            this.delay.delayTime.value = delay * audio.ctx.sampleRate;
            this.feedbackGain = audio.ctx.createGain();
            this.feedbackGain.gain.value = feedback;
            var nopOut = audio.ctx.createGain();
            
            nop.connect(this.delay);
            this.delay.connect(this.feedbackGain);
            this.feedbackGain.connect(nop);
            nop.connect(nopOut);

            this._link_alias_in = nop;
            this._link_alias_out = nopOut;
        };
        FeedbackCombFilter.prototype = new audio.AudioModule();
       
        var base_time = 0.01,
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

        var dry = audio.ctx.createChannelSplitter(2);    
        
        var all1 = new AllPass(base_time),
            all2 = new AllPass(base_time / series_B_div),
            all3 = new AllPass(base_time / series_C_div);

        var split = audio.ctx.createChannelSplitter(4);

        var comb1 = new FeedbackCombFilter(base_time * par_A_mult, par_A_gain),
            comb2 = new FeedbackCombFilter(base_time * par_B_mult, par_B_gain),
            comb3 = new FeedbackCombFilter(base_time * par_C_mult, par_C_gain),
            comb4 = new FeedbackCombFilter(base_time * par_D_mult, par_D_gain);

        var mergeL = audio.ctx.createChannelMerger(2),
            mergeR = audio.ctx.createChannelMerger(2);

        this.wetGain = audio.ctx.createGain(),
        this.dryGain = audio.ctx.createGain();

        this.outGain = audio.ctx.createGain();

        /*
         * connections
         */
        dry.connect(all1._link_alias_in, 0);

        all1.link(all2);
        all2.link(all3);
        
        all3._link_alias_out.connect(split);

        split.connect(comb1._link_alias_in, 0);
        split.connect(comb2._link_alias_in, 0);
        split.connect(comb3._link_alias_in, 0);
        split.connect(comb4._link_alias_in, 0);

        comb1._link_alias_out.connect(mergeL, 0, 0);
        comb2._link_alias_out.connect(mergeR, 0, 0);
        comb3._link_alias_out.connect(mergeL, 0, 1);
        comb4._link_alias_out.connect(mergeR, 0, 1);
            
        mergeL.connect(this.wetGain);
        mergeR.connect(this.wetGain);

        dry.connect(this.dryGain, 1);

        this.wetGain.connect(this.outGain);
        this.dryGain.connect(this.outGain);

        /*
         * aliases
         */
        this._link_alias_in = dry;
        this._link_alias_out = this.outGain;

        /*
         * cool stuff to do!
         */

        // it's really easy to break audio playback with this
        this.setFeedbackCoeffMultiplier = function(n, time) {
            var t = time ? 0 : time;
            comb1.feedbackGain.gain
                .linearRampToValueAtTime(par_A_gain * n, audio.ctx.currentTime + t);
            comb2.feedbackGain.gain
                .linearRampToValueAtTime(par_B_gain * n, audio.ctx.currentTime + t);
            comb3.feedbackGain.gain
                .linearRampToValueAtTime(par_C_gain * n, audio.ctx.currentTime + t);
            comb4.feedbackGain.gain
                .linearRampToValueAtTime(par_D_gain * n, audio.ctx.currentTime + t);
        };
    };
    elements.SchroederReverb.prototype = new audio.AudioModule;

return elements; });
