define(
    [
        'util'
    ],

function(util) { var core = {};
    
    core.Scene = function() {
        this.init = null;
        this.teardown = null;
    };

    var last = null;
    core.apply = function(sceneObj) {
        if (last) {
            last.teardown(); 
        }
        var scene = new sceneObj();
        scene.init();
        last = scene; // watch for mem leaks?
        // write test that switches a lot
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
            if (c >= 0 && c < queue.length) {
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
            if (n < queue.length && n >= 0) {
                queue[n]();
            } else {
                console.warn(
                    "Invalid Sequencer.goTo param: step "+n+" does not exist."
                );
            }
        };
    };

return core; });
