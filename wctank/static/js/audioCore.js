define(
    [
        'audioUtil',
        'tween'
    ],

function(audioUtil, TWEEN) { 
    
    /**
     * The audioCore module contains components essential to all sound making objects. 
     * @exports audioCore
     * @requires audioUtil
     * @requires tween
     */
    var audioCore = {};
    
    /** The active audioContext */ 
    audioCore.ctx = new ( window.AudioContext || window.webkitAudioContext )();
    
    /** An alias to AudioContext.destination, mostly for syntactic sugar. */
    audioCore.out = audioCore.ctx.destination;
    
    /**
     * audioCore.AudioModule is the base prototype for all sound making components,
     * and includes facilities to connect any objects that inherit from it together. 
     * @constructor
     */
    audioCore.AudioModule = function() {
        var parent = this;     
        
        /** 
         * An AudioModule that is not also a Web Audio API AudioNode and does not
         * inherit from AudioModule as a mixin should override _link_alias_in with
         * a reference to the first AudioModule or AudioNode in its signal chain
         * if processing an input signal.
         *
         * An array of AudioModules and/or AudioNodes can be supplied instead if
         * multiple inputs are required.
         * @type {AudioModule|AudioNode|Array} 
         */     
        this._link_alias_in;
        
        /** 
         * An AudioModule that is not also a Web Audio API AudioNode and does not
         * inherit from AudioModule as a mixin should override _link_alias_out with
         * a reference to the last AudioModule or AudioNode in its signal chain.
         *
         * An array of AudioModules and/or AudioNodes can be supplied instead if
         * multiple outputs are required.
         * @type {AudioModule|AudioNode|Array} 
         */ 
        this._link_alias_out;

        /**
         * .link allows any objects that inherit from AudioModule to pass signal
         * to one another.
         * @param {AudioModule|AudioNode} target - target to link to
         * @param {number} [output=0] - if multiple outputs, index of output
         * @param {number} [input=0] - if multiple inputs on target, index of target
         * @returns {AudioModule|AudioNode} target
         */
        this.link = function(target, output, input) {        
            var throwLinkException = function(text) {
                throw new Error("Invalid link parameters: " + text);
            };
            var checkLink = function(isOut, address, alias) {
                var location = isOut ? 'output' : 'input';
                if (typeof address !== 'number') {
                    throwLinkException("If an AudioModule has multiple "+location+
                        " aliases, the "+location+" must be explicitly addressed.");
                } else if (typeof alias[address] === 'undefined') {
                    throwLinkException("undefined "+location+" alias.");
                }
            };
            
            var out_addr, in_addr;
            out_addr = output;
            in_addr = input;

            if (typeof target !== 'undefined') {
                var out_node = this._link_alias_out ? this._link_alias_out : this,
                    in_node = target._link_alias_in ? target._link_alias_in : target;

                if (Array.isArray(out_node)) {
                    checkLink(true, output, out_node);
                    out_node = out_node[output];
                    out_addr = 0;
                } 
                if (Array.isArray(in_node)) {
                    checkLink(false, input, in_node);
                    in_node = in_node[input];
                    in_addr = 0;
                }

                // recurse until we hit WAAPI bedrock on both sides
                if (!in_node.connect) {
                    out_node.link(in_node._link_alias_in, out_addr, in_addr);
                } else if (!out_node.connect) {
                    out_node._link_alias_out.link(in_node, out_addr, in_addr);
                } else {
                    out_node.connect(in_node, out_addr, in_addr);
                }

                return target;
            
            } else {
                throwLinkException("Input node is not defined");
            }
        };
    };

    /** 
     * moduleExtensions contains handy extensions for AudioModules 
     * @namespace
     */
    audioCore.moduleExtensions = 
    /** @lends moduleExtensions */
    {            
        /** 
         * startStopThese extends a provided scope with .start() and .stop() 
         * methods that, in turn,  call the .start() and .stop() methods of
         * an indeterminate number of Audio components.
         * @param {AudioModule} scope - scope to extend
         * @param {...AudioModule|AudioNode} nodes - nodes on which to call .start() and .stop()
         */
        startStopThese: function(scope, nodes) {
            var n = arguments;
            scope.start = function() {
                for (var i = 1; i < n.length; i++) {
                    n[i].start();
                }
            };
            scope.stop = function() {
                for (var i = 1; i < n.length; i++) {
                    n[i].stop();
                }
            };
        },

        //TODO: generalize to crossFade with method name

        /**
         * wetDry extends a provided scope with a wetDry method that 
         * facilitates crossfades between gain audioParams.
         * @param {AudioModule} scope - scope to extend
         * @param {AudioNode} dryGainNode
         * @param {AudioNode} wetGainNode
         */
        wetDry: function(scope, dryGainNode, wetGainNode) {
            /**
             * wetDry crossfades between gain AudioParams as constructed
             * with audioCore.moduleExtensions.wetDry
             * @param {number} percent_wet - number between 0 and 100
             * @param {number} [time=0] - duration of crossfade in milliseconds
             */
            scope.wetDry = function(percent_wet, time) {
                var w = percent_wet / 100,
                d = 1 - w,
                t = audioCore.ctx.currentTime + (time ? time / 1000 : 0);
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
                                .easing( audioUtil.tween.getRandomEasingFn() )
                                .interpolation( audioUtil.tween.getRandomInterpolationFn() )
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
                                .easing( audioUtil.tween.getRandomEasingFn() )
                                .interpolation( audioUtil.tween.getRandomInterpolationFn() )
                                .start();
                        }
                    } else {
                        node[param].value = val;    
                    }            
                };
            }
        }
    };

    // mixin AudioModule
    audioCore.wrapNode = function(node) {
        audioCore.AudioModule.call(node);
        return node;
    };

return audioCore; });
