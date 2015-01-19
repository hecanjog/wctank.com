define(
    [
        'util',
        'render',
        'tween'
    ],

function(util, render, TWEEN) { var audioUtil = {};
    
    // TWEEN utils
    // TODO: move audioUtil.tween into general util.js or its own module.
    audioUtil.tween = (function(tween) {
        tween.startTweens = function() {
            if ( render.has(TWEEN.update) === false ) 
                render.queue(TWEEN.update);
        };
        // ick. .length <= 2? I need to figure out why this works and
        // clean it up. But, in the meantime, it plugs a leak where unnecessary TWEEN.update
        // fns were being abandoned in the render loop to percolate forever.
        tween.stopTweens = function() {
            if ( (TWEEN.getAll().length <= 2) && 
                (typeof render.has(TWEEN.update) === 'number') ) {
                render.rm(TWEEN.update);
             }
        };
        var easing_list = Object.keys(TWEEN.Easing); 
        tween.getRandomEasingFn = function() {
            var type = TWEEN.Easing[ util.getRndItem(easing_list) ];
            var keys = Object.keys(type);
            return type[ util.getRndItem(keys) ];
        };
        var interpolation_list = (function() {
            var list = Object.keys(TWEEN.Interpolation);
            var idx = list.indexOf('Utils');
            list.splice(idx, 1);
            return list;
        }()); 
        tween.getRandomInterpolationFn = function() {
            return TWEEN.Interpolation[ util.getRndItem(interpolation_list) ]; 
        };
        return tween;
    }({})); 
  
    // having this around as a collection can be handy. 
    audioUtil.oscTypes = {
        sine: 'sine',
        square: 'square',
        sawtooth: 'sawtooth',
        triangle: 'triangle'
    };

    audioUtil.units = (function(units) {
        units.hz2Mel = function(hz) {
            return 1127 * Math.log(1 + (hz / 700));
        };
        
        units.mel2Hz = function(mel) {
            return 700 * Math.pow(Math.E, (mel / 1127)) - 1;
        };

        units.cents2Hz = function(cents, basehz) {
           return basehz * Math.pow(2, cents / 1200);   
        };
        return units;
    }({}));

    audioUtil.parseSpriteIntervals = function(spriteIntervals) {
        var sprites = {};
        function SpriteInterval(start, end) {
            this.start = start;
            this.end = end;
        }
        var arr = spriteIntervals.match(/((\d|\.)+\s)/g);
        for (var i = 0; i < arr.length / 2; i++) {
            sprites[i] = new SpriteInterval(Number(arr[i * 2]), Number(arr[i * 2 + 1]));    
        }
        return sprites; 
    };

return audioUtil; });
