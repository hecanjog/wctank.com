wctank = wctank || {};

// TODO: convolve bps with violins perhaps four convolvenodes panned archlike
// combine sines with noise driver
// try feedback!@
// add clipping distortion to bps
// sampler
// etc.
// certain elements will be foreground, and not executed when posts are open
// some elements mirror visual filter changes
// a layer tied to zoom level 

wctank.audio = (function(audio) {
    var util = wctank.util;
    var core = wctank.core;
    
    // A contains primitive elements
    var A = (function(A) {
        var actx = new (window.AudioContext || window.webkitAudioContext)();  
   
        // alias destination
        A.out = actx.destination;
        
        // make a buffer for white noise
        var sr = actx.sampleRate;
        var samples = sr * 2.5;
        var noise_buf = actx.createBuffer(2, samples, sr);
        for (var channel = 0; channel < 2; channel++) {
            var channelData = noise_buf.getChannelData(channel);
            for (var i = 0; i < samples; i++) {
                channelData[i] = Math.random() * 2 - 1;
            }
        }
        
        // tween utils
        var twUtl = (function(twUtl) {
            twUtl.startTweens = function() {
                if ( !core.render.has(TWEEN.update) ) core.render.push(TWEEN.update);
                if (!core.render.rendering) core.render.go();  
            };
            twUtl.stopTweens = function() {
                if ( (TWEEN.getAll().length === 0) ) core.render.rm(TWEEN.update);
                if ( !core.render.has() ) core.render.stop();
            };
            var getRand
            var easing_list = Object.keys(TWEEN.Easing); 
            twUtl.getRandomEasingFn = function() {
                var type = TWEEN.Easing[ util.getRndItem(easing_list) ];
                var keys = Object.keys(type);
                return type[ util.getRndItem(keys) ];
            };
            var interpolation_list = (function() {
                var list = Object.keys(TWEEN.Interpolation);
                var idx = list.indexOf('Utils');
                list.splice(idx, 1);
                return list;
            }()) 
            twUtl.getRandomInterpolationFn = function() {
                return TWEEN.Interpolation[ util.getRndItem(interpolation_list) ]; 
            };
            return twUtl;
        }({})) 
        
        /*
         * AudioModule provides facilities to wrap multiple AudioNodes into single units
         * and when used as a mixin on an AudioNode, for AudioNodes to connect to AudioModules
         */ 
        A.AudioModule = function AudioModule() {
            
            // if an AudioModule needs to be turned on...
            this.start = null;
            
            this._link_alias_in = null;
            this._link_alias_out = null;

            // this is gross, but needs to be this verbose b/c of Web Audio API internals...
            this.link = function(out) {        
                    if (this._link_alias_out) {
                        if (out._link_alias_in) {
                            this._link_alias_out.connect(out._link_alias_in);
                        } else {
                            this._link_alias_out.connect(out);
                        }
                    } else {
                        // for the cases where an AudioModule has one AudioNode
                        // and we have chosen to mixin AudioModule instead of inheriting 
                        if (out._link_alias_in) {
                            this.connect(out._link_alias_in);
                        } else {
                            this.connect(out);
                        }
                    }
            };
        };
         
        A.Noise = function() {
            if (this.constructor !== A.AudioModule) return new A.Noise();
            this.source = actx.createBufferSource();
            this.source.buffer = noise_buf;
            this.source.loop = true;
            this.start = function() {
                this.source.start();
            }; 
            this._link_alias_in = this._link_alias_in = 
                this._link_alias_out = this._link_alias_out = this.source;
        };
        A.Noise.prototype = new A.AudioModule();

        
        A.Osc = function(freq) {
            if (this.constructor !== A.AudioModule) return new A.Osc(freq);

        };
        A.Osc.prototype = new A.AudioModule();
        
        // TODO: module to deal with output amplitude
        A.Gain = function(gain) {
            if (this.constructor !== A.AudioModule) return new A.Gain(gain);
            
            var node = actx.createGain();
            node.gain.value = gain;
            node.setGain = function(gain) {
                node.gain.value = gain;
            };
        };
        A.Gain.prototype = new A.AudioModule();

        A.BandPass = function(freq, Q) {
            // construct sans new
            if (this.constructor !== A.AudioModule) return new A.BandPass(freq, Q);
            
            // bp filter
            this.biquad = actx.createBiquadFilter();
            this.biquad.type = "bandpass";
            this.biquad.frequency.value = freq;
            this.biquad.Q.value = Q;
            var biquad = this.biquad;
                       
            // gain node
            this.gain = actx.createGain();
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
            var accenting = false;
            this.accent = function() {
                if (!accenting) {        
                    var freqTarget = function(prop, base, range) {
                        var diff = (Math.random() < 0.5) ? base * -1 : base;
                        return prop + util.smudgeNumber(diff, range);
                    };
                    var genFreq = function(peak) {
                        var freq = params.frequency;
                        return peak ? freqTarget(freq, 8, 10) : freqTarget(freq, 1, 10);
                    };
                    var genQ = function(peak) {
                        var Q = params.Q;
                        return peak ? Q + util.smudgeNumber(70, 20) : Q;
                    };
                    var genGain = function(peak) {
                        var amp = params.amplitude;
                        return peak ? amp + util.smudgeNumber(1, 50) : amp;
                    };
                    
                    var accent_time = util.smudgeNumber(100, 10);
                    var repeats = util.smudgeNumber(8, 50) | 0;
                    var recovery_time = util.smudgeNumber(500, 20);
                    var total = accent_time * repeats + recovery_time;

                    var Q_trans_time = total * 0.5;
                    var gain_in_portion = util.smudgeNumber(0.3, 20);
                    var gain_in_time = total * gain_in_portion;
                    var gain_out_time = total * (1 - gain_in_portion); 
                    
                    var QIn = new TWEEN.Tween(params)
                                .to({Q: genQ(true)}, Q_trans_time)
                                .onUpdate(updateQ);
                    var QOut = new TWEEN.Tween(params)
                                .to({Q: genQ(false)}, Q_trans_time)
                                .onUpdate(updateQ); 
                    
                    var gainIn = new TWEEN.Tween(params)
                                .to({amplitude: genGain(true)}, gain_in_time)
                                .onUpdate(updateGain);
                    var gainOut = new TWEEN.Tween(params)
                                .to({amplitude: genGain(false)}, gain_out_time)
                                .onUpdate(updateGain);
                    gainIn.chain(gainOut);
                    
                    var freqIn = new TWEEN.Tween(params)
                                .to({frequency: genFreq(true)}, accent_time )
                                .easing(TWEEN.Easing.Bounce.InOut)
                                .repeat(util.smudgeNumber(8, 50) | 0)
                                .yoyo(true)
                                .onStart(function() {
                                    QIn.start();
                                    gainIn.start();
                                })
                                .onUpdate(updateFrequency);
                    var freqOut = new TWEEN.Tween(params)
                                .to({frequency: genFreq(false)}, recovery_time )
                                .easing(TWEEN.Easing.Bounce.InOut)
                                .onUpdate(updateFrequency)
                                .onStart(function() {
                                    QOut.start();
                                })
                                .onComplete(function() {
                                    accenting = false;
                                    twUtl.stopTweens();
                                });
                    freqIn.chain(freqOut);
                    
                    accenting = true;
                    freqIn.start();
                    twUtl.startTweens();
                }
            };

            var envelope;
            var target_amp; 
            var prior_amp = 0;
            var fading = false;
            this.fadeInOut = function(time) {
                if (!fading) {
                    var on  = (gain.gain.value > 0) ? true : false;
                    if (on) prior_amp = gain.gain.value;
                    target_amp = on ? 0 : prior_amp;
                    envelope = new TWEEN.Tween(params)
                        .to({amplitude: target_amp}, time)
                        .onUpdate(updateGain)
                        .onStart(function() {
                            fading = true;
                        })
                        .onComplete(function() {
                            fading = false;
                            twUtl.stopTweens();
                        })
                        .start();
                        twUtl.startTweens();
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
            
            var gliss;
            var glissing = false;
            this.glissTo = function(freq, time) {
                if (!glissing) {
                    gliss = new TWEEN.Tween(params)
                        .to({frequency: freq}, time)
                        .easing( twUtl.getRandomEasingFn() )
                        .interpolation( twUtl.getRandomInterpolationFn() )
                        .onUpdate(updateFrequency)
                        .onComplete(function() {
                            glissing = false;
                            twUtl.stopTweens();
                        })
                        .start();
                        twUtl.startTweens();
                } else {
                    envelope.stop();
                    envelope.to({frequency: freq}, time)
                    .easing( twUtl.getRandomEasingFn() )
                    .interpolation( twUtl.getRandomInterpolationFn() )
                    .start();
                }            
            };
        };
        A.BandPass.prototype = new A.AudioModule();      

        return A;
    }({}))


    var noise = A.Noise(); 
    console.log(noise);
    var bank = [
        A.BandPass(262, 80),
        A.BandPass(327.5, 80),
        A.BandPass(393, 80),
        A.BandPass(500, 80),
    ];
   console.log(bank[2]); 
    for (var i = 0; i < bank.length; i++) {
        noise.link(bank[i]);
    }
    noise.start();
    for (var i = 0; i < bank.length; i++) {
        bank[i].link(A.out);
    }
    var vibEve = function() {
        for (var i = 0; i < bank.length; i++) {
            bank[i].accent();
        }
    };
    var turnOff = function() {
        for (var i = 0; i < bank.length; i++) {
            bank[i].fadeInOut(2000);//util.smudgeNumber(10000, 50));
        }
    };
    var whatever = 0;
    wctank.glissDbg = function(freq, time) {
        whatever = freq * 0.75;
        for (var i = 0; i < bank.length; i++) {
            bank[i].glissTo(whatever, time);
            whatever *= 1.10;
        }
    };
    wctank.gMap.events.push(wctank.gMap.events.MAP, 'zoom_changed', turnOff); 
    wctank.gMap.events.push(wctank.gMap.events.MAP, 'drag', vibEve);
    audio.start = function() {
        noise.start();
    };

    
    return audio;
}({}))
