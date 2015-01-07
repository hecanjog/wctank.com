// add clipping distortion to bps
// sampler
// etc.

define(
    [
        'audioUtil',
        'tween'
    ],

function(audioUtil, TWEEN) { var audioCore = {};
    
    audioCore.ctx = new ( window.AudioContext || window.webkitAudioContext )();
    
    //alias out for suga
    audioCore.out = audioCore.ctx.destination;
    
    /*
     * audioCore.AudioModule is the base class for all sound making components
     * and includes facilities to create common behaviors and connect objects
     * that inherit AudioModule or use it as a mixin together
     */
    audioCore.AudioModule = function AudioModule() {
        var parent = this;     

        // AudioModules inheriting AudioModule as a prototype 
        // MUST override these properties
        this._link_alias_in = null;
        this._link_alias_out = null;

        // this is gross, but needs to be this verbose b/c of Web Audio API internals...
        // TODO: seriously, stop monkey patching!!!.
        this.link = function(in_pt, output, input) {        
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

            if (typeof in_pt !== 'undefined') {
               // link alias on both sides, then connect or link on both sides 
                var out_node = this._link_alias_out ? this._link_alias_out : this,
                    in_node = in_pt._link_alias_in ? in_pt._link_alias_in : in_pt;

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

                // recurse until we hit bedrock on both sides
                if (!in_node.connect) {
                    out_node.link(in_node._link_alias_in, out_addr, in_addr);
                } else if (!out_node.connect) {
                    out_node._link_alias_out.link(in_node, out_addr, in_addr);
                } else {
                    out_node.connect(in_node, out_addr, in_addr);
                }

                return in_pt;
            
            } else {
                throwLinkException("Input node is not defined");
            }
        };
    };

    audioCore.moduleExtensions = {

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
                t = audioCore.ctx.currentTime + (time ? time : 0);
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

    audioCore.wrapNode = function(node) {
        audioCore.AudioModule.call(node);
        return node;
    };
    
    audioCore.hasLink = function(obj) {
        return obj.link ? true : false;
    };

    audioCore.isAudioModule = function(obj) {
        return (obj.constructor === audioCore.AudioModule) ? true : false;
    };

return audioCore; });
