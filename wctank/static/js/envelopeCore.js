define(
{
    Envelope: function() {
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
    },
    
    // value = arbitrary param value
    // time = percentage
    EnvelopeValue: function(value, time) {
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

        this.value = value;
        this.time = time;
    },

    bake: function(envelope, modEnv, modDurPercent) {
      
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
       
        values = envelope.valueSequence.slice(0);

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
    },

    concat: function() {
        var AbsoluteEnvelopeValue = function(value, time, 
                                             interpolationType, interpolationArgs) {
            Object.defineProperty(this, 'time', {
                writable: true
            });
            
            this.value = value;
            this.time = time;
            this.interpolationType = interpolationType;
            this.interpolationArgs = interpolationArgs;
        };
        AbsoluteEnvelopeValue.prototype = new envelopeCore.EnvelopeValue();

        var absoluteEnvelope = new envelopeCore.Envelope();
        delete absoluteEnvelope.interpolationType;
        delete absoluteEnvelope.interpolationArgs;
            
        var duration_sum = 0;
        for (var i = 0; i < arguments.length; i++) {
            duration_sum += arguments[i].duration; 
        }
        absoluteEnvelope.duration = duration_sum;

        var last_durations = 0;
        for (var j = 0; j < arguments.length; j++) {
            arguments[j].valueSequence.forEach(function(item) {
                var part = arguments[j].duration / duration_sum,
                    t = part * item.time + last_durations,
                    ev = new AbsoluteEnvelopeValue(item.value, t,
                                arguments[j].interpolationType,
                                arguments[j].interpolationArgs);

                absoluteEnvelope.valueSequence.push(ev);
                last_durations += arguments[j].duration;
            });
        }

        return absoluteEnvelope;
    }

});
