// TODO: convolve bps with violins perhaps four convolvenodes panned archlike
// combine sines with noise driver
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
        'util',
        'core', 
        'tween'
    ],

function(util, core, TWEEN) { var audio = {};
    
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

    // TWEEN utils
    audio.tweenUtil = (function(tweenUtil) {
        tweenUtil.startTweens = function() {
            if ( !core.render.has(TWEEN.update) ) core.render.push(TWEEN.update);
            if (!core.render.rendering) core.render.go();  
        };
        tweenUtil.stopTweens = function() {
            if ( (TWEEN.getAll().length === 0) ) core.render.rm(TWEEN.update);
            if ( !core.render.has() ) core.render.stop();
        };
        var easing_list = Object.keys(TWEEN.Easing); 
        tweenUtil.getRandomEasingFn = function() {
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
        tweenUtil.getRandomInterpolationFn = function() {
            return TWEEN.Interpolation[ util.getRndItem(interpolation_list) ]; 
        };
        return tweenUtil;
    }({})) 
    
    /*
     * audio.AudioModule is the base class for all sound making components
     * and includes facilities to create common behaviors and connect objects
     * that inherit AudioModule or use it as a mixin together
     */
    audio.AudioModule = function AudioModule() {
            
        //creates .start and .stop functions, if needed 
        this._startStopThese = function() {
            var nodes = arguments;
            this.start = function() {
                for (var i = 0; i < nodes.length; i++) {
                    nodes[i].start();
                }
            };
            this.stop = function() {
                for (var i = 0; i < nodes.length; i++) {
                    nodes[i].stop();
                }
            };
        };
        
        // make a glissing function/frequency setter, if needed
        this._makeSetFrequency = function(node) {
            if ( !(node.hasOwnProperty('frequency')) )
                throw 'AudioNode has no property frequency garblegarble';
            var params = {frequency: node.frequency.value};
            var gliss = new TWEEN.Tween(params);
            var updateFrequency = function() {
                node.frequency.value = params.frequency;
            };
            var glissing = false;
            
            this.setFrequency = function(freq, time) {
                if (time > 0) {
                    if (!glissing) {
                        glissing = true;
                        gliss.to({frequency: freq}, time)
                            .easing( audio.tweenUtil.getRandomEasingFn() )
                            .interpolation( audio.tweenUtil.getRandomInterpolationFn() )
                            .onUpdate(updateFrequency)
                            .onComplete(function() {
                                glissing = false;
                                tweenUtil.stopTweens();
                            })
                            .start();
                            tweenUtil.startTweens();
                    } else {
                        gliss.stop();
                        gliss.to({frequency: freq}, time)
                            .easing( audio.tweenUtil.getRandomEasingFn() )
                            .interpolation( audio.tweenUtil.getRandomInterpolationFn() )
                            .start();
                    }
                } else {
                    node.frequency.value = freq;    
                }            
            };
        };

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
return audio; });
