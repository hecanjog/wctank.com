define(
    [
        'util',
        'visCore',
        'tween'
    ],

function(util, visCore, TWEEN) { var audioUtil = {};
    
    // TWEEN utils
    audioUtil.tween = (function(tween) {
        tween.startTweens = function() {
            if ( visCore.render.has(TWEEN.update) === false ) 
                visCore.render.push(TWEEN.update);
            if (!visCore.render.rendering) visCore.render.go();  
        };
        // holy butts this is ugly. .length <= 2? I need to figure out why this works and
        // clean it up. But, in the meantime, it plugs a leak where unnecessary TWEEN.update
        // fns were being abandoned in the render loop to percolate tons of numbers forever and ever.
        tween.stopTweens = function() {
            if ( (TWEEN.getAll().length <= 2) 
                    && (typeof visCore.render.has(TWEEN.update) ==='number') ) {
                visCore.render.rm(TWEEN.update);
             }
            if ( !visCore.render.has() ) visCore.render.stop();
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
        }()) 
        tween.getRandomInterpolationFn = function() {
            return TWEEN.Interpolation[ util.getRndItem(interpolation_list) ]; 
        };
        return tween;
    }({})) 
    
    audioUtil.units = (function(units) {
        
        units.HZ = 'hz';
        units.HERTZ = 'hz';
        units.MEL = 'mel';
        units.SCI = 'scientific';
        units.SCIENTIFIC = 'scientific';
        units.MIDI = 'midi';

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
    }({}))

return audioUtil; });
