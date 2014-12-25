define(
    [
        'envelopeCore',
        'audio',
        'audioUtil',
        'tween',
        'util'
    ],

function(envelopeCore, audio, audioUtil, TWEEN, util) { var instrument = {};

    // action and instrument are husks that receive duration, starttime, and an arbitrary number of 
    // params
        // start, duration, value
    instrument.ParameterizedAction = function(target, envelope) {
        var parent = this;
       // read-only prop type 
        var throwActionException = function(text) {
            throw "Invalid instrument.Action param: " + text;  
        };

        var tget, env;
        Object.defineProperty(this, 'target', {
           get: function() { return tget; },
           set: function(val) {
                if ( (val instanceof AudioParam) || (typeof val === 'function') ) {
                    tget = val;
                } else {
                    throwActionException("Action.target must be an AudioParam or "+
                                        "a function.");
                }
           }
        });
        if (target) this.target = target; 

        Object.defineProperty(this, 'envelope', {
            get: function() { return env; },
            set: function(val) {
                if (val instanceof envelopeCore.AbsoluteEnvelope) {
                    env = val;
                } else {
                    throwActionException("Action.envelope must be an instance of "+
                                         "envelopeCore.AbsoluteEnvelope.");
                }
            }
        });
        if (envelope) this.envelope = envelope;

        this.execute = function(offset) {
            // if the target is an AudioParam, this is all pretty easy
            var off = (typeof offset === 'number') ? offset : 10;
            
            if (this.target instanceof AudioParam) {
                this.envelope.valueSequence.forEach(function(val) {
                    var t = audio.ctx.currentTime + util.time.msec2sec(off) + 
                        util.time.msec2sec(val.time);
                    if (val.interpolationType === 'linear') {
                        parent.target.linearRampToValueAtTime(val.value, t);
                    } else if (val.interpolationType === 'exponential') {
                        parent.target.exponentialRampToValueAtTime(val.value, t);
                    } else if (val.interpolationType === 'none') {
                        parent.target.setValueAtTime(val.value, t);
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

                // accomodate 'none'
                var addToMachineQueue = function(v) {
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
                    if (first) { // offset goes here??
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
        
        //this.step; // advance one envelope point.  esp important for rhythm.Generator
    };

    instrument.Instrument = function() {
        this.play;
        this.on;
        this.off;
    };

return instrument; });
