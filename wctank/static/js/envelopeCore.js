define(

function() { var envelopeCore = {};

    // value = arbitrary param value
    // time = percentage
    envelopeCore.EnvelopeValue = function(value, time) {
        var throwEnvelopeValueException = function(text) {
            throw "Invalid EnvelopeValue param: " + text;
        };

        var v, t;
        Object.defineProperty(this, 'value', {
            get: function() { return v; },
            set: function(val) {
                if (typeof val === 'number') {
                    v = val;
                } else {
                    throwEnvelopeValueException("EnvelopeValue.value must be a number");
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


    envelopeCore.Envelope = function Envelope() {
        var duration, interpolationType, interpolationArgs;       
        
        this.valueSequence = [];
        Object.defineProperty(this, 'valueSequence', {
            writable: true
        });

        var throwEnvelopeException = function(text) {
            throw "Envelope param error: " + text;
        };

        Object.defineProperty(this, 'duration', {
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
            configurable: true,
            get: function() { return interpolationType; },
            set: function(val) {
                // interpolation may be "linear", "exponential", "none", or "stairstep"
                // in the latter case, an interpolationArgs number can be provided to 
                // define the number of steps 
                if ( (val === "linear") || (val === "exponential") ||
                    (val === "none") || (val === "stairstep") ) {
                    interpolationType = val;
                } else {
                    throwEnvelopeException("interpolation must be 'linear', 'exponential', "+
                                               "'none', or 'stairstep', not "+val);
                }
            }
        });

        Object.defineProperty(this, 'interpolationArgs', {
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

        // interleaves the values of two Envelopes together,
        // repeating the modEnv over this.duration at an interval of
        // modDurPercent * 0.01 * this.duration
        this.bake = function(modEnv, modDurPercent, refractMag) {
     
            var throwBakeException = function(text) {
                throw "Invalid envelopeCore.bake args: " + text;
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
      
            // Ideally, I would implement this so that any modifications would be
            // time invariant across a range of note durations. However, the goal here
            // is not necessarily to make a general purpose synth, but to make an
            // instrument that has its own idiosynchratic behaviors. So, as is, the 
            // modification speed will vary with the duration of the note that the
            // envelope is applied to, which is kind of neat conceptually. 
            // Also, it's slightly easier to write, so win? Maybe?
            var modValues = [],
                repeats = ((100 / modDurPercent) + 0.5) | 0, 
                last_time = 0;
            
            // create array with modEnv repeating to 100%
                // repeats + 1 jic next iter would include time = 100
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
                    // bounds not inclusive on top to avoid dups around boundaries
                    if ( (modValues[l].time >= previous.time) &&
                        (modValues[l].time <= current.time) &&
                        (modValues[l].time !== last_val.time) ) { 
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
                // asdr.Sustain.bake() where inter_values[j] was sometimes undefined.
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

        // prevent if necessary values are undefined 
        this.toAbsolute = function(duration) {
            var absolute = new envelopeCore.AbsoluteEnvelope(duration),
                scale = duration ? duration / this.duration : this.duration;
            
            this.valueSequence.forEach(function(item) {
                var t = absolute.duration * item.time * 0.01,
                    ev = new envelopeCore.AbsoluteEnvelopeValue(
                                item.value, 
                                t,
                                interpolationType,
                                interpolationArgs);
                absolute.valueSequence = ev;
            });

            return absolute;
        };

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

    //construct with duration
    envelopeCore.AbsoluteEnvelope = function AbsoluteEnvelope(duration) {
        var seq = [];

        Object.defineProperty(this, 'duration', {
            value: duration,
            writable: false
        });

        Object.defineProperty(this, 'valueSequence', {
            get: function() { return seq; },
            set: function(val) {
                var checkAbEnvVal = function(abval) {
                    if ( !(abval instanceof envelopeCore.AbsoluteEnvelopeValue) ) {
                        throw "Invalid AbsoluteEnvelope param: " +
                            "valueSequence must be comprised of AbsoluteEnvelopeValue objects"; 
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
    envelopeCore.AbsoluteEnvelope.prototype = new envelopeCore.Envelope();
    delete envelopeCore.AbsoluteEnvelope.prototype.interpolationType; 
    delete envelopeCore.AbsoluteEnvelope.prototype.interpolationArgs;
    delete envelopeCore.AbsoluteEnvelope.prototype.bake;
    delete envelopeCore.AbsoluteEnvelope.prototype.toAbsolute;

    envelopeCore.interpolation = {
        // this will have to be good enough for now until 
        // audioWorkers are fuly implemented across browsers and we can implement
        // vibrato and similar effects with an LFO or something
        linearRefraction: function(a, b, n, refractMag) {
            var dy = b.value - a.value,
                dx = b.time - a.time,
                slope = dy / dx,
                intercept = a.value;

            var inter_val = slope * (n.time - a.time) + intercept;

            var point = new envelopeCore.EnvelopeValue(inter_val, n.time); 

            // modify point.value in direction of n.value by reflectMag
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
                throw 'envelopeCore.concat error: cannot concat non-absolute '+ 
                    'and absolute time envelopes together.';
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
                    // AbsoluteEnv valueSequence is set to push on assignment
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

return envelopeCore; });
