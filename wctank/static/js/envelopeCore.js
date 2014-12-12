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

        var throwEnvelopeException = function(text) {
            throw "Envelope param error: " + text;
        };

        Object.defineProperty(this, 'duration', {
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
        
        this.bake = function(modEnv, modDurPercent) {
     
            var throwBakeException = function(text) {
                throw "Invalid envelopeCore.bake args: " + text;
            };
            var checkBakeEnv = function(name, env) {
                if ( !(env instanceof envelopeCore.Envelope) ) {
                    throwBakeException(name + "must be an instance of envelopeCore.Envelope");
                }
            };

            checkBakeEnv("MODENVELOPE", modEnv);

            if ( !((modDurPercent > 0) && (modDurPercent <= 100)) ) {
                throwBakeException("MODDURPERCENT must be a NUMBER greater than 0 and "+
                                   "less than or equal to 100, not" + modDurPercent);
            }

            var cooked = new envelopeCore.Envelope(),
                values;

            Object.defineProperty(cooked, 'valueSequence', {
                get: function() { return values; }
            });
          
            // this will have to be good enough for now until 
            // audioWorkers are fuly implemented across browsers and we can implement
            // vibrato and similar effects with an LFO or something
            var interpolate = function(a, b, n) {
                var dy = a.value - b.value,
                    dx = a.time - b.time,
                    slope = dy / dx;

                var scalar = slope * (n.time - a.time);
        
                return new envelopeCore.EnvelopeValue(n.value * scalar + a.value, n.time); 
            };
           
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
            var modValues,
                repeats = (100 / modDurPercent) | 0,
                cntr = 0;
            
            for (var i = 1; i <= repeats; i++) {
                modEnv.valueSequence.forEach(function(item) {
                    var ev = new envelopeCore.EnvelopeValue(item.value, 
                        (item.time / repeats) * i); 
                    modValues.push(ev);
                });
            }

            for (var k = 0; k < modValues.length; k++) {
                values.reduce(function(previous, current, idx) {
                    if ( (modValues[k].time >= previous) && (modValues[k].time <= current) ) {
                        values.splice(idx, 0, modValues[k]);
                    }
                    return current;
                });
            }

            cooked.duration = envelope.duration;
            cooked.interpolationType = modEnv.interpolationType;
            cooked.interpolationArgs = modEnv.interpolationArgs;

            return cooked;
        };
       // prevent if necessary values are undefined 
        this.toAbsolute = function(duration) {
            var absolute = new envelopeCore.AbsoluteEnvelope(),
                scale = duration ? duration / this.duration : this.duration;
            
            absolute.duration = this.duration * scale;

            this.valueSequence.forEach(function(item) {
                console.log(item);
                var t = absolute.duration * item.time * 0.01,
                    ev = new envelopeCore.AbsoluteEnvelopeValue(
                                item.value, 
                                t,
                                item.interpolationType,
                                item.interpolationArgs);
                absolute.valueSequence = ev;
            });

            return absolute;
        };

    };
    
    envelopeCore.AbsoluteEnvelopeValue = function(value, time, 
                                             interpolationType, interpolationArgs) {
        Object.defineProperty(this, 'time', {
            writable: true
        });
        
        this.value = value;
        this.time = time;
        this.interpolationType = interpolationType;
        this.interpolationArgs = interpolationArgs;
    };
    envelopeCore.AbsoluteEnvelopeValue.prototype = new envelopeCore.EnvelopeValue();

    envelopeCore.AbsoluteEnvelope = function AbsoluteEnvelope() {
        var seq = [];
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
        
        // this.scale

        delete this.bake; 
        delete this.toAbsolute;
        delete this.interpolationType;
        delete this.interpolationArgs;
    };
    envelopeCore.AbsoluteEnvelope.prototype = new envelopeCore.Envelope();
    
    envelopeCore.concat = function() {
        var targets = [],
            isAbsolute = false,
            isFirst = true,
            total_duration = 0;
        for (var k = 0; k < arguments.length; k++) {
            if (isFirst && (arguments[k].constructor.name === 'AbsoluteEnvelope')) {
                isAbsolute = true;
            }
            // this might not work - may have to use duck typing instead
            if ( (isAbsolute && (arguments[k].constructor.name === 'AbsoluteEnvelope')) ||
                (!isAbsolute && (arguments[k].constructor.name !== 'AbsoluteEnvelope')) ) {
                targets.push(arguments[k]);
            } else {
                throw 'envelopeCore.concat error: cannot concat non-absolute and absolute time envelopes together.';
            }
            total_duration += arguments[k].duration;
            isFirst = false;
        }
        
        var concatted;
        if (isAbsolute) {
            concatted = new envelopeCore.AbsoluteEnvelope();
        } else {
            concatted = new envelopeCore.Envelope();
        }

        concatted.duration = total_duration;

        var last_duration = 0,
            envValues = [],
            scale = 0,
            last_scale = 0;
        targets.forEach(function(env) {
            if (!isAbsolute) scale = env.duration / total_duration;

            env.valueSequence.forEach(function(item) {
                if (isAbsolute) {
                    // AbsoluteEnv valueSequence is set to push on assignment
                    concatted.valueSequence = new AbsoluteEnvelopeValue(
                        item.value, item.time * env.duration + last_duration,
                        item.interpolationType, item.interpolationArgs
                    );
                } else {
                    envValues.push( new EnvelopeValue(item.value, item.time * scale + last_scale) );
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
