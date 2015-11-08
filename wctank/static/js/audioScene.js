import google from "google-maps";
import * as gMap from "./gMap";
import * as renderLoop from "lib/rudy/renderLoop";
import * as featureDetection from "./featureDetection";
import * as instruments from "./instruments";
import * as audioCore from "lib/rudy/audio/core";
import * as util from "lib/rudy/util";
import "lib/rudy/audio/modules/Convolution";
import "lib/rudy/rhythm/Clock";
import "lib/rudy/rhythm/Generator";


// everything in here can only be executed if webaudio exists,
// and es6 modules don't support conditional imports,
// so... this is a big method.
export function audio_scene_init() 
{
    // this just plays a field recording
    let environ = new instruments.BigEarEnviron();
    environ.link(audioCore.out);


    // closeup, play the field recording at full volume
    // far away, don't
    // in between, scale the amplitude with the zoom level
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


    // main instrument for bass ostinato, 'alto' and 'tenor' voices
    let organ = new instruments.SubtractiveOrgan(18, 10, 250);
    organ.gain.value = 0.8;

    // convolve the organ with an ir for reverb
    let organ_convo = Convolution(`/static/assets/york-minster${featureDetection.audioext}`);
    organ_convo.wetDry(100);
    organ_convo.gain.value = 0.68;

    organ.link(organ_convo).link(audioCore.out);

    // a clock just for the ostinato
    let ostinato_clock = new Clock(50, 3);

    // ostinato parameters
    let ostinato_loop_count = 0;
    let ostinato_params = {
        opt: {
            // execute callback after each loop
            loop: 1
        },
        targets: {
            attack: organ.attackTarget,
            frequency: organ.pitchTarget
        },
        
        // TODO: this probably should just be an array?
        // or was there a reason seq was an object?
        seq: {
            0: {
                subd: 1,
                val: {
                    attack: {voice: 0, isAttack: true},
                    frequency: {voice: 0, frequency: 330}
                }
            },
            1: {
                subd: 1,
                val: {
                    atk: {voice: 1, is_attack: 'asdr', dur: {subd: 1, clock: organ_clock}},
                    freq: {voice: 1, frequency: 262}
                }
            },
            2: {
                subd: 1,
                val: {
                    atk: {voice: 2, is_attack: 'asdr', dur: {subd: 1, clock: organ_clock}},
                    freq: {voice: 2, frequency: 262}
                } 
            }
        },

        callbacks: () => {
            if (ostinato_loop_count++ === 10) {
                // switch to an infinite loop sans callbacks
                ostinato_params.opt.loop = true;
                ostinato_rhythm.parseConfig(ostinato_params);
                ostinato_rhythm.execute();

                // start tenor
                ostinato_rhythm.parseConfig(ostinato_params);
                ostinato_rhythm.execute();
            }
        }
    };

    // will generate the ostinato rhythmic sequence
    let ostinato_rhythm = Generator(ostinato_clock, ostinato_params);

    // the tenor voice will return to this periodically
    let tonal_center_gesture = {
        0: {
            subd: Math.PI,
            val: {
                atk: {voice: 3, is_attack: 'asdr', dur: {subd: Math.PI, clock: organ_clock}},
                freq: {voice: 3, frequency: 689}
            }
        },
        1: {
            subd: 0.875,
            val: {
                atk: {voice: 3, is_attack: true, smudge: 75},
                freq: {voice: 3, frequency: 661}
            } 
        }
    };

    let tenor_params = {
        opt: {
            loop: 1
        },
        targets: {
            atk: organ.attackTarget,
            freq: organ.pitchTarget
        },
        seq: Object.create(tonal_center_gesture),
        callbacks: function voice() {
            let len = Object.keys(tenor_params.seq).length;
            let freq = util.smudgeNumber(tenor_params.seq[len - 1].val.freq.frequency, 10);

            // worm aroud frequency-wise
            if (freq < 400) {
                freq += 10;
            } else if (freq > 1200) {
                freq -= 10;
            }
            
            // append new step to len
            tenor_params.seq[len] = {
                subd: Math.random() * 0.20,
                val: {
                    atk: {voice: 3, is_attack: true, smudge: 10},
                    freq: {voice: 3, frequency: freq}
                }  
            };

            // ko some steps after we reach a certain sequence length
            let filter_start_len = 10;
            if (len > filter_start_len) {
                let i = (len - filter_start_len + Math.random() * len * 0.5) | 0;
                while (i--) {
                    delete tenor_params.seq[(Math.random() * filter_start_len) | 0];
                }

                // reenumerate object
                // TODO: again, why isn't this an array again?
                let j = 0;
                for (let prop of tenor_params.seq) {
                    tenor_params.seq[j++] = prop;
                }
            }

            // if the sequence exceeds a max length, ko some steps
            let max_length = util.smudgeNumber(80, 15) | 0;
            if (len > max_length) {
                let k = (len + (Math.random() * len * 0.25) - max_length) | 0;
                while (k--) {
                    delete tenor_params.seq[(Math.random() * max_length) | 0];
                }
                tenor_params.seq = util.enumerate(tenor_params.seq);
            }

            if (Math.random() < 0.5) { // sometimes, do this again!
                voice(); 
            } else {
                tenor_rhythm.parseConfig(tenor_params);
                tenor_rhythm.execute();
            }

            // at a certain point, start the alto voice
            if (len >= 20) {
                alto_rhythm.execute();
            }
        }
    };  
    let tenor_clock = new Clock(55),
        tenor_rhythm = new Generator(tenor_clock, tenor_params);


    let alto_count = 0;

    // the frequencies we're going to base the alto voice on
    let alto_mode = [480, 490, 500, 510, 520];

    let make_alto_freq = () => {
        let freq = util.getRndItem(alto_mode);
        if ((alto_count++ % 3) === 0) {
            freq += 0.2 * (alto_count / 3);
        }
        return freq;
    };


    let alto_params = {
        opt: {
            loop: 1
        },
        targets: {
            atk: organ.attackTarget,
            freq: organ.pitchTarget
        },
        seq: {
            0: {
                subd: 8.123,
                val: {
                    atk: {voice: 4, is_attack: true},
                    freq: {voice: 4, frequency: 494}
                }
            },
            1: {
                subd: 8.123,
                val: {
                    atk: {voice: 4, is_attack: true},
                    freq: {voice: 4, frequency: 518}
                }
            }
        },
        callbacks: function() {
            let len = Object.keys(alto_params.seq.length);
            
            alto_params.seq[len] = {
                subd: alto_params.seq[len - 1].subd,
                val: {
                    atk: {voice: 4, is_attack: true, smudge: 10},
                    freq: {voice: 4, frequency: make_alto_freq()}
                }
            }; 

            // cap length of alto sequence to 20
            let max_length = 20;
            if (len > max_length) {
                let i = len - max_length;
                while (i--) {
                    delete alto_params.seq[0];
                    alto_params.seq = util.enumerate(alto_params.seq);
                }
            }    

            alto_rhythm.parseConfig(alto_params);
            alto_rhythm.execute();   
        }
    };

    let alto_rhythm = new Generator(tenor_clock, alto_params);

    ostinato_rhythm.execute();
    organ_clock.start();

    gMap.events.queue('map', 'zoom_changed', () => {
        let zoom = gMap.map.getZoom();
        organ_clock.bpm = 50 - (25 - zoom * 1.25);
        let gain = (() => {
            if (zoom >= 18) {
                return 0.02;   
            } else {
                return 0.45 + (18 - zoom) * 0.0306;
            }
        }());
        organ_convo.gain.linearRampToValueAtTime(
           gain, audioCore.ctx.currentTime + 1
        );
    });


    ////////// secondary audio elements

    
}
