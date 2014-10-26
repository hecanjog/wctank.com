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
        
        // make a white noise buffer source
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
        
        var AudioModule = function() {
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
                    if (out._link_alias_in) {
                        this.connect(out._link_alias_in);
                    } else {
                        this.connect(out);
                    }
                }
            };
        };
        
        A.Noise = function() {
            var node = actx.createBufferSource();
            node.buffer = noise_buf;
            node.loop = true;
            AudioModule.call(node);
            return node;
        };

        A.Gain = function(gain) {
            var node = actx.createGain();
            node.gain.value = gain;
            node.setGain = function(gain) {
                node.gain.value = gain;
            };
            AudioModule.call(node);
            return node;
        };
        A.BandPass = function(freq, Q) {
            var node = {};
            AudioModule.call(node);
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
            node.biquad = biquad;
            
            var gain = actx.createGain();
            gain.gain.value = 1;
            biquad.connect(gain);
            node.gain = gain;
            
            node._link_alias_in = node.biquad;
            node._link_alias_out = node.gain;

            var vibing = false;
            node.vibrato = function() {
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
            return node;
        };      
        return A;
    }({})) 
    
    var noise = A.Noise();
    var bp = A.BandPass(440, 80); 
    noise.link(bp);
    console.log(A.out);
    noise.start();
    bp.link(A.out);
    
    wctank.gMap.events.push(wctank.gMap.events.MAP, 'drag', bp.vibrato);
    audio.start = function() {
        noise.start();
    };
    
    return audio;
}({}))
