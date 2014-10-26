wctank = wctank || {};

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
        var animateTweens = function() {
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
        A.Noise.prototype = new AudioModule();

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

            var vibing = false;
            this.vibrato = function() {
                if (!vibing) {        
                    var freq = biquad.frequency.value;
                    var Q = biquad.Q.value;
                    var biquad_params = { freq: freq, Q: Q };
                    var soundVal = function(prop, base, range) {
                        var diff = (Math.random() < 0.5) ? base * -1 : base;
                        return prop + util.smudgeNumber(diff, range);
                    };
                    var genFreq = function(peak) {
                        return peak ? soundVal(freq, 8, 10) : soundVal(freq, 1, 10);
                    };
                    var updateFreq = function() {
                        biquad.frequency.value = biquad_params.freq;
                    };
                    var genQ = function(peak) {
                        return peak ? Q + util.smudgeNumber(40, 20) : Q;
                    };
                    var updateQ = function() {
                        biquad.Q.value = biquad_params.Q;
                    };
                    var vib_time = util.smudgeNumber(100, 10);
                    var repeats = util.smudgeNumber(8, 50) | 0;
                    var recovery_time = util.smudgeNumber(500, 20);
                    var Q_trans_time = vib_time * repeats + recovery_time * 0.5;
                    var startQ = new TWEEN.Tween(biquad_params)
                                .to({Q: genQ(true)}, Q_trans_time)
                                .onUpdate(updateQ);
                    var endQ = new TWEEN.Tween(biquad_params)
                                .to({Q: genQ(false)}, Q_trans_time)
                                .onUpdate(updateQ); 
                    var vibA = new TWEEN.Tween(biquad_params)
                                .to({freq: genFreq(true)}, vib_time )
                                .repeat(util.smudgeNumber(8, 50) | 0)
                                .yoyo(true)
                                .onStart(function() {
                                    startQ.start();
                                })
                                .onUpdate(updateFreq);
                    vibA.easing(TWEEN.Easing.Bounce.InOut);
                    var vibB = new TWEEN.Tween(biquad_params)
                                .to({freq: genFreq(false)}, recovery_time )
                                .onUpdate(updateFreq)
                                .onStart(function() {
                                    endQ.start();
                                })
                                .onComplete(function() {
                                    vibing = false;
                                    stopTweens();
                                }); 
                    vibB.easing(TWEEN.Easing.Bounce.InOut);
                    vibA.chain(vibB);
                    vibing = true;
                    vibA.start();
                    animateTweens();
                }
            };
        };
        A.BandPass.prototype = new AudioModule();      

        return A;
    }({})) 
    
    var noise = A.Noise();
    console.log(noise);
    var bp = A.BandPass(440, 80); 
    console.log(bp);
    var low = A.BandPass(420, 80);
    noise.link(bp);
    noise.link(low);
    noise.start();
    bp.link(A.out);
    low.link(A.out);
    var vibEve = function() {
        bp.vibrato();
        low.vibrato();
    };
    wctank.gMap.events.push(wctank.gMap.events.MAP, 'drag', vibEve);
    audio.start = function() {
        noise.start();
    };

    
    return audio;
}({}))
