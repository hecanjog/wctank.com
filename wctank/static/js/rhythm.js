define(
    [
        'util',
        'instrument',
        'envelopeCore'
    ],

function(util, instrument, envelopeCore) { var rhythm = {};
// stop and pause methods on clock?
    // clarify Generator expression throwing names
    /*
     * Slow clock that can be used to synchronize 
     * actions between objects and / or trigger events
     */
    rhythm.Clock = function(tempo, smudgeFactor) {
        //  count param to synchro events
        //  watcher attach
        //  .sync()
        var parent = this;

        var queue = {},
            smudge, bpm,
            isOn = false,
            cycles = 0, 
            id, wasPaused, beat_start, beat_remaining;

        var throwClockParamException = function(mess) {
            throw new RangeError("Invalid Clock param: " + mess);
        };

        var checkAndSetSmudge = function(n) {
            if ( (typeof n === 'undefined') || (n < 0) ) {
                throwClockParamException("smudgeFactor must be "+
                    "a Number greater than or equal to zero, not " + n + "."); 
            } else {
                smudge = n;
            }
        };
        
        var bpm2msec = function(n) {
            return 60000 / n;
        };
        var checkAndSetBpm = function(n) {
            if ( (typeof n !== 'number') || (n <= 0) ) {
                throwClockParamException("bpm must be a Number "+
                    "greater than zero, not " + n + ".");
            } else {
                bpm = n;
            }                
        };

        if (typeof BPM !== 'undefined') checkAndSetBpm(BPM);
        if (typeof smudgeFactor !== 'undefined') checkAndSetSmudge(smudgeFactor);

        var machine = function() {
            var loop = function() {
                var msec = bpm2msec(bpm),
                    time = (smudge > 0) ? util.smudgeNumber(msec, smudge) : msec;
                id = window.setTimeout(function() {
                    beat_start = (performance.now() + 0.5) | 0;
                    for (var fn in queue) {
                        if (queue.hasOwnProperty(fn)) queue[fn]();
                    }
                    cycles++;
                    loop();
                }, time);
            };
            loop();    
        };

        this.dbg = function() {
            return queue;
        }

        Object.defineProperty(this, 'cycleCount', {
            get: function() { return cycles; },
        });

        Object.defineProperty(this, 'isEngaged', {
            get: function() { return isOn; }
        });

        Object.defineProperty(this, 'bpm', {
            get: function() { return bpm; },
            set: function(val) { 
                checkAndSetBpm(val);
            }
        });
        if (tempo) this.bpm = tempo;

        Object.defineProperty(this, 'smudgeFactor', {
            get: function() { return smudge; },
            set: function(val) { checkAndSetSmudge(val); }
        });

        this.push = function(fn) {
            var hash = util.hashCode((Math.random() * 100000).toString());
            queue[hash] = fn;
            return hash;
        };
        this.rm = function(hash) {
            delete queue[hash];
        };

        this.start = function(n) {
            if (isOn) {
                this.stop();
                isOn = false;
                this.start(n);
            } else {
                isOn = true;
                if ( (typeof n === 'undefined') && (typeof bpm === 'undefined') ) {
                    throw new Error("rhythm.Clock.Start can only be called without a bpm "+
                        "param if a bpm was previously defined through assignment or "+
                        "a prior start call.");
                } else if (typeof n !== 'undefined') {
                    checkAndSetBpm(n);
                }
                if (wasPaused) {
                    window.setTimeout(function() {
                        machine();
                    }, beat_remaining);
                    wasPaused = false;
                } else {
                    machine();
                }
            }
        };
        this.stop = function() {
            isOn = false;
            clearTimeout(id);
        };
        this.pause = function() {
            this.stop();
            wasPaused = true;
            var paused_at = (performance.now() + 0.5) | 0;
            beat_remaining = paused_at - beat_start;
        };
    };

    // given a ref to a rhythm.Clock, and a group of parameterized actions,
    // step or exceute each action according to a rhythm rep
    rhythm.Generator = function(clock, config) {
        var clk, targ, rseq;
        
        var rhythmGeneratorError = function(mess) {
            return 'Invalid rhythm.Generator param: '+mess;
        };

        var validateConfig = function(v) {
            if ( !('targets' in v) ) {
                throw new Error(rhythmGeneratorError("config object must specify a "+
                    "'targets' property"));
            }
            if ( !('seq' in v) ) {
                throw new Error(rhythmGeneratorError("config object must specify a "+
                    "'seq' property"));
            }
            return v;
        };
// can be an audio param, a parameterized action, or a function
        var validateTargets = function(t) {
            for (var targ in t) {
                if (t.hasOwnProperty(targ)) {
                    if ( !(t[targ] instanceof instrument.ParameterizedAction) ) {
                        throw new TypeError(rhythmGeneratorError("All targets must be "+
                            "instances of instrument.ParameterizedAction."));
                    } 
                }
            }
            return t;
        };
        
        var throwRhythmRangeError = function(mess) {
            throw new RangeError(rhythmGeneratorError(mess));
        };
        var throwRhythmPropError = function(name) {
            throw new Error(rhythmGeneratorError("All rhythmic breakpoints must "+
                "specify a '"+name+"' property."));
        };
        var validateCallbackType = function(f) {
            if (typeof f !== 'function') {
                throw new TypeError(rhythmGeneratorError('callback must be a function'));
            }
            return f;
        };

        var validateRhythmicSequence = function(s) {
            for (var prop in s) {
                if (s.hasOwnProperty(prop)) {
                    if ( !('subd' in s[prop]) ) {
                        throwRhythmPropError('subd');
                    } else if (s[prop].subd < 0) {
                        throwRhythmRangeError("{rhythm}."+prop+".subd must be greater than 0");
                    }
                    if (prop !== 'off') {
                        if ( !('val' in s[prop]) ) {
                            throwRhythmPropError('val');
                        }
                    }
                    if ('call' in s[prop]) {
                        if (Array.isArray(s[prop].call)) {
                            s[prop].call.forEach(function(v) {
                                validateCallbackType(v);
                            });
                        } else {
                            validateCallbackType(s[prop].call);
                        }
                    }
                }
            }
            return s;
        };

        Object.defineProperty(this, 'targets', {
            get: function() { return targ; },
            set: function(v) {
                targ = validateTargets(v);
            }        
        });

        Object.defineProperty(this, 'rhythmicSequence', {
            get: function() { return rseq; },
            set: function(v) {
                rseq = validateRhythmicSequence(v);
            }
        });
        
        Object.defineProperty(this, 'clock', {
            get: function() { return clk; },
            set: function(v) {
                if (v instanceof rhythm.Clock) {
                    clk = v; 
                } else {
                    throw new TypeError(rhythmGeneratorError('rhythm.Generator.clock '+
                        'must be an instance of rhythm.Clock'));
                }
            }
        });
        this.clock = clock;

        Object.defineProperties(this, {
            "loop": {
                value: false,
                writable: true,
                configurable: false
            },
            "retrograde": {
                value: false,
                writable: true,
                configurable: false
            }
        });

        if (config) {
            var c = validateConfig(config);
            this.targets = c.targets;
            this.rhythmicSequence = c.seq;
            if ('opt' in c) {
                this.loop = c.opt.loop;
                this.retrograde = c.opt.retrograde;
            }
        }

        var clock_fns = [],
            cancelables = [];
            
        /*
         *  Cancelables have an expiry date, so the Cancelables 
         *  array occasionally needs to be purged
         */
        var purgeCancelables = function() {
            cancelables.forEach(function(v, idx) {
                if (!v.fresh) cancelables.splice(idx, 1);
            });
        };
        window.setTimeout(function() {
            purgeCancelables();
        }, 1000);

        this.execute = function() {
            var subd2time = function(subd) {
                return (60 / clk.bpm) * 1000 * subd;
            };

            var q = {},
                prior_time = 0,
                i = 0;

            for (var step in rseq) {
                if (rseq.hasOwnProperty(step)) {
                    if (step === 'off') {
                        prior_time = subd2time(rseq[step].subd);
                    } else {
                        (function() {
                            var time = prior_time,
                                values = {};

                            if (rseq[step].val) {
                                var stepValues = rseq[step].val;
                                for (var t in stepValues) {
                                    if (stepValues.hasOwnProperty(t)) {
                                        var ce = targ[t].createEnvelope;
                                        values[t] = ce ? ce(stepValues(t)) : ce;
                                    }
                                }
                            } else {
                                values = null; 
                            }
                            q[i++] = {time: time, values: values};
                            prior_time = time + subd2time(rseq[step].subd); 
                        }());
                    }
                }
            }

            var clk_q_id = clk.push(function() {
                for (var s in q) {
                    if (q.hasOwnProperty(s)) {
                        for (var t in q[s].values) {
                            if (q[s].values.hasOwnProperty(t)) {
                                cancelables.push(
                                    envelopeCore.apply(
                                        targ[t].target, 
                                        q[s].values[t] ? q[s].values[t] : targ[t].envelope,
                                        q[s].time
                                    )
                                );
                            }
                        }
                    }
                }
            });
            
            clock_fns.push(clk_q_id);

                    // loop? this.execute() -- calc total length and 
                    // schedule this.execute against next beat and 
                    // add to offset
        }; 

        this.shirk = function() {
            clock_fns.forEach(function(v) {
                clk.rm(v);
            });
            purgeCancelables();
            cancelables.forEach(function(v, idx) {
                v.cancel();
            });
            // cancel scheduled events if audio param, flag loop off
            // cancel timeouts if anon 
        }; 

        this.dbg = function() {
            console.log(cancelables);
            console.log(clock_fns);
        }
        // helper to scale rhythm at new bpm
    };

return rhythm; });
