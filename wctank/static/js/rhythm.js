define(
    [
        'util'
    ],

function(util) { var rhythm = {};

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


// rhythmGenerator(clock, target) 
    // .start(val)
    // .stop
    // .parse
    //
    // .rhythm
    //      - calc length
    // .loop
    //      - loop at end of seq, no matter how many beats
    // .targetVal
    // .target
    // .attach
    // .detach
    // .clock
    // .addAction(...)
    //
    //

return rhythm; });
