define(
    [
        'util',
        'instrument'
    ],

function(util) { var rhythm = {};
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

        Object.defineProperty(this, 'smudgeFactor', {
            get: function() { return smudge; },
            set: function(val) { checkAndSetSmudge(val); }
        });

        this.push = function(fn) {
            var hash = util.hashCode(fn.toString());
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
        var clock_hashes = []; 
        this.execute = function() {
            for (var t in targ) {
                if (targ.hasOwnProperty(t)) {
                    // create anon function and pass to clock queue
                    // anon function, if looped, calls back to this.execute
                    if (targ[t].type === 'AudioParam') {
                        // schedule the beat in advance
                        // get env of  
                    } else { // target is anon fn
                        // schedule beat of timeouts
                    }
                    
                    // loop? this.execute()
                }
            }
        }; 

        this.shirk = function() {
            // cancel scheduled events if audio param, flag loop off
            // cancel timeouts if anon 
        }; 

        // helper to scale rhythm at new bpm
    };

return rhythm; });
