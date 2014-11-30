define(
/*
 *  The render loop
 */
function() { var render = {};
    
    var queue = [],
        id;
    
    var exQueue = function() {
        for (var i = 0; i < queue.length; i++) {
            queue[i]();
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

return render; });
