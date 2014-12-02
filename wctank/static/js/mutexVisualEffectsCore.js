define(
    [
        'util',
        'div',
        'gMap',
        'visualCore'
    ],

function(util, div, gMap, visualCore) { var mutexVisualEffectsCore = {};

    var currentFilter = null,
        last_filter;

    Object.defineProperty(this, 'currentFilter', {
        get: function() { return currentFilter; }
    });


    mutexVisualEffectsCore.MutexEffect = function() {
        this.css_class = '';

        var dummy = new visualCore.Effect();
        delete this.operate;
        this._operate = function(stage) {
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
        this.apply = function() {
            mutexVisualEffectsCore.apply(this);
        };
    };
    mutexVisualEffectsCore.MutexEffect.prototype = new visualCore.Effect();

    mutexVisualEffectsCore.apply = function(filter) {
        currentFilter = filter;
        if (last_filter) last_filter._operate('teardown');
        filter._operate('init');
        last_filter = filter;
    };

return mutexVisualEffectsCore; });
