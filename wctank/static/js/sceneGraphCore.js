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

    core.RhythmEngine = function(clockObj) {
         
        
     // must be able to interact with arbitrary events, but, if AudioParam value change,
        // then generate higher res rhythms    
    // visual events max at a resolution of 60fps, or 16 msec
        // audio events go to 1/10 ms
        this.schedule;
        // big cache, unshift and send calls - audio params can be sent messages immediately
        this.scheduleVisualEvent;
        this.scheduleAudioEvent;
        
        // function queue
        // or Audio Param
        //      audioModule - extend with object wrapper for adjustable audio params 
        //      extension in sceneGraphCore for timed event parameters
        //      "timedEventInterface"
        //          components:
            //          name: {param_alias (or function accepting time
        //          as param), value test (function that 
            //              will return true if value is allowed, isAudio)
        //              time as param if audio, else just function call
        //    function(time), function(value), bool isAudio, minimum time between calls 
        //     asdr generator     
       // define actions, wheather or not  
    };
   
    /*
     *  The RhythmicActionInterface is constructed within AudioModules or Visual Effects 
     *  that perform actions that should be rhythmized, and provides a standard interface
     *  for objects to interact with the RhythmEngine object  
     */ 
    core.RhythmicActionInterface = function(scope) {
        var actions = {};
        
        Object.defineProperty(scope, "_actions", {
            get: function() { return actions; }
        }); 
        
        var checkRAIParam = function(name, type, val) {
            if (typeof val !== type)   
                throw "RhythmicActionInterface param error: " + name + " must be a " + 
                    type + "not " + val + " which is (a) " + typeof val;
        };

        function RhythmicAction(trigger, validation, minTime, isAudio) {
            this.trigger = trigger;
            this.validation = validation;
            this.minTime = minTime;
            this.isAudio = isAudio;
        } 
        this.create = function(name, trigger, validation, minTime, isAudio) {
            checkRAIParam("NAME", "string", name);
            checkRAIParam("TRIGGER", "function", trigger);
            checkRAIParam("VALIDATION", "function", validation);
            checkRAIParam("MINTIME", "number", minTime);
            checkRAIParam("ISAUDIO", "boolean", isAudio);

            if (typeof actions[name] !== "undefined") {
                throw "RhythmicActionInterface param error: action name already exists!";
            } else {
                actions[name] = new RhythmicAction(trigger, validation, minTime, isAudio);
            }
        };
    };

return core; });
