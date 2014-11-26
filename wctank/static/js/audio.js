// try feedback!@
// add clipping distortion to bps
// sampler
// etc.
// certain elements will be foreground, and not executed when posts are open
// some elements mirror visual filter changes
// a layer tied to zoom level 
// rm virgo logo?

define(
    [
        'audioUtil',
        'tween'
    ],

function(audioUtil, TWEEN) { var audio = {};
    
    audio.ctx = new ( window.AudioContext || window.webkitAudioContext )();  
    
    //alias out for suga
    audio.out = audio.ctx.destination;
    
    /*
     * enum OscillatorNode types (from Web Audio API spec)
     */
    audio.oscTypes = {
        SINE: 'sine',
        SQUARE: 'square',
        SAWTOOTH: 'sawtooth',
        TRIANGLE: 'triangle',
        CUSTOM: 'custom'
    };
    
    /*
     * audio.AudioModule is the base class for all sound making components
     * and includes facilities to create common behaviors and connect objects
     * that inherit AudioModule or use it as a mixin together
     */
    audio.AudioModule = function AudioModule() {
        var parent = this;     

        // AudioModules inheriting AudioModule as a prototype 
        // MUST override these properties
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

    audio.moduleMixins = (function(moduleMixins) {
        
        moduleMixins.startStopThese = function(scope) {
            var nodes = arguments;
            scope.start = function() {
                for (var i = 1; i < nodes.length; i++) {
                    nodes[i].start();
                }
            };
            scope.stop = function() {
                for (var i = 1; i < nodes.length; i++) {
                    nodes[i].stop();
                }
            };
        };

        moduleMixins.wetDry = function(scope, dryGainNode, wetGainNode) {
            scope.wetDry = function(percent_wet, time) {
                var w = percent_wet / 100,
                d = 1 - w,
                t = audio.ctx.currentTime + (time ? time : 0);
                wetGainNode.gain.linearRampToValueAtTime(w, t);
                dryGainNode.gain.linearRampToValueAtTime(d, t);  
            }; 
        };
        
        moduleMixins.setValue = function(scope, node, param, fnname, irregular) {
            if (!irregular) {
                scope[fnname] = function(val, time) {
                    var t = time ? time : 0;
                    node[param].linearRampToValueAtTime(val, t);    
                };
            } else {
                var params = {value: node[param].value};
                var gliss = new TWEEN.Tween(params);
                var updateValue = function() {
                    node[param].value = params.value;
                };
                var glissing = false;
                
                scope[fnname] = function(val, time) {
                    if (time > 0) {
                        if (!glissing) {
                            glissing = true;
                            gliss.to({value: val}, time)
                                .easing( audio.audioUtil.tween.getRandomEasingFn() )
                                .interpolation( audio.audioUtil.tween.getRandomInterpolationFn() )
                                .onUpdate(updateValue)
                                .onComplete(function() {
                                    glissing = false;
                                    audioUtil.tween.stopTweens();
                                })
                                .start();
                                audioUtil.tween.startTweens();
                        } else {
                            gliss.stop();
                            gliss.to({value: val}, time)
                                .easing( audio.audioUtil.tween.getRandomEasingFn() )
                                .interpolation( audio.audioUtil.tween.getRandomInterpolationFn() )
                                .start();
                        }
                    } else {
                        node[param].value = freq;    
                    }            
                };
            }
        };

        return moduleMixins;
    }({}))

    /* 
     * gross clock to synchrionize macrotime actions between modules
     */
    audio.Clock = function() {
        var parent = this;

        var queue = [];
        this.push = function(fn) {
            queue.push(fn);   
        };
        this.rm = function(fn) {
            var idx = queue.indexOf(fn);
            queue.splice(idx, 1);
        };
        
        Object.defineProperty(this, 'bpm', {
            enumerable: true,
            get: function() { return b; }
        });

        var interval, b, started;
        this.start = function(bpm) {
            started = true;
            if (typeof bpm === number)
                b = bpm;
            var msec = 60000 / this.bpm;
            interval = window.setInterval(function() {
                for (var i = 0; i < queue.length; i++) {
                    queue[i]();
                }    
            }, msec);
        };
        this.stop = function() {
            started = false;
            clearInterval(interval);
        };
        this.changeTempo = function(bpm) {
            if (started) {
                var cancelReset = function() {
                    clearInterval(interval);
                    parent.start(bpm);
                };
                queue.push(cancelReset);    
            } else {
                console.warn('audio.Clock.changeTempo called without prior start()' +
                            ' - no actions performed'); 
            }
        };
    };

return audio; });
