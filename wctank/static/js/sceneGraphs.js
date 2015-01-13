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

        var choirVerb = new audioModules.SchroederReverb();

        choir.link(choirVerb).link(audioCore.out);

        gMap.events.queue('map', 'zoom_changed', function() {
            var dur = util.smudgeNumber(100, 50);
            choir.attack.createEnvelope(dur);
            choir.attack.execute();
            isAccenting = true;
            var env_dur = choir.attack.envelope.duration;
            window.setTimeout(function() {
                choir.accent();  
            },  env_dur * util.smudgeNumber(0.5, 20));
            window.setTimeout(function() {
                isAccenting = false;
            }, env_dur);
        });

        var environ = new instruments.WesEnviron();
        environ.link(audioCore.out);

        var clock = new rhythm.Clock(100);
        
        var snare = new instruments.raspyCarpark();

        var glow = new mutexVisualEffects.CausticGlow();

        var tab = new tableux.Engine();
        tab.parseData(tableux.stockList);

        this.init = function() {
            tab.select(glow);
            clock.start();
            choir.start();
            glow.apply();
        };

        this.teardown = function() {
            choir.stop();
        };
    };
    sceneGraphs.Rooms.prototype = new sceneGraphCore.SceneGraph();
        
return sceneGraphs; });
