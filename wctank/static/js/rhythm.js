define(
    [
        'util',
        'instrument',
        'envelopeCore'
    ],

function(util, instrument, envelopeCore) { var rhythm = {};
  
    /*
     * gross clock. NOT ACCURATE ENOUGH FOR MICROTIMING!
     */ 
    rhythm.Clock = function(tempo, smudgeFactor) {
        //  count param to synchro events
        //  watcher attach
        //  .sync() - sync multiple Clocks
        var queue = {},
            smudge, bpm, last, next, len,
            isOn = false,
            cycles = 0, 
            id, wasPaused, beat_start, beat_remaining;

        var throwClockParamException = function(mess) {
            throw new RangeError("Invalid Clock param: " + mess);
        };
        
        var machine = function() {
            last = performance.now(); 
            next = last + len;
            
            var loop = function() {
                var msec = 60000 / bpm,
                    time = (smudge > 0) ? util.smudgeNumber(msec, smudge) : msec;

                id = window.setTimeout(function() {
                    last = next;
                    next = performance.now() + time;

                    if (smudge) len = next - last;

                    beat_start = performance.now();
                    for (var fn in queue) {
                        if (queue.hasOwnProperty(fn)) queue[fn]();
                    }
                    cycles++;
                    loop();
                }, time);
            };
            loop();    
        };

        Object.defineProperties(this, {
            'cycleCount': {
                get: function() { return cycles; }
            },
            'isEngaged': {
                get: function() { return isOn; }
            },
            'nextBeat': {
                get: function() { return next; }
            },
            'lastBeat': {
                get: function() { return last; }
            },
            'beatLength': {
                get: function() { return len; }
            },
        });
                
        Object.defineProperty(this, 'bpm', {
            get: function() { return bpm; },
            set: function(n) {
                if ( (typeof n !== 'number') || (n <= 0) ) {
                    throwClockParamException("bpm must be a Number "+
                    "greater than zero, not " + n + ".");
                } else {
                    bpm = n;
                    len = 60000 / bpm;
                }                
            }
        });
        if (tempo) this.bpm = tempo;

        Object.defineProperty(this, 'smudgeFactor', {
            get: function() { return smudge; },
            set: function(n) {
                if ( (typeof n === 'undefined') || (n < 0) ) {
                    throwClockParamException("smudgeFactor must be "+
                        "a Number greater than or equal to zero, not " + n + "."); 
                } else {
                    smudge = n;
                }
            }
        });
        if (smudgeFactor) this.smudgeFactor = smudgeFactor;

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
                    this.bpm = n;
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
    
    /*
     * invoked in .Generator when performing floating clock loops. 
     * Adds a function to each rhythm.Generator.clock queue that requeues rhythms.
     */
    var floatingLoopReinitializer = (function(reinit) {
        var rq = {},
            all_clocks = [],
            ids = [];
        
        //TODO: destroy functionality (using ids array)
        
        var comparator = function() {
            var scheduleLoop = function(rvalObj) {
                if (rvalObj.endTime < rvalObj.clock.nextBeat) {
                    var offset = rvalObj.endTime - rvalObj.clock.lastBeat;
                    rvalObj.fn(offset);

                    // undefined check b/c rvalObj may be derefrenced during execution
                    //TODO: why after an .rm does this occur on updateEndTime?
                    if (typeof rvalObj !== 'undefined') 
                        rvalObj.updateEndTime(rvalObj.clock.lastBeat + offset);
                    if (rvalObj.endTime < rvalObj.clock.nextBeat)
                        scheduleLoop(rvalObj);
                }
            };

            for (var r in rq) {
                if (rq.hasOwnProperty(r)) {
                    scheduleLoop(rq[r]);
                }
            }
        };

        var rval = function(duration, fn, clock) {
            this.duration = duration;
            this.fn = fn;
            this.clock = clock;
            this.endTime = this.clock.lastBeat + this.duration;
            this.updateEndTime = function(startTime) {
                this.endTime = startTime + this.duration;
            };
        };
        
        reinit.push = function(duration, fn, clock) {
            var found = false;
            for (var i = 0; i < all_clocks.length; i++) {
                if (all_clocks[i] === clock) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                all_clocks.push(clock);
                ids.push(clock.push(comparator));
            }

            var rhy = new rval(duration, fn, clock);
            // need to be sure that .push is only called on beat

            var id = util.hashCode((Math.random() * 100000).toString());
            rq[id] = rhy;

            return id;
        };

        reinit.rm = function(id) {
            delete rq[id];
        };

        reinit.inQueue = function(id) {
            return (id in rq); 
        };

        return reinit;
    }({}));

    // given a ref to a rhythm.Clock, and a group of parameterized actions,
    // step or exceute each action according to a rhythm rep
    rhythm.Generator = function(clock, config) {
        var clk, targ, rseq, cbks,
            loop = false, 
            was_loopin = false,
            locked = 0;

        var rhythmGeneratorError = function(mess) {
            return 'Invalid rhythm.Generator param: '+mess;
        };
                
        var throwRhythmRangeError = function(mess) {
            throw new RangeError(rhythmGeneratorError(mess));
        };
        var throwRhythmPropError = function(name) {
            throw new Error(rhythmGeneratorError("All rhythmic breakpoints must "+
                "specify a '"+name+"' property."));
        };
        var throwRhythmTypeError = function(mess) {
            throw new TypeError(rhythmGeneratorError(mess));
        };
       
        //TODO: implement retrograde playback
        Object.defineProperty(this, 'retrograde', {
            value: false,
            writable: true
        });

        Object.defineProperty(this, 'locked', {
            get: function() { return locked; },
            set: function(v) {
                // false, number >= 0
                if ( (v === false) || (v >= 0) ) {
                    locked = v;
                } else {
                     throw new Error(rhythmGeneratorError(".locked must be "+
                        "false or a NUMBER >= 0, not "+v));
                }
            }
        });

        var loop_count = 0;
        Object.defineProperty(this, 'loop', {
            get: function() { return loop; },
            set: function(v) {
                if (!v) {
                    if (loop) was_loopin = true;
                } else {
                    was_loopin = false;
                }
                loop = v;
            }
        });

        Object.defineProperty(this, 'clock', {
            get: function() { return clk; },
            set: function(v) {
                if (typeof v === 'undefined') {
                    throwRhythmTypeError('rhythm.Generator must be constructed '+
                        'with a reference to an instance of rhythm.Clock');
                } else if (v instanceof rhythm.Clock) {
                    clk = v; 
                } else {
                    throwRhythmTypeError('rhythm.Generator.clock must be an '+
                        'instance of rhythm.Clock');
                }
            }
        });
        this.clock = clock;
        
        var validateCallbackType = function(f) {
            if (typeof f !== 'function') {
                throwRhythmTypeError('callback must be a function');
            }
            return f;
        };

        Object.defineProperty(this, 'callbacks', {
            get: function() { return cbks; },
            set: function(val) {
                var r = [];
                if (Array.isArray(val)) {
                    val.forEach(function(it) {
                        r.push(validateCallbackType(it)); 
                    });
                } else {
                    r.push(validateCallbackType(val));
                }
                cbks = r;
            }
        });

        Object.defineProperty(this, 'targets', {
            get: function() { return targ; },
            set: function(targets) {
                var r = {};

                var checkTarget = function(toOperate, name) {
                    if (toOperate[name] instanceof instrument.ParameterizedAction) {
                        r[name] = toOperate[name];
                    } else if (typeof toOperate === 'function') {
                        // a little help so you can just pass rhythm gen arbitrary 
                        // functions to call; if passing any particular values to 
                        // this function is unimportant
                        var action = new instrument.ParameterizedAction(toOperate);
                        var env = new envelopeCore.Envelope();
                        env.duration = 1000;
                        env.interpolationType = 'none';
                        env.valueSequence.push(new envelopeCore.EnvelopeValue(0, 0));
                        action.envelope = env.toAbsolute();
                        r[name] = action;
                    } else if ('actionTarget' in toOperate) {
                        checkTarget(toOperate.actionTarget, name);
                    } else {
                        throwRhythmTypeError("All targets must be instances of "+
                            "must be instances of instrument.ParameterizedAction, functions, "+
                            "or an instance of instrument.Instrument that overrides its "+
                            "actionTarget property with a reference to one of the above.");
                    }
                };
               
                for (var t in targets) {
                    if (targets.hasOwnProperty(t)) {
                        checkTarget(targets[t], t);
                    }
                } 

                targ = r;
                util.objectLength.call(targ);
            }
        });

        Object.defineProperty(this, 'rhythmicSequence', {
            get: function() { return rseq; },
            set: function(s) {
                for (var prop in s) {
                    if (s.hasOwnProperty(prop)) {
                        if ( !('subd' in s[prop]) ) {
                            throwRhythmPropError('subd');
                        } else if (s[prop].subd < 0) {
                            throwRhythmRangeError("{rhythm}."+prop+".subd must be greater than 0");
                        }
                        // TODO: enforce existance of targets
                        // TODO: allow not defining a val prop if only one target
                        // and no env recalculation
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
                rseq = s;
            }
        });

        var q = {},
            prior_time = 0;
         
        var resolveRhythmicSequence = function() {
            var i = 0;
            var subd2time = function(subd) {
                return (60 / clk.bpm) * 1000 * subd;
            };
           
            q = {};

            for (var step in rseq) {
                if (rseq.hasOwnProperty(step)) {
                    if (step === 'off') {
                        prior_time = subd2time(rseq[step].subd);
                    } else {
                        (function() {
                            var values = {},
                                smudge = rseq[step].smudge,
                                repeats = rseq[step].rep ? rseq[step].rep : 1;
                           
                            while (repeats-- > 0) {
                                var time = smudge ? 
                                    util.smudgeNumber(prior_time, smudge) : prior_time;

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
                                time = prior_time = time + subd2time(rseq[step].subd);
                            }
                        }());
                    }
                }
            }
        };
        
        var throwParseConfigError = function(name) {
            throw new Error(rhythmGeneratorError("config object must specify a '"+
                    name+"' property"));
        };

        // TODO: do not allow setting of targets, options, or 
        // rhythmicSequence through props
        this.parseConfig = function(c) {
            if ( !('targets' in c) ) throwParseConfigError('targets');
            if ( !('seq' in c) && !('sequence' in c) ) throwParseConfigError('seq or sequence');
            
            this.targets = c.targets;
           
            var optSettable = ['retrograde', 'locked', 'loop'];

            if ('opt' in c) {
                for (var prop in c.opt) {
                    if (c.opt.hasOwnProperty(prop)) {
                        if (optSettable.indexOf(prop) >= 0) this[prop] = c.opt[prop];
                    }
                }
            }

            if ('callbacks' in c) this.callbacks = c.callbacks;

            this.rhythmicSequence = c.seq || c.sequence;
            resolveRhythmicSequence();

            
        };
        if (config) this.parseConfig(config);

        
        var clock_fns = [],
            cancelables = [];

        this.execute = function() {
            var reinit_id = "I went to Santee once. Someone I knew milked a goat.",
                bootstrap_count = 0,
                loop_count = (typeof loop === 'number') ? this.loop : -999;

            var clk_q_id = clk.push(function sounder(offset) {
                var off = offset ? offset : 0,
                    bang = false;

                if (!locked || (clk.cycleCount % locked === 0)) {
                    bang = true;
                    for (var s in q) {
                        if (q.hasOwnProperty(s)) {
                            for (var t in q[s].values) {
                                if (q[s].values.hasOwnProperty(t)) {
                                    cancelables.push(
                                        envelopeCore.apply(
                                            targ[t].target,
                                            q[s].values[t] ? 
                                                q[s].values[t] : targ[t].envelope,
                                            q[s].time + off
                                        )
                                    );
                                }
                            }
                        }
                    }
                    if (loop_count) loop_count--; 
                }
               
                /*
                 * To facilitate the repetition of rhythms shorter than one
                 * beat when in !locked mode, sounder calls itself enough times to 
                 * fill the first beat before passing itself to the loop reinitializer,
                 * which basically does the same thing...
                 * TODO: consider if the floatingLoop module should exist.
                 * .. it makes things easier in the case where multiple Generators
                 * share the same clock?
                 */ 
                if (!locked && prior_time < clk.beatLength && bootstrap_count <= clk.beatLength) {
                    var ofend = off + prior_time;
                    bootstrap_count += prior_time;
                    sounder(ofend);
                }

                var done = function() {
                    floatingLoopReinitializer.rm(reinit_id);
                    clk.rm(clk_q_id);
                    clock_fns.splice(clock_fns.indexOf(clk_q_id), 1);
                    
                    window.setTimeout(function() {
                        if (cbks) {
                            cbks.forEach(function(v) {
                                v();
                            });
                        }
                    }, prior_time + offset);
                };

                if (!locked || (!loop && bang)) clk.rm(clk_q_id);   

                if (!locked) {
                    if (loop && !floatingLoopReinitializer.inQueue(reinit_id)) {
                        reinit_id = floatingLoopReinitializer.push(prior_time, sounder, clk);
                    }
                    if (was_loopin) done();
                }

                if (!loop_count && loop_count !== -999) done();
            });
            clock_fns.push(clk_q_id);
        }; 

        /*
         *  Cancelables have an expiry date, so the Cancelables 
         *  array occasionally needs to be culled
         *
         *  the cancelables array is culled both on Generator.shirk calls,
         *  as well as once per second
         */
        var cullCancelables = function() {
            cancelables.forEach(function(v, idx) {
                if (!v.fresh) cancelables.splice(idx, 1);
            });
        };
        window.setInterval(function() {
            cullCancelables();
        }, 1000);
        
        this.shirk = function() {
            clock_fns.forEach(function(v) {
                clk.rm(v);
            });
            cullCancelables();
            cancelables.forEach(function(v, idx) {
                v.cancel();
            });
            this.loop = false;
            this.locked = 0;
        }; 
        // helper to scale rhythm at new bpm
    };

return rhythm; });
