define(
    [
        'envelopeCore',
        'audio',
        'audioUtil',
        'tween'
    ],

function(envelopeCore, audio, audioUtil, TWEEN) { var instrument = {};

    // action and instrument are husks that receive duration, starttime, and an arbitrary number of 
    // params
        // start, duration, value
    instrument.ParameterizedAction = function(envelope) {
        var parent = this;
        
        var throwActionException = function(text) {
            throw "Invalid instrument.Action param: " + text;  
        };

        var target, envelope;
        Object.defineProperty(this, 'target', {
           get: function() { return target; },
           set: function(val) {
                if ( (val instanceof AudioParam) || (typeof val === 'function') ) {
                    target = val;
                } else {
                    throwActionException("Action.target must be an AudioParam or "+
                                        "a function.");
                }
           }
        });
        
        Object.defineProperty(this, 'envelope', {
            get: function() { return envelope; },
            set: function(val) {
                if (val instanceof envelopeCore.AbsoluteEnvelope) {
                    envelope = val;
                } else {
                    throwActionException("Action.envelope must be an instance of "+
                                         "envelopeCore.AbsoluteEnvelope.");
                }
            }
        });

        this.execute = function(offset) {
            // if the target is an AudioParam, this is all pretty easy
            if (this.target instanceof AudioParam) {
                this.envelope.valueSequence.forEach(function(val) {
                    if (val.interpolationType === 'linear') {
                        parent.target.linearRampToValueAtTime(val.value, 
                            audio.ctx.currentTime + offset + val.time);
                    } else if (val.interpolationType === 'exponential') {
                        parent.target.exponentialRampToValueAtTime(val.value, 
                            audio.ctx.currentTime + offset + val.time);
                    } else if (val.interpolationType === 'none') {
                        parent.target.setValueAtTime(val.value,
                            audio.ctx.currentTime + offset + val.time);
                    }
                });
            } else {
                // ARRGH! It's an arbitrary function!
                // So, we assume that updating at visual rate is a-ok,
                // and, I hope you don't expect to do any supa kewl microtiming
                // involving intervals less than 10-15 msec or so.
                        // need to initialize this properly
                        // works assuming that first value is at time 0
                var params = { value: this.envelope.valueSequence[0].value },
                    machine = new TWEEN.Tween(params);

                machine.onUpdate(function() {
                    parent.target(params.value);
                });

                var first = true,
                    prior_time = 0,
                    onCompleteCache = [],
                    c = 0;
                
                var queryCompleteCache = function() {
                    if (onCompleteCache[c]) {
                        return onCompleteCache[c];
                    } else {
                        return false;
                    }
                    c++;
                };

                var addToMachineQueue = function(val) {
                    var v = val;
                    var cycle = function() {
                        if (v.interpolationType === 'linear') {
                            machine.easing(TWEEN.Easing.Linear); 
                        } else if (v.interpolationType === 'exponential') {
                            machine.easing(TWEEN.Easing.Exponential);
                        }
                        machine.to({value: v.value}, v.time - prior_time);
                        machine.onUpdate(function() {
                            parent.target(params.value);
                        });
                        var fn = queryCompleteCache();
                        if (fn) machine.onComplete(fn);
                        machine.start();
                    };
                    if (first) {
                        cycle(); 
                    } else {
                        onCompleteCache.push(cycle);
                    }
                    prior_time = v.time;
                };

                this.envelope.valueSequence.forEach(function(val) {
                    if (val.interpolationType === 'none') {
                        window.setTimeout( parent.target(val.value), 
                                           offset + val.time );
                    } else {
                        addToMachineQueue(val); 
                    }
                });
                
                onCompleteCache.push(function() {
                    audioUtil.stopTweens();
                });

                audioUtil.tween.startTweens();
                machine.start();
            }
        };
    };

    instrument.Instrument = function() {
        this.play;
    };

return instrument; });
