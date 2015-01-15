/*
 * The render loop.
 */
define(

function() { var render = {};
    
    var queue = [],
        id;

    render.rendering = false;
    
    render.start = function() {
        render.rendering = true;
        queue.forEach(function(fn) { 
            fn(); 
        });
        id = window.requestAnimationFrame(render.start);
    };
    
    render.stop = function() {
        render.rendering = false;
        cancelAnimationFrame(id);
    };

    render.queue = function(funct) {
        queue.push(funct);
        if (!render.rendering) render.start();
    };

    render.rm = function(funct) {
        var idx = queue.indexOf(funct);
        if (idx !== -1) queue.splice(idx, 1);
        if (queue.length === 0) render.stop(); 
    };

    render.has = function(fn) {
        if (typeof fn === 'function') {
            var idx = queue.indexOf(fn);
            return (idx !== -1) ? idx : false;
        } else {
            return (queue.length > 0) ? true : false;
        }
    };

return render; });
