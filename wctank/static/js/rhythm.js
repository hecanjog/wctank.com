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
            smudge, bpm, last, next,
            isOn = false,
            cycles = 0, 
            id, wasPaused, beat_start, beat_remaining;

        var throwClockParamException = function(mess) {
            throw new RangeError("Invalid Clock param: " + mess);
        };
        
        var machine = function() {
            var loop = function() {
                var msec = 60000 / bpm,
                    time = (smudge > 0) ? util.smudgeNumber(msec, smudge) : msec;
                
                last = next;
                next = performance.now() + time;
                
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
            }
        });
                
        Object.defineProperty(this, 'bpm', {
            get: function() { return bpm; },
            set: function(n) {
                if ( (typeof n !== 'number') || (n <= 0) ) {
                    throwClockParamException("bpm must be a Number "+
                    "greater than zero, not " + n + ".");
                } else {
                    bpm = n;
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
            var exists = function(obj) {
                return typeof obj !== 'undefined';
            };

            var now = performance.now();
            for (var r in rq) {
                // undefined check b/c rval obj may be derefrenced during execution
                //TODO: why after an .rm does this occur on updateEndTime?
                if (rq.hasOwnProperty(r)) {
                    if (rq[r].endTime < rq[r].clock.nextBeat) {
                        var offset = rq[r].endTime - rq[r].clock.lastBeat;
                        rq[r].fn(offset);
                        if (exists(rq[r])) rq[r].updateEndTime(now + offset);
                    }
                }
            }
        };

        var rval = function(duration, fn, clock) {
            this.duration = duration;
            this.fn = fn;
            this.clock = clock;
            this.endTime = 0;
            this.updateEndTime = function(startTime) {
                this.endTime = startTime + duration;
            };
        };
        
        reinit.push = function(duration, fn, clock) {
            last = performance.now();
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
            rhy.updateEndTime(performance.now());

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
        var clk, targ, rseq,
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
        
        Object.defineProperty(this, 'targets', {
            get: function() { return targ; },
            set: function(targets) {
                for (var t in targets) {
                    if (targets.hasOwnProperty(t)) {
                        if ( !(targets[t] instanceof instrument.ParameterizedAction) ) {
                            throwRhythmTypeError("All targets must be "+
                                "instances of instrument.ParameterizedAction.");
                        } 
                    }
                }
                targ = targets;
                util.objectLength.call(targ);
            }
        });

        Object.defineProperty(this, 'rhythmicSequence', {
            get: function() { return rseq; },
            set: function(s) {
                var validateCallbackType = function(f) {
                    if (typeof f !== 'function') {
                        throwRhythmTypeError('callback must be a function');
                    }
                    return f;
                };
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

        this.parseConfig = function(c) {
            if ( !('targets' in c) ) {
                throw new Error(rhythmGeneratorError("config object must specify a "+
                    "'targets' property"));
            }
            if ( !('seq' in c) ) {
                throw new Error(rhythmGeneratorError("config object must specify a "+
                    "'seq' property"));
            }

            this.targets = c.targets;
            this.rhythmicSequence = c.seq;
            if ('opt' in c) {
                this.loop = c.opt.loop;
                this.retrograde = c.opt.retrograde;
            }
        };
        if (config) this.parseConfig(config);
            
        var clock_fns = [],
            cancelables = [];
        
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

            var reinitId = "I went to Santee once. Someone I knew milked a goat.";

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
                }
                
                if (!locked || (!loop && bang)) clk.rm(clk_q_id); // rm from clock_fns

                if (!locked) {
                    if (loop && !floatingLoopReinitializer.inQueue(reinitId)) {
                        reinitId = floatingLoopReinitializer.push(prior_time, sounder, clk);
                    }
                    if (was_loopin) {
                        floatingLoopReinitializer.rm(reinitId);
                    }
                }
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
