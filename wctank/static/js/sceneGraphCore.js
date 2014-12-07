define(
    [
        'util'
    ],

function(util) { var core = {};
    
    core.SceneGraph = function() {
        this.mutexVisualEffects = {};
        this.visualEffects = {};
        this.audio = {};
        this.init = null;
        this.teardown = null;
        this.apply = function() {
            core._applySceneGraph(this);
        };
    };

    var last = null;
    core._applySceneGraph = function(scene) {
        if (last) {
            last.teardown();
        }
        scene.init();
        last = scene;
    };

    core.GrossSequencer = function() {
        var queue = [],
            current = 0;
        
        this.push = function(fn) {
            queue.push(fn);
        };

        this.step = function(back) {
            var c = current,
                back ? c-- : c++;
            if ( (c >= 0) && (c < queue.length) ) {
                queue[c]();
                current = c;
            } else {
                console.warn("Sequencer.step error - attempt to step out of "+
                             "bounds. No action taken.");
            }
        };

        this.getNumberOfSteps = function() {
            return queue.length;
        };

        this.goTo = function(n) {
            if ( (n < queue.length) && (n >= 0) ) {
                queue[n]();
            } else {
                console.warn(
                    "Invalid Sequencer.goTo param: step "+n+" does not exist."
                );
            }
        };
    };

    /*
     * Slow clock that can be used to synchronize 
     * actions between objects and / or trigger events
     */
    core.Clock = function(tempo, smudgeFactor) {
        var parent = this;

        var queue = [],
            smudge, bpm,
            isOn = false, 
            id, wasPaused, beat_start, beat_remaining;

        var throwClockParamException = function(mess) {
            throw "Invalid Clock param: " + mess;
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
                    queue.forEach(function(fn) {
                        fn();
                    });
                    loop();
                }, time);
            };
            loop();    
        };
       
        Object.defineProperty(this, 'isEngaged', {
            get: function() { return isOn; }
        });

        Object.defineProperty(this, 'bpm', {
            get: function() { return bpm; },
            set: function(val) { 
                console.log(val);
                checkAndSetBpm(val);
            }
        });

        Object.defineProperty(this, 'smudgeFactor', {
            get: function() { return smudge; },
            set: function(val) { checkAndSetSmudge(val); }
        });

        this.push = function(fn) {
            queue.push(fn);   
        };
        this.rm = function(fn) {
            var idx = queue.indexOf(fn);
            queue.splice(idx, 1);
        };

        this.start = function(n) {
            if (isOn) {
                this.stop();
                isOn = false;
                this.start(n);
            } else {
                isOn = true;
                if ( (typeof n === 'undefined') && (typeof bpm === 'undefined') ) {
                    throwClockParamException("Start can only be called without a bpm "+
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

return core; });
