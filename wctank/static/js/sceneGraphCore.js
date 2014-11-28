define(
    [
        'util'
    ],

function(util) { var core = {};

    /*
     *  the render loop
     *  only one exists.
     */
    core.render = (function(render) {
        var queue = [],
            id;
        
        var exQueue = function() {
            for (var i = 0; i < queue.length; i++) {
                stk[i]();
            }
        }; 

        render.rendering = false;
        
        render.push = function(funct) {
            queue.push(funct);
            if (!render.rendering) render.go();
        };

        render.rm = function(funct) {
            var idx = queue.indexOf(funct);
            if (idx !== -1) queue.splice(idx, 1);
            if (queue.length === 0) render.stop(); 
        };

        // TODO: should be 'start'
        render.go = function() {
            render.rendering = true;
            id = window.requestAnimationFrame(render.go);
            exQueue();
        };

        // TODO: remove else clause
        render.has = function(fn) {
            if (typeof fn === 'function') {
                var idx = queue.indexOf(fn);
                return (idx !== -1) ? idx : false;
            } else {
                return (queue.length > 0) ? true : false;
            }
        };

        render.tick = function() {
            if (queue.length > 0) exQueue();
        };

        render.stop = function() {
            render.rendering = false;
            cancelAnimationFrame(id);
        };

        return render;
    }({}))

    /*
     * Slow clock that can be used to synchronize 
     * actions between objects and / or trigger events
     */
    core.Clock = function(BPM, smudgeFactor) {
        var parent = this;

        var queue = [],
            smudge = smudgeFactor, 
            bpm = BPM,
            isOn = false, 
            id, wasPaused, beat_start, beat_remaining;

        var throwClockParamException = function(mess) {
            throw "Invalid Clock param: " + mess;
        };

        var checkAndSetSmudge = function(n) {
            if ( (typeof n === 'undefined') || (n < 0) ) {
                throwClockParamException("smudgeFactor must be "+
                    "a Number greater than or equal to zero, not " + n); 
            } else {
                smudge = n;
            }
        };
        if (smudgeFactor) checkAndSetSmudge(smudgeFactor);
        
        var bpm2msec = function(n) {
            return 60000 / n;
        };
        var checkAndSetBpm = function(n) {
            if ( (typeof n !== 'number') || (n <= 0) ) {
                throwClockParamException("BPM must be a Number greater than zero, "+
                                         "not " + n + ".");
            } else {
                bpm = n;
            }                
        };

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
            enumerable: true,
            get: function() { return isOn; }
        });

        Object.defineProperty(this, 'bpm', {
            enumerable: true,
            get: function() { return bpm; },
            set: function(val) { 
                console.log(val);
                checkAndSetBpm(val);
            }
        });

        Object.defineProperty(this, 'smudgeFactor', {
            enumberable: true,
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
