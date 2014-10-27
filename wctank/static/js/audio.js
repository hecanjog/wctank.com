wctank = wctank || {};

// TODO: convolve bps with violins perhaps four convolvenodes panned archlike
// combine sines with noise driver
// try feedback!@
// add clipping distortion to bps
// sampler
// etc.
wctank.audio = (function(audio) {
    var util = wctank.util;
    var core = wctank.core;
    // certain elements will be foreground, and not executed when posts are open
    // some elements mirror visual filter changes
    // a layer tied to zoom level 
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
        
        // TWEEN management
        var startTweens = function() {
            if ( !core.render.has(TWEEN.update) ) core.render.push(TWEEN.update);
            if (!core.render.rendering) core.render.go();  
        };
        var stopTweens = function() {
            if ( (TWEEN.getAll().length === 0) ) core.render.rm(TWEEN.update);
            if ( !core.render.has() ) core.render.stop();
        };
        
        /*
         * Usually, audio modules will contain more than one AudioNode.
         * The AudioModule object provides facilities for aliasing outside connections
         * to the appropriate AudioNode through _link_alias_in and _out properties, 
         * as well as a .link function that sniffs both modules involved to 
         * make the correct connection.
         *
         * AudioModules that only wrap one AudioNode can mixin AudioModule,
         * otherwise full prototype inheritance would be more appropriate.
         */ 
        function AudioModule() {
            this._link_alias_in = null;
            this._link_alias_out = null;
            this.start = null;

            // this is gross, but needs to be this verbose b/c of Web Audio API internals...
            this.link = function(out) {
                if (this._link_alias_out) {
                    if (out._link_alias_in) {
                        this._link_alias_out.connect(out._link_alias_in);
                    } else {
                        this._link_alias_out.connect(out);
                    }
                } else {
                    if (out._link_alias_in) {
                        this.connect(out._link_alias_in);
                    } else {
                        this.connect(out);
                    }
                }
            };
        };
         
        A.Noise = function() {
            if (this.constructor !== AudioModule) return new A.Noise();

            var source = actx.createBufferSource();
            source.buffer = noise_buf;
            source.loop = true;
            this.bufferSource = source;
            this.start = function() {
                source.start();
            }; 
            this._link_alias_in = this._link_alias_in = 
                this._link_alias_out = this._link_alias_out = source;
        };
        A.Noise.prototype = new AudioModule();

        
        A.Osc = function(freq) {
            if (this.constructor !== AudioModule) return new A.Osc(freq);

        };
        A.Osc.prototype = new AudioModule();

        A.Gain = function(gain) {
            if (this.constructor !== AudioModule) return new A.Gain(gain);
            
            var node = actx.createGain();
            node.gain.value = gain;
            node.setGain = function(gain) {
                node.gain.value = gain;
            };
        };
        A.Gain.prototype = new AudioModule();

        A.BandPass = function(freq, Q) {
            if (this.constructor !== AudioModule) return new A.BandPass(freq, Q);

            var biquad = actx.createBiquadFilter();
            biquad.type = "bandpass";
            biquad.frequency.value = freq;
            biquad.Q.value = Q;
            biquad.setFrequency = function(freq) {
                biquad.frequency.value = freq;
            };
            biquad.setQ = function(Q) {
                biquad.Q.value = Q;
            };
            this.biquad = biquad;
            
            var gain = actx.createGain();
            gain.gain.value = 1;
            biquad.connect(gain);
            this.gain = gain;
            
            this._link_alias_in = biquad;
            this._link_alias_out = gain;

            var accenting = false;
            this.accent = function() {
                if (!accenting) {        
                    var freq = biquad.frequency.value;
                    var Q = biquad.Q.value;
                    var amp = gain.gain.value;
                    var accent_params = { freq: freq, Q: Q, amp: amp };
                    var soundVal = function(prop, base, range) {
                        var diff = (Math.random() < 0.5) ? base * -1 : base;
                        return prop + util.smudgeNumber(diff, range);
                    };
                    var genFreq = function(peak) {
                        return peak ? soundVal(freq, 8, 10) : soundVal(freq, 1, 10);
                    };
                    var updateFreq = function() {
                        biquad.frequency.value = accent_params.freq;
                    };
                    var genQ = function(peak) {
                        return peak ? Q + util.smudgeNumber(70, 20) : Q;
                    };
                    var updateQ = function() {
                        biquad.Q.value = accent_params.Q;
                    };
                    var genGain = function(peak) {
                        return peak ? amp + util.smudgeNumber(1, 50) : amp;
                    };
                    var updateGain = function() {
                        gain.gain.value = accent_params.amp;
                    };
                    var accent_time = util.smudgeNumber(100, 10);
                    var repeats = util.smudgeNumber(8, 50) | 0;
                    var recovery_time = util.smudgeNumber(500, 20);
                    var total = accent_time * repeats + recovery_time;

                    var Q_trans_time = total * 0.5;
                    var gain_in_part = util.smudgeNumber(0.3, 20);
                    var gain_out_part = 1 - gain_in_part;
                    var gain_in_time = total * gain_in_part;
                    var gain_out_time = total * gain_out_part; 
                    var QIn = new TWEEN.Tween(accent_params)
                                .to({Q: genQ(true)}, Q_trans_time)
                                .onUpdate(updateQ);
                    var QOut = new TWEEN.Tween(accent_params)
                                .to({Q: genQ(false)}, Q_trans_time)
                                .onUpdate(updateQ); 
                    var gainIn = new TWEEN.Tween(accent_params)
                                .to({amp: genGain(true)}, gain_in_time)
                                .onUpdate(updateGain);
                    var gainOut = new TWEEN.Tween(accent_params)
                                .to({amp: genGain(false)}, gain_out_time)
                                .onUpdate(updateGain);
                    gainIn.chain(gainOut);
                    var freqIn = new TWEEN.Tween(accent_params)
                                .to({freq: genFreq(true)}, accent_time )
                                .repeat(util.smudgeNumber(8, 50) | 0)
                                .yoyo(true)
                                .onStart(function() {
                                    QIn.start();
                                    gainIn.start();
                                })
                                .onUpdate(updateFreq);
                    freqIn.easing(TWEEN.Easing.Bounce.InOut);
                    var freqOut = new TWEEN.Tween(accent_params)
                                .to({freq: genFreq(false)}, recovery_time )
                                .onUpdate(updateFreq)
                                .onStart(function() {
                                    QOut.start();
                                })
                                .onComplete(function() {
                                    accenting = false;
                                    stopTweens();
                                }); 
                    freqOut.easing(TWEEN.Easing.Bounce.InOut);
                    freqIn.chain(freqOut);
                    accenting = true;
                    freqIn.start();
                    startTweens();
                }
            };
            var prior_amp = 0;
            // if bool, override, else flip states
            this.fadeInOut = function(time, bool) {
                var amp = gain.gain.value;
                var on  = (gain.gain.value > 0) ? true : false;
                if (on) prior_amp = amp;
                var gain_params = {amp: amp}; 
                var updateGain = function() {
                    gain.gain.value = gain_params.amp;
                };
                var target = (function() {
                    if (typeof bool === "boolean") {
                        return bool ? prior_amp : 0;
                    } else {
                        return on ? 0 : prior_amp; 
                    }
                }())
                var env = new TWEEN.Tween(gain_params)
                        .to({amp: target}, util.smudgeNumber(time, 50))
                        .onUpdate(updateGain)
                        .onComplete(function() {
                            stopTweens();
                        });
                env.start();
                startTweens(); 
            };
        };
        A.BandPass.prototype = new AudioModule();      

        return A;
    }({}))
    var noise = A.Noise(); 
    var bank = [
        A.BandPass(500, 80),
        A.BandPass(262, 80),
        A.BandPass(327.5, 80),
        A.BandPass(393.0, 80)
    ]; 
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
            bank[i].fadeInOut(1000);
        }
    };
    wctank.gMap.events.push(wctank.gMap.events.MAP, 'zoom_changed', turnOff); 
    wctank.gMap.events.push(wctank.gMap.events.MAP, 'drag', vibEve);
    audio.start = function() {
        noise.start();
    };

    
    return audio;
}({}))
