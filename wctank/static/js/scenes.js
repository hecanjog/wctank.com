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
        'jquery',
        'featureDetectionMain'
    ],

function(sceneCore, audioCore, audioModules, audioNodes, rhythm, instruments, 
         visualEffects, mutexVisualEffects, tableux, gMap, util, $, 
         featureDetectionMain) { var scenes = {};

    scenes.NoMages = function() {
       
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
       
        /// animated blur far out
        gMap.events.queue('map', 'zoom_changed', function() {
            var zoom = gMap.map.getZoom();
            
            var blur_thresh = 7,
                blur_fact = blur_thresh - zoom;

            glow.animatedPostBlurDuration = blur_fact < 0 ? 0 : blur_fact * 100 + 900;
            glow.animatedPostBlurRadius = blur_fact < 0 ? 0 : Math.log10(blur_fact) * 12;
        });

        /**********************************************************/

        /********************* Audio Environ **********************/
        var environClock = new rhythm.Clock(30);

        // field recording
        var environ = new instruments.WesEnviron();
        environ.link(audioCore.out);

        gMap.events.queue('map', 'zoom_changed', function() {
            var zoom = gMap.map.getZoom(),
                gain;
            if (zoom >= 18) {
                gain = 1;
            } else if (zoom <= 3) {
                gain = 0;
            } else {
                gain = 1 - (15 - zoom) * 0.067;
            }
            environ.outGain.gain.linearRampToValueAtTime(gain, audioCore.ctx.currentTime + 0.5);
        });

        // organ ostinato
        var organ = new instruments.Organ(),
            organConvo = audioModules.Convolution('/static/assets/york-minster'+
                            featureDetectionMain.audioExt);
        organConvo.wetDry(95);
       
        organ.outGain.gain.value = 0.8;
        organConvo.gain.gain.value = 0.68;
        
        organ.link(organConvo).link(audioCore.out);

        var organClock = new rhythm.Clock(50);
        organClock.smudgeFactor = 3;
        
        var organRhythmParams = {
            opt: {
                loop: true
            },
            targets: {
                atk: organ.attackTarget,
                freq: organ.pitchTarget
            },
            seq: {
                0: {
                    subd: 1, 
                    val: {
                        atk: {voice: 0, isAttack: true},
                        freq: {voice: 0, frequency: 330}
                    }
                },
                1: {
                    subd: 1,
                    val: {
                        atk: {voice: 1, isAttack: 'asdr', dur: {subd: 1, clock: organClock}}, 
                        freq: {voice: 1, frequency: 196}
                    }
                },
                2: {
                    subd: 1,
                    val: {
                        atk: {voice: 2, isAttack: 'asdr', dur: {subd: 1, clock: organClock}},
                        freq: {voice: 2, frequency: 262}
                    }
                }
            }
        }; 
        var organRhythm = new rhythm.Generator(organClock, organRhythmParams);
        organRhythm.execute();
        organClock.start();
        
        gMap.events.queue('map', 'zoom_changed', function() {
            var zoom = gMap.map.getZoom();
            organClock.bpm = 50 - (25 - zoom * 1.25);
            var gain = (function() {
                if (zoom >= 18) {
                    return 0.02;   
                } else {
                    return 0.45 + (18 - zoom) * 0.0306;
                }
            }());
            organConvo.gain.gain.linearRampToValueAtTime(
               gain, audioCore.ctx.currentTime + 1
            );
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
            var env_dur = choir.attack.envelope.duration;
            window.setTimeout(function() {
                choir.accent();  
            },  env_dur * util.smudgeNumber(0.5, 20));
        });
       
        // drum rolls far out
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
       
        // megaphone spectra beeps further out
        var plusMinusCntr = util.smudgeNumber(10, 20) | 0,
            plusMinus = true;
       
        var beepClock = new rhythm.Clock(80);

        var beeps = new instruments.Beep();
        beeps.link(choirVerb).link(audioCore.out);
        beeps.oscBankGain.gain.value = 0;
        beeps.start();

        var bankRhythm = {
            opt: {
                loop: 2
            },
            targets: {
                bank: beeps.oscBankAttack
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
                        return n + 1;
                    }
                }());
                
                var subd = switched ? util.smudgeNumber(1.2, 20) :
                    util.smudgeNumber(0.4, 30);

                bankRhythm.seq[0].subd = subd;

                beeps.smudgeOscSonority(0);

                bankRhythmGen.parseConfig(bankRhythm);
                bankRhythmGen.execute();
            }
        }; 
        var bankRhythmGen = new rhythm.Generator(beepClock, bankRhythm);
        bankRhythmGen.execute();
        beepClock.start();

        gMap.events.queue('map', 'zoom_changed', function() {
            var zoom = gMap.map.getZoom(),
                gain = zoom <= 5 ? 
                       zoom ? 0.45 / zoom : 0.45 : 0;
            beeps.setGain(gain);
        });

        //occasional noise bursts 
        var sqwk = new instruments.NoiseSquawk();
        sqwk.link(audioCore.out);
        
        var queueSquawk = function() {
            if (Math.random() < 0.2) {
                window.setTimeout(function() {
                    sqwk.attackTarget.createEnvelope(util.smudgeNumber(800, 50));
                    sqwk.attackTarget.execute();
                }, util.smudgeNumber(4000, 20));
            }
        };
        gMap.events.queue('marker', 'click', queueSquawk);
        gMap.events.queue('map', 'zoom_changed', queueSquawk);

        //occasional wes
        var vox = new instruments.WesVox();
        vox.link(audioCore.out, 0, 0);
        var voxId = window.setInterval(function speak() {
            if (Math.random() < 0.05) {
                window.clearInterval(voxId);
                vox.actionTarget();
                voxId = window.setInterval(speak, util.smudgeNumber(1000, 10));
            }
        }, 1000); 


        /**********************************************************/
        
        this.init = function() {
            //environ.start();
            environClock.start();
            //bankRhythmGen.execute();
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
