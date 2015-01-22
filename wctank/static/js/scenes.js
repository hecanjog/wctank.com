define(
    [
        'sceneCore',
        'audioCore',
        'audioModules',
        'audioNodes',
        'rhythm',
        'instruments',
        'visualEffects',
        'mutexVisualEffects',
        'tableux',
        'gMap',
        'util',
        'jquery'
    ],

function(sceneCore, audioCore, audioModules, audioNodes, rhythm, instruments, 
         visualEffects, mutexVisualEffects, tableux, gMap, util, $) { var scenes = {};

    scenes.NoMages = function() {
       
        //TODO: should this be more event dispatch-y?

        /****************** Primary visual components ******************/
        var glow = new mutexVisualEffects.CausticGlow();
        
        var tab = new tableux.Engine();
        tab.parseData(tableux.stockList);
        /**********************************************************/

        /***************** Adjunct Visual Behaviors ***************/

        ///////// squares trigger far out
        var squares = new visualEffects.Squares(),
            squares_on = false;

        gMap.events.queue('map', 'zoom_changed', function() {
            var zoom = gMap.map.getZoom();
            if (zoom === 3) {
                window.setTimeout(function() {
                    if (gMap.map.getZoom() === 3) {
                        squares.operate('init');
                        squares_on = true;  
                    };
                }, 200);
            } else if (squares_on && zoom > 4) { 
                squares.operate('teardown');
                squares_on = false;
            }         
        });
        /////////
        
        /**********************************************************/

        /********************* Audio Environ **********************/
        var environClock = new rhythm.Clock(80);

        var environ = new instruments.WesEnviron();
        environ.link(audioCore.out);

        var plusMinusCntr = util.smudgeNumber(10, 20) | 0,
            plusMinus = true;

        var bankRhythm = {
            opt: {
                loop: 50
            },
            targets: {
                bank: environ.oscBankAttack
            },
            seq: {
                0: { subd: 0.33, val: {bank: true}, smudge: 2.5 },
                1: { subd: 0.05, val: {bank: false}, smudge: 0.5 }
            },
            callbacks: function() {
                var switched = false;
                bankRhythm.opt.loop = (function() {
                    var n = util.smudgeNumber(bankRhythm.opt.loop, 15) | 0;
                    if (plusMinusCntr === 0) {
                        plusMinus = !plusMinus;
                        plusMinusCntr = util.smudgeNumber(10, 20) | 0;
                        switched = true;
                    }
                    if (((plusMinus && n > bankRhythm.opt.loop) ||
                          (!plusMinus && n < bankRhythm.opt.loop)) &&
                         plusMinusCntr > 0) {
                        plusMinusCntr--;
                        return n;
                    } else {
                        return n + 2;
                    }
                }());
                
                var subd = switched ? util.smudgeNumber(1.2, 20) :
                    util.smudgeNumber(0.4, 30);

                bankRhythm.seq[0].subd = subd;

                environ.smudgeOscSonority(0);

                bankRhythmGen.parseConfig(bankRhythm);
                bankRhythmGen.execute();
            }
        }; 
        var bankRhythmGen = new rhythm.Generator(environClock, bankRhythm);
        
        gMap.events.queue('map', 'zoom_changed', function() {
            var zoom = gMap.map.getZoom(),
                thresh = 15,
                fact = thresh - zoom,
                mult = 100 / thresh;
            
            var percent = fact < 0 ? 0 : fact * mult;
            environ.wetDry(percent, 1200);
         
            // !!!! glow blur params are closely related to audio environ 
            var blur_thresh = thresh - 5,
                blur_fact = blur_thresh - zoom;

            glow.animatedPostBlurDuration = blur_fact < 0 ? 0 : blur_fact * 100 + 900;
            glow.animatedPostBlurRadius = blur_fact < 0 ? 0 : Math.log10(blur_fact) * 12;
        });
        /**********************************************************/

        /*************** Adjunct Audio Behavior *******************/
        
        /////////// choir stabs on zoom events
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
        ///////////

        ////////// drum rolls far out
        var drumClock = new rhythm.Clock(105.2);
        
        var drum = new instruments.BigSampleDrum();
        drum.link(audioCore.out);
        drum.outGain.gain.value = 0.0;

        var drumBangRhythm = {
            opt: {
                loop: true
            },
            targets: {
                bang: drum.bangTarget
            },
            seq: {
                0: {subd: 0.07 * 4, val: {bang:""}, smudge: 0.2, rep: 23},
                1: {subd: 0.0445 * 4, val: {bang:""}, smudge: 0.5},
                2: {subd: 0.0500 * 4, val: {bang:""}, smudge: 0.5},
                3: {subd: 0.0594 * 4, val: {bang:""}, smudge: 0.5},
                4: {subd: 0.0668 * 4, val: {bang:""}, smudge: 0.5}
            }
        };
        var bangGen = new rhythm.Generator(drumClock, drumBangRhythm);

        var drumEnd = false;

        var drumGainRhythm = {
            opt: {
                loop: true
            },
            targets: {
                gain: drum.gainTarget
            },
            // TODO: referencing the time here is weird
            seq: {
                0: {subd: 4.5, val: {
                        gain: {
                            val: 0.15, time: drumClock.beatLength
                        }
                    }, smudge: 10
                },
                1: {subd: 4.5, val: {
                        gain: {
                            val: 0, time: drumClock.beatLength
                        }
                    }, smudge: 10
                }     
            }
        };
        var gainGen = new rhythm.Generator(drumClock, drumGainRhythm);

        var isDrumming = false,
            drum_id;
        gMap.events.queue('map', 'zoom_changed', function() {
            var zoom = gMap.map.getZoom();
            if (!isDrumming && zoom <= 5) {
                isDrumming = true;
                drum_id = window.setTimeout(function() {
                    bangGen.loop = true;
                    gainGen.loop = true;
                    bangGen.execute();
                    gainGen.execute();
                    drumClock.start();
                }, util.smudgeNumber(1400, 10));
            } else if (isDrumming && zoom >= 8) {
                window.clearTimeout(drum_id);
                isDrumming = false;
                bangGen.loop = false;
                gainGen.loop = false;
            }
        });

        //////////
        /**********************************************************/

// delayed noise blast after marker click
// angular clusters
// closer zooms voice
// duck out on video play
// slow independently building musicalized texture swell
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
    scenes.NoMages.prototype = new sceneCore.Scene();
        
return scenes; });
