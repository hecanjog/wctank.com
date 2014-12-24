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
            var c = current;
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

return core; });
