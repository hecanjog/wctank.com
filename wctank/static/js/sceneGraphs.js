define(
    [
        'sceneGraphCore',
        'audioCore',
        'audioModules',
        'audioNodes',
        'rhythm',
        'instruments',
        'visualEffects',
        'mutexVisualEffects',
        'mutexVisualEffectsCore',
        'tableux',
        'gMap',
        'util',
        'div'
    ],

function(sceneGraphCore, audioCore, audioModules, audioNodes, rhythm, 
         instruments, visualEffects, mutexVisualEffects, mutexVisualEffectsCore, 
         tableux, gMap, util, div) { var sceneGraphs = {};

    sceneGraphs.Rooms = function() {
        
        /********************** stabs on zoom events *******************/
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
        /***************************************************************/


        /*********************** Audio Environs ************************/
        var environClock = new rhythm.Clock(80);

        var environ = new instruments.WesEnviron();
        environ.link(audioCore.out);

        var bankRhythmShort = {
            opt: {
                loop: true
            },
            targets: {
                bank: environ.oscBankAttack
            },
            seq: {
                0: { subd: 0.33, val: {bank: true}, smudge: 2.5 },
                1: { subd: 0.05, val: {bank: false}, smudge: 0.5 }
            }
        }; 
        var bankRhythmGen = new rhythm.Generator(environClock, bankRhythmShort);
        
        gMap.events.queue('map', 'zoom_changed', function() {
            var zoom = gMap.map.getZoom(),
                thresh = 14,
                mult = 100 / thresh,
                percent = thresh - zoom < 0 ? 0 : (thresh - zoom) * mult;
            environ.wetDry(percent, 1200);
        });
        /***************************************************************/
       
        /***************** Actions at extreme zoom levels **************/ 
        var squares = new visualEffects.Squares(),
            squares_on = false;

        gMap.events.queue('map', 'zoom_changed', function() {
            var zoom = gMap.map.getZoom();
            if (zoom === 0) {
                window.setTimeout(function() {
                    if (gMap.map.getZoom() === 0) {
                        squares.operate('init');
                        squares_on = true;  
                    };
                }, 1500);
            } else if (squares_on && zoom > 1) { 
                squares.operate('teardown');
                squares_on = false;
            }         
        });
        /***************************************************************/

        var glow = new mutexVisualEffects.CausticGlow();

        var tab = new tableux.Engine();
        tab.parseData(tableux.stockList);

        this.init = function() {
            environ.start();
            environClock.start();
            bankRhythmGen.execute();
            tab.select(glow);
            choir.start();
            glow.apply();
        };

        this.teardown = function() {
            choir.stop();
        };
    };
    sceneGraphs.Rooms.prototype = new sceneGraphCore.SceneGraph();
        
return sceneGraphs; });
