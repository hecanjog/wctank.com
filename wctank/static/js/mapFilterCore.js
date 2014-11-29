define(
    [
        'util',
        'div',
        'gMap',
        'visualCore'
    ],

function(util, div, gMap, visualCore) { var mapFilterCore = {};

    var currentFilter = null,
        last_filter;

    Object.defineProperty(this, 'currentFilter', {
        get: function() { return currentFilter; }
    });


    mapFilterCore.MapFilter = function() {
        this.css_class = '';

        var dummy = new visualCore.Effect();
        this.operate = function(stage) {
            var parent = this,
                op = dummy.operate.bind(this),
                $op;
            if (stage === 'init') {
                $op = 'addClass';
            } else if (stage === 'teardown') {
                $op = 'removeClass';
            }
            op(stage, [{address: 1, fn: function() {
                div.$map[$op](parent.css_class);
            }}]);
        };
    };
    mapFilterCore.MapFilter.prototype = new visualCore.Effect();

    mapFilterCore.apply = function(filter) {
        currentFilter = filter;
        if (last_filter) last_filter.operate('teardown');
        filter.operate('init');
        last_filter = filter;
    };

return mapFilterCore; });
