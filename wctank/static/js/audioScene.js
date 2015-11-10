import * as gMap from "./gMap";
import * as renderLoop from "lib/rudy/renderLoop";
import * as featureDetection from "./featureDetection";
import * as instruments from "./instruments";
import * as audioCore from "lib/rudy/audio/core";
import * as util from "lib/rudy/util";
import { Convolution } from "lib/rudy/audio/modules/Convolution";
import { Clock } from "lib/rudy/rhythm/Clock";
import { Generator } from "lib/rudy/rhythm/Generator";


// everything in here can only be executed if webaudio exists,
// so... this is a big method.
export function init() 
{
    audioCore.init();
    
    let n_voices = 4,
        n_partials = 20,
        q_value = 250;

    // main instrument for bass ostinato, 'alto' and 'tenor' voices
    let organ = new instruments.SubtractiveOrgan(n_voices, n_partials, q_value);
    organ.gain.value = 1;

    // convolve the organ with an ir for reverb
    let organ_convo = new Convolution(`/static/assets/york-minster${featureDetection.audioext}`);
    organ_convo.wetDry(100);
    organ_convo.gain.value = 0.4;

    organ.link(organ_convo).link(audioCore.out);
    
    let main_clock = new Clock(50, 3);

    // ostinato parameters
    let loop_count = 0;
    let current_voice = 1;
    let longest_subdivision = 8;
    let params = {
        opt: {
            loop: 1  // execute callback after each loop
        },
        targets: {
            attack: organ.attackTarget,
            frequency: organ.pitchTarget
        },
       
        // TODO: this probably should just be an array?
        // or was there a reason seq was an object?
        seq: {
            0: {
                subd: longest_subdivision,
                val: {
                    attack: {voice: 0, is_attack: true},
                    frequency: {voice: 0, frequency: 80}
                }
            }
        },

        callbacks: () => {
            let len = Object.keys(params.seq).length;

            params.seq[len] = {};
            
            params.seq[len].subd = params.seq[len - 1].subd * (Math.random() * 0.2 + 0.8);
            
            params.seq[len].val = {}; 
            let val = params.seq[len].val;
            
            val.attack = {};
            val.attack.voice = current_voice;
            val.attack.is_attack = Math.random() > 0.5 ? 'asdr' : true;
            val.attack.dur = {};
            val.attack.dur.subd = val.attack.is_attack === 'asdr' ? 
                                  params.seq[len].subd * 0.1 : 
                                  1;
            val.attack.dur.clock = main_clock;
            
            val.frequency = {};
            val.frequency.voice = current_voice;
            
            let last_freq = params.seq[len - 1].val.frequency.frequency;
            loop_count++;
            val.frequency.frequency = last_freq + (last_freq / loop_count) - (1 * loop_count);
            
            current_voice = (current_voice + 1) %  n_voices;

            rhythm.parseConfig(params);
            rhythm.execute();

            if ((loop_count % 10) === 0) {
                rhythm.shirk();
                window.setTimeout(() => {
                    rhythm.parseConfig(params);
                    rhythm.execute(); 
                }, 20000);
            }
        }
    };

    let rhythm = new Generator(main_clock, params);

    let getVoice = () => (Math.random() * n_voices) | 0;

    let inital_voice = getVoice()
     
    let stab_params = {
        opt: {
            loop: 1
        },
        targets: {
            attack: organ.attackTarget,
            frequency: organ.pitchTarget
        },
        seq: {
            0: {
                subd: 8,
                val: {
                    attack: {voice: inital_voice, is_attack: 'true'},
                    frequency: {voice: inital_voice, frequency: 440}
                }
            }, 
            1: {
                subd: 1,
                val: {
                    attack: {
                        voice: (inital_voice + 1) % n_voices,
                        is_attack: 'asdr',
                        dur: {subd: util.smudgeNumber(1, 50), clock: main_clock}
                    },
                    frequency: {voice: inital_voice, frequency: 500}
                }
            }
        },
        callbacks: () => {
            let new_voice = getVoice();
            for (let i = 0; i < 2; i++) {
                let cur_voice = (new_voice + i) % n_voices;
                stab_params.seq[i].val.frequency.voice = cur_voice;
                stab_params.seq[i].val.attack.voice = cur_voice;   
            }
            
            stab_rhythm.parseConfig(stab_params);
            stab_rhythm.execute();
        }
    };
    
    let stab_rhythm = new Generator(main_clock, stab_params);

    organ.start();
    main_clock.start();
    rhythm.execute();
    stab_rhythm.execute();
}
