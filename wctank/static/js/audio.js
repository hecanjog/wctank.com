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

        var throwLinkException = function(text) {
            throw "Invalid link parameters: " + text;
        };
        var checkLink = function(isOut, address, alias) {
            var location = isOut ? 'output' : 'input';
            if ( (typeof address !== 'number') 
                    || (typeof alias[address] === 'undefined') ) { 
                throwLinkException("If AudioModule has multiple "+location+
                    " aliases, the "+location+" must be explicitly addressed.");
            }
        };

        // this is gross, but needs to be this verbose b/c of Web Audio API internals...
        this.link = function(out, output, input) {        
            if (typeof out !== 'undefined') {
                // if this is a normal audio module with an out alias
                if (this._link_alias_out) {
                    // multiple outs?
                    if ( Array.isArray(this._link_alias_out) ) {
                        // throw exception if out is not addressesd properly
                        checkLink(true, output, this._link_alias_out);
                        // recurse and link on addressed alias
                        this._link_alias_out[output].link(out, 0, input);    
                    } else if (out._link_alias_in) { 
                        // multiple inputs?
                        if ( Array.isArray(out._link_alias_in) ) {
                            checkLink(false, input, out._link_alias_in);
                            this.link(out._link_alias_in[input]);
                        } else if ( audio.hasLink(out._link_alias_in) ) {
                            // if the link alias is an AudioModule,
                            // recurse until we hit an WAAPI AudioNode to connect to
                            this.link(out._link_alias_in, output, input); 
                        } else {
                            // otherwise, out is a WAAPI audionode more or less, 
                            // so call .connect
                            this._link_alias_out.connect(out._link_alias_in, output, input);
                        }
                    } else {
                        // if no input alias is implemented, then 
                        // hopefully we've hit an audio node
                        this._link_alias_out.connect(out, output, input);
                    }
                } else {
                    // for the cases where an AudioModule has one AudioNode
                    // and we have chosen to mixin AudioModule instead of inheriting 
                    if (out._link_alias_in) {
                        this.connect(out._link_alias_in, output, input);
                    } else {
                        this.connect(out, output, input);
                    }
                }
            } else {
                throwLinkException("Input node is not defined");
            } 
            return out;
        };
    };

    audio.moduleMixins = {
        
        startStopThese: function(scope) {
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
        },

        wetDry: function(scope, dryGainNode, wetGainNode) {
            scope.wetDry = function(percent_wet, time) {
                var w = percent_wet / 100,
                d = 1 - w,
                t = audio.ctx.currentTime + (time ? time : 0);
                wetGainNode.gain.linearRampToValueAtTime(w, t);
                dryGainNode.gain.linearRampToValueAtTime(d, t);  
            }; 
        },
        
        setValue: function(scope, node, param, fnname, irregular) {
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
        }
    };

    audio.wrapNode = function(node) {
        audio.AudioModule.call(node);
        return node;
    };
    
    audio.hasLink = function(obj) {
        return obj.link ? true : false;
    };

    audio.isAudioModule = function(obj) {
        return (obj.constructor === audio.AudioModule) ? true : false;
    };


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
