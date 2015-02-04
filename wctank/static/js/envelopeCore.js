define(
    [
        'util',
        'audioCore',
        'audioUtil',
        'tween',
        'featureDetectionMain'
    ],

function(util, audioCore, audioUtil, TWEEN, featureDetectionMain) { var envelopeCore = {};

    // value = arbitrary param value
    // time = percentage
    envelopeCore.EnvelopeValue = function(value, time) {
        var throwEnvelopeValueException = function(text) {
            throw new Error("Invalid EnvelopeValue param: " + text);
        };

        var v, t;
        Object.defineProperty(this, 'value', {
            get: function() { return v; },
            set: function(val) {
                if (typeof val !== 'undefined') {
                    v = val;
                } else {
                    throwEnvelopeValueException("EnvelopeValue.value is undefined");
                }
            }
        });
        
        Object.defineProperty(this, 'time', {
            get: function() { return t; },
            set: function(val) {
                if ( (val >= 0) && (val <= 100) ) {
                    t = val;
                } else {
                    throwEnvelopeValueException("EnvelopeValue.time must be a percentage "+
                                                "between 0 and 100 inclusive");
                }
            }
        });

        if (typeof value !== 'undefined') this.value = value;
        if (typeof time !== 'undefined') this.time = time;
    };

    envelopeCore.Envelope = function() {
        var duration, interpolationType, interpolationArgs,
            valueSequence = [];       
        
        var throwEnvelopeException = function(text) {
            throw new Error("Envelope param error: " + text);
        };
        var checkEnvelopeValue = function(val) {
            if ( !(val instanceof envelopeCore.EnvelopeValue) ) {
                throwEnvelopeException("item in valueSequence must be an instance of "+
                                       "envelopeCore.EnvelopeValue, not "+val);
  
            }
            if (val.time < 0 || val.time > 100) {
                throwEnvelopeException("valueSequenceItem.time must be "+
                                       "a percentage between 0 and 100 inclusive, not "+
                                       val.time);

            }
        };

        Object.defineProperty(this, 'valueSequence', {
            enumerable: true,
            configurable: true,
            get: function() { return valueSequence; },
            set: function(val, override, tests) { //...and other checks
                if (arguments.length > 2) {
                    var checks = [];
                    for (var i = 2; i < arguments.length; i++) {
                        checks.push(arguments[i]);
                    }
                }
                var runAddlChecks = function(item) {
                    if (checks) {
                        checks.forEach(function(test) {
                            test(item);
                        });
                    }
                };
                if (Array.isArray(val)) {
                    if ( !(val[0] instanceof envelopeCore.EnvelopeValue) ) {
                        valueSequence = envelopeCore.arrayToEnvelopeValues(val); 
                    } else {
                        var seq = [];
                        val.forEach(function(v) {
                            if (!override) checkEnvelopeValue(v);
                            runAddlChecks(v);                            
                            seq.push(v);
                        });
                        valueSequence = seq;
                    }
                } else {
                    if (!override) checkEnvelopeValue(val);
                    runAddlChecks(val);
                    valueSequence = [val];
                }
            }
        });

        Object.defineProperty(this, 'duration', {
            enumerable: true,
            configurable: true,
            get: function() { return duration; },
            set: function(val) {
                if ( (val >= 0) || (val === null) ) {
                    duration = val;
                } else {
                    throwEnvelopeException("duration must be a number >= 0 or null not "+val);
                }
            }
        });

        Object.defineProperty(this, 'interpolationType', {
            enumerable: true,
            configurable: true,
            get: function() { return interpolationType; },
            set: function(val) {
                // interpolation may be "linear", "exponential", "none", or "stairstep"
                // in the latter case, an interpolationArgs number can be provided to 
                // define the number of steps 
                if (val === "linear" || val === "exponential" ||
                    val === "none" || val === "stairstep") {
                    interpolationType = val;
                } else {
                    throwEnvelopeException("interpolation must be 'linear', 'exponential', "+
                                               "'none', or 'stairstep', not "+val);
                }
            }
        });

        //TODO: implement step function envelopes
        Object.defineProperty(this, 'interpolationArgs', {
            enumerable: true,
            configurable: true,
            get: function() { return interpolationArgs; },
            set: function(val) {
                if (this.interpolationType === "stairstep") {
                    if (val > 0) {
                        interpolationArgs = val;
                    } else {
                        throwEnvelopeException("if using stairstep interpolation, "+
                                            "a number of steps > 0 must be provided.");
                    }
                }
            }
        });
    };
    envelopeCore.Envelope.prototype = {};
    envelopeCore.Envelope.prototype.constructor = envelopeCore.Envelope;
    
    // interleaves the values of two Envelopes together,
    // repeating the modEnv over this.duration at an interval of
    // modDurPercent * 0.01 * this.duration
    // TODO: throw error if asttempting to bake with an envelope
    // that has values that are not numbers.
    envelopeCore.Envelope.prototype.bake = function(modEnv, modDurPercent, refractMag) {
        var throwBakeException = function(text) {
            throw new Error("Invalid envelopeCore.bake args: " + text);
        };
        
        if ( !(modEnv instanceof envelopeCore.Envelope) ) {
            throwBakeException("MODENV must be an instance of envelopeCore.Envelope");
        }

        if ( !((modDurPercent > 0) && (modDurPercent <= 100)) ) {
            throwBakeException("MODDURPERCENT must be a NUMBER greater than 0 and "+
                               "less than or equal to 100, not" + modDurPercent);
        }

        if ( !((refractMag > 0) && (refractMag <= 1)) ) {
            throwBakeException("REFRACTMAG must be a NUMBER greater than 0 and "+
                               "less than or equal to 1, not" + refractMag);
        }

        var cooked = new envelopeCore.Envelope(),
            values = this.valueSequence.slice(0);

        values.sort(function(a, b) {
            return a.time - b.time;
        }); 
  
        var modValues = [],
            repeats = ((100 / modDurPercent) + 0.5) | 0, 
            last_time = 0;
        
        // create array with modEnv repeating to 100%
        for (var i = 1; i <= repeats + 1; i++) {
            modEnv.valueSequence.forEach(function(item) {
                var t = (item.time / repeats) + last_time;
                if (t <= 100) {
                    var ev = new envelopeCore.EnvelopeValue(item.value, t); 
                    modValues.push(ev);
                }
            });
            last_time += (100 / repeats) | 0;
        }

        var inter_values = [],
            last_val = {value: -999, time: -999};    

        values.reduce(function(previous, current) {
            for (var l = 0; l < modValues.length; l++) {
                if (modValues[l].time >= previous.time &&
                    modValues[l].time <= current.time &&
                    modValues[l].time !== last_val.time) { 
                    var inter = envelopeCore.interpolation.linearRefraction(
                        previous, current, modValues[l], refractMag
                    );
                    inter_values.push(inter);
                    last_val = inter;
                }
            }
            return current;
        }); 

        filtered_values = [];
        // rm original values if overlapping with time in inter_values
        values.forEach(function(val) {
            var found = false;
            for (var j = 0; j < inter_values.length; j++) {
                if (val.time === inter_values[j].time) {
                    found = true;
                    break;
                }
            }
            // TODO: the undefined check here patches over some weird behavior in 
            // envelopeAsdr.Sustain.bake() where inter_values[j] was sometimes undefined.
            // THIS IS SUPER STUPID!
            if (!found && (typeof inter_values[j] !== 'undefined')) {
                filtered_values.push(inter_values[j].time);
            }
        });

        var final_val = filtered_values.concat(inter_values); 
        final_val.sort(function(a, b) {
            return a.time - b.time;
        });

        cooked.valueSequence = final_val;
        cooked.duration = this.duration;
        cooked.interpolationType = modEnv.interpolationType;
        cooked.interpolationArgs = modEnv.interpolationArgs;
        
        return cooked;
    };

    envelopeCore.Envelope.prototype.toAbsolute = function(duration) {
        var outer = this;

        var d = duration ? duration : this.duration,
            absolute = new envelopeCore.AbsoluteEnvelope(d);

        this.valueSequence.forEach(function(item) {
            var t = absolute.duration * item.time * 0.01,
                ev = new envelopeCore.AbsoluteEnvelopeValue(
                            item.value, 
                            t,
                            outer.interpolationType,
                            outer.interpolationArgs
                );
            absolute.valueSequence.push(ev);
        });

        return absolute;
    };
   
    // TODO: Is inheriting from EnvelopeValue here worth it? 
    envelopeCore.AbsoluteEnvelopeValue = function(value, time, 
                                             interpolationType, interpolationArgs) {
        Object.defineProperty(this, 'time', {
            writable: true
        });
        Object.defineProperty(this, 'value', {
            writable: true
        });
        this.value = value;
        this.time = time;
        this.interpolationType = interpolationType;
        this.interpolationArgs = interpolationArgs;
    };
    envelopeCore.AbsoluteEnvelopeValue.prototype = new envelopeCore.EnvelopeValue();

    envelopeCore.AbsoluteEnvelope = function(duration) {
        var seq = [];

        envelopeCore.Envelope.call(this);
        delete this.interpolationType; 
        delete this.interpolationArgs;
        delete this.bake;
        delete this.toAbsolute;

        Object.defineProperty(this, 'duration', {
            value: duration,
            writable: false
        });

        Object.defineProperty(this, 'valueSequence', {
            get: function() { return seq; },
            set: function(val) {
                var checkAbEnvVal = function(abval) {
                    if ( !(abval instanceof envelopeCore.AbsoluteEnvelopeValue) ) {
                        throw new TypeError("Invalid AbsoluteEnvelope param: " +
                            "valueSequence must be comprised of AbsoluteEnvelopeValue objects"); 
                    }
                };
                if (Array.isArray(val)) {
                    val.forEach(function(item) {
                        checkAbEnvVal(item);
                        seq.push(item);
                    });
                } else {
                    checkAbEnvVal(val);
                    seq.push(val);
                }
            }
        });
    };
    envelopeCore.AbsoluteEnvelope.prototype = Object.create(envelopeCore.Envelope.prototype);
    envelopeCore.AbsoluteEnvelope.prototype.constructor = envelopeCore.AbsoluteEnvelope;

    envelopeCore.interpolation = {
        linearRefraction: function(a, b, n, refractMag) {
            var dy = b.value - a.value,
                dx = b.time - a.time,
                slope = dy / dx,
                intercept = a.value;

            var inter_val = slope * (n.time - a.time) + intercept;

            var point = new envelopeCore.EnvelopeValue(inter_val, n.time); 

            point.value += n.value * refractMag;

            return point;
        }
    };

    envelopeCore.concat = function() {
        var targets = [],
            isAbsolute = false,
            isFirst = true,
            total_duration = 0;
        for (var k = 0; k < arguments.length; k++) {
            if (isFirst && (arguments[k] instanceof envelopeCore.AbsoluteEnvelope) ) {
                isAbsolute = true;
            }
            
            if ( (isAbsolute && (arguments[k] instanceof envelopeCore.AbsoluteEnvelope)) ||
                (!isAbsolute && !(arguments[k] instanceof envelopeCore.AbsoluteEnvelope)) ) {
                targets.push(arguments[k]);
            } else {
                throw new TypeError('envelopeCore.concat error: cannot concat non-absolute '+ 
                    'and absolute time envelopes together.');
            }
            total_duration += arguments[k].duration;
            isFirst = false;
        }
        
        var concatted;
        if (isAbsolute) {
            concatted = new envelopeCore.AbsoluteEnvelope(total_duration);
        } else {
            concatted = new envelopeCore.Envelope();
            concatted.duration = total_duration;
        }

        var last_duration = 0,
            envValues = [],
            scale = 0,
            last_scale = 0;
        targets.forEach(function(env) {
            if (!isAbsolute) scale = env.duration / total_duration;

            env.valueSequence.forEach(function(item) {
                if (isAbsolute) {
                    // TODO: AbsoluteEnv valueSequence is set to push on assignment,
                    // which is not a great decision.
                    concatted.valueSequence = new envelopeCore.AbsoluteEnvelopeValue(
                        item.value, item.time + last_duration,
                        item.interpolationType, item.interpolationArgs
                    );
                } else {
                    envValues.push( 
                        new envelopeCore.EnvelopeValue(
                            item.value, item.time * scale + last_scale
                        ) 
                    );
                }
            });
            last_scale += scale * 100;
            last_duration += env.duration;
        });

        if (!isAbsolute) {
            concatted.valueSequence = envValues;
            concatted.interpolationType = arguments[0].interpolationType;
            concatted.interpolationArgs = arguments[0].interpolationArgs;
        }

        return concatted;
    };

    var Cancelable = function(t, expiration) {
        var targ = t,
            expiry = expiration;

        if (targ instanceof TWEEN.Tween) {
            this.cancel = function() {
                if (targ) {
                    targ.stop();
                    targ = null; //TODO: ?
                    audioUtil.tween.stopTweens();
                    spoil();
                }
            };
        } else if (targ instanceof AudioParam) {
            this.cancel = function() {
                if (targ) {
                    targ.cancelScheduledValues(audioCore.ctx.currentTime);
                    spoil();
                }
            };
        } else if (Array.isArray(targ)) {
            this.cancel = function() {
                if (targ) {
                    targ.forEach(function(v) {
                        window.clearTimeout(v);
                    });
                    spoil();
                }
            };
        } 
        
        var fresh = 1;
        Object.defineProperty(this, 'fresh', {
            get: function() { return fresh; },
            set: function(v) { fresh = v; }
        });
        
        var spoil = function() {
            this.fresh = 0;
            this.cancel = function() {};
            targ = null;
        };

        window.setTimeout(spoil, expiry);
    };

    envelopeCore.apply = function(target, envelope, offset) {
        var r;
        
        // if the target is an AudioParam, this is all pretty easy
        var off = (typeof offset === 'number') ? offset : 10;
        
        if (target instanceof AudioParam) {
            envelope.valueSequence.forEach(function(val) {
                var t = audioCore.ctx.currentTime + util.time.msec2sec(off) + 
                    util.time.msec2sec(val.time);
                try {
                    if (val.interpolationType === 'linear') {
                        target.linearRampToValueAtTime(val.value, t);
                    } else if (val.interpolationType === 'exponential') {
                        target.exponentialRampToValueAtTime(val.value, t);
                    } else if (val.interpolationType === 'none') {
                        target.setValueAtTime(val.value, t);
                    }
                } catch (e) {
                    featureDetectionMain.audioProblemFatal();
                }
            });

            r = target;
            
        } else {
            // ARRGH! It's an arbitrary function!
            // So, we assume that updating at visual rate is a-ok,
            // and, I hope you don't expect to do any supa kewl microtiming
            // involving intervals less than 10-15 msec or so.
                    // TODO: need to initialize this properly
                    // works assuming that first value is at time 0
            var params = { value: Number(envelope.valueSequence[0].value) },
                machine = new TWEEN.Tween(params);

            machine.onUpdate(function() {
                target(params.value);
            });

            var first = true,
                prior_time = off,
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

            var addToMachineQueue = function(v) {
                var cycle = function() {
                    if (v.interpolationType === 'linear') {
                        machine.easing(TWEEN.Easing.Linear); 
                    } else if (v.interpolationType === 'exponential') {
                        machine.easing(TWEEN.Easing.Exponential);
                    }
                    machine.to({value: v.value}, v.time - prior_time);
                    machine.onUpdate(function() {
                        target(params.value);
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
                prior_time = v.time + off;
            };

            var timeout_ids = [],
                uses_interpolation = false;
           
            // need to start and stop machine when interpolation is 'none'
            // i.e., TODO: account for case where sequence switches between none 
            // and other types
            envelope.valueSequence.forEach(function(val) {
                if (val.interpolationType === 'none') {
                    var tid = window.setTimeout(function() {
                        target(val.value);
                    }, offset + val.time);
                    timeout_ids.push(tid);
                } else {
                    uses_interpolation = true;
                    addToMachineQueue(val); 
                }
            });

            if (uses_interpolation) {
                onCompleteCache.push(function() {
                    audioUtil.stopTweens();
                    machine = null;
                });
                audioUtil.tween.startTweens();
                machine.start();
                r = machine;
            } else {
                machine = null;
                r = timeout_ids;
            }
        }
        
        return new Cancelable(r, envelope.duration + off);
    };
    
    //given an array of 2 item tuplets, return an array of EnvelopeValue functions
    envelopeCore.arrayToEnvelopeValues = function(arr) {
        var r = [];
        for (var i = 0; i < arr.length; i += 2) {
            r.push(new envelopeCore.EnvelopeValue(arr[i], arr[i + 1]));
        }
        return r;
    };

return envelopeCore; });
