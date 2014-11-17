define(
    [
        'util'
    ],

function(util) { var audioUnitConversions = {};
    
    audioUnitConversions.hz2Mel = function(hz) {
        return 1127 * Math.log(1 + (hz / 700));
    };
    
    audioUnitConversions.mel2Hz = function(mel) {
        return 700 * Math.pow(Math.E, (mel / 1127)) - 1;
    };

    audioUnitConversions.cents2Hz = function(cents, basehz) {
       return basehz * Math.pow(2, cents / 1200);   
    };

return audioUnitConversions; });
