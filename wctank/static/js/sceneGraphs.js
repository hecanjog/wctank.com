define(
    [
        'sceneGraphCore',
        'audioCore',
        'audioModules',
        'audioNodes',
        'rhythm',
        'instruments',
        'mutexVisualEffects',
        'mutexVisualEffectsCore',
        'tableux',
        'gMap',
        'util'
    ],

function(sceneGraphCore, audioCore, audioModules, audioNodes, rhythm, 
         instruments, mutexVisualEffects, mutexVisualEffectsCore, tableux, 
         gMap, util) { var sceneGraphs = {};

    sceneGraphs.Rooms = function() {
        var clock = new rhythm.Clock(60);

        // TODO: when Sonorities are implemented, this will break
        var choir_sonority = [
            931.765564,
            1100.557007,
            1433.202026,
            1879.656616,
            1927.278442,
            1951.355347,
            2191.642578,
            2684.844238,
            2883.212891      
        ]; 
        var choir = new instruments.SubtractiveChoir(choir_sonority);
        choir.gain.gain.value = 0.0;

        choir.link(audioCore.out);

        var isAccenting = false;
        gMap.events.queue('map', 'dragstart', function() {
            if (!isAccenting) {
                var dur = util.smudgeNumber(500, 50);
                choir.attack.createEnvelope({dur: dur, stage: true});
                choir.attack.execute();
                isAccenting = true;
                window.setTimeout(function() {
                    choir.accent();  
                }, dur * 0.5);
                window.setTimeout(function() {
                    var t = dur * 1.5;
                    choir.attack.createEnvelope({dur: t, stage: false});
                    choir.attack.execute();
                    window.setTimeout(function() {
                        isAccenting = false;
                    }, t);
                }, dur * 1.2);
            }
        });

        var environ = new instruments.WesEnviron();
        environ.link(audioCore.out);
        environ.wetDry(50);

        var vidfilt = new mutexVisualEffects.CausticGlow();

        this.init = function() {
            clock.start();
            choir.start();
            vidfilt.apply();
        };

        this.teardown = function() {
            choir.stop();
        };

    };
    sceneGraphs.Rooms.prototype = new sceneGraphCore.SceneGraph();
        
return sceneGraphs; });
