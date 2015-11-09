/**
 * Instruments we're using in our sound enviornment.
 * All subclass lib/rudy/rudy/instrument/Instrument
 * @module instruments
 */


import { Instrument } from "lib/rudy/instrument/Instrument";
import { ParameterizedAction } from "lib/rudy/instrument/ParameterizedAction";
import { SamplePlayer } from "lib/rudy/audio/modules/SamplePlayer";
import { MediaElementPlayer } from "lib/rudy/audio/modules/MediaElementPlayer";
import { Bandpass } from "lib/rudy/audio/modules/Bandpass";
import { Noise } from "lib/rudy/audio/modules/Noise";
import * as moduleExtensions from "lib/rudy/audio/moduleExtensions";
import * as audioNodes from "lib/rudy/audio/nodes";
import * as envelopeAsdr from "lib/rudy/rhythm/envelope/asdr";
import * as envelopeCore from "lib/rudy/rhythm/envelope/core";
import * as featureDetection from "./featureDetection";


export class BigEarEnviron extends Instrument
{
    constructor()
    {
        super();

        this.player = 
            new MediaElementPlayer(`/streaming/bigearsample.6${featureDetection.audioext}`);

        this.player.loop = true;
        this.player.autoplay = true;

        this._link_alias_out = this.player;
    }
}


let bpBank = Symbol();


class OrganVoice extends Instrument
{
    constructor(partials, q)
    {
        super();

        let sigIn = audioNodes.Gain(),
            sigOut = audioNodes.Gain();

        this[bpBank] = [];

        this.gain = sigOut.gain;
        this.gain.value = 0;
        
        for (let i = 0; i < partials; i++) {
            let bp = new Bandpass(100, q);
            this[bpBank].push(bp);
            sigIn.link(bp).link(sigOut);
        }

        this._link_alias_in = sigIn;
        this._link_alias_out = sigOut;

        this.attackTarget = new ParameterizedAction(this.gain);
        this.attackTarget.createEnvelope = env => {
            this.attackTarget.envelope = env;
            this.attackTarget.execute();
        };
    }

    setFrequency(freq)
    {
        for (let i = 0; i < this[bpBank].length; i++) {
            this[bpBank][i].setFrequency(freq + freq * i);
            let gain = 1 / (i + 1);
            if ((i + 1) % 3 === 0) gain += 0.1;
            this[bpBank][i].setGain(gain);
        }
    }
}


// an instrument that drives a bank of high-q bandpass filters
// with a noise generator
export class SubtractiveOrgan extends Instrument
{
    constructor(max_voices, partials_per_voice, q_value) 
    {
        super();

        let m_voices = max_voices ? max_voices : 10,
            partials = partials_per_voice >= 0 ? partials_per_voice : 10,
            q = q_value >= 0 ? q_value : 250;

        let atten = audioNodes.Gain(),
            sigOut = audioNodes.Gain();
        atten.link(sigOut);
        
        this.gain = sigOut.gain;
        this._link_alias_out = sigOut;

        // noise driver
        let noise = new Noise();
        moduleExtensions.startStopThese(this, noise); 

        let voices = [];

        for (let i = 0; i < m_voices; i++) {
            let v = new OrganVoice(partials, q);
            noise.link(v).link(atten);
            voices.push(v);
        }

        // action to change pitch of individual voices
        // the form of the pitchTarget paramObj is:
        //      {
        //          voice: {number} - idx of voice
        //          frequency: {number} - freq of indicated voice
        //      }
        this.pitchTarget = new ParameterizedAction((params) => 
            voices[params.voice].setFrequency(params.frequency)
        );

        let ptargEnv = new envelopeCore.Envelope();
        ptargEnv.duration = 25;
        ptargEnv.interpolationType = "none";

        this.pitchTarget.createEnvelope = (params) => {
            ptargEnv.valueSequence = new envelopeCore.EnvelopeValue(params, 0);
            return ptargEnv.toAbsolute();
        };

        let attackAsdr = new envelopeAsdr.Generator({
            a: {
                dur: 200,
                inter: {type: 'exponential'},
                val: [0.01, 0,  1, 99]
            },
            s: {
                dur: 100,
                val: 1
            },
            d: {
                dur: 50,
                inter: {type: 'linear'},
                val: [1, 0,  0.7, 99]
            },
            r: {
                dur: 50,
                inter: {type: 'linear'},
                val: [0.7, 0,  0.5, 99]
            }
        });

        // the form of the attackTarget paramObj is:
        //
        //      {
        //          isAttack: {boolean | String} true for attack, false for release,
        //                  'asdr' for full envelope
        //          voices: [array of voice idxs to trigger]
        //          dur: {
        //              subd: if 'asdr', provide duration
        //              clock: clock ref
        //          }
        //      }
        this.attackTarget = new ParameterizedAction(params => {
            let createEnvelope = voices[params.voice].attackTarget.createEnvelope;

            if (params.is_attack === 'asdr') {
                let dur = params.dur.subd * params.dur.clock.beatLength,
                    sus_len = dur - (attackAsdr.attack.duration + attackAsdr.decay.duration +
                        attackAsdr.release.duration);
                createEnvelope(attackAsdr.getASDR(sus_len));
            } else if (params.is_attack) {
                createEnvelope(attackAsdr.getAS());
            } else {
                createEnvelope(attackAsdr.getDR());
            }
        });

        let atargEnv = new envelopeCore.Envelope();
        atargEnv.duration = 50;
        atargEnv.interpolationType = 'none';

        this.attackTarget.createEnvelope = params => {
            atargEnv.valueSequence = new envelopeCore.EnvelopeValue(params, 0);
            return atargEnv.toAbsolute();
        };
    }
}
