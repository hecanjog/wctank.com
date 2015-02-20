define(
    [
        'audioCore',
        'audioNodes',
        'util'
    ],

function(audioCore, audioNodes, util) { var audioMixer = {};
  
    var soloCnt = 0,
        soloEvent = new Event('trackSoloedStateChange'); 

    // constructFn returns obj in the form {startables: [ ], endpoint: gainnode}
    audioMixer.Track = function(constructFn) {
        var contents, construct,
            created = false;
        
        if (typeof constructFn === 'function') {
            construct = constructFn;
        } else {
            throw new Error('audioMixer.Track constructor requires an argument that is a function');
        }

        var endpoint = {it: {}}, 
            gainParam = {it: {}};
        this._create = function() {
            if (!created) {
                contents = construct();
                if (!contents.startables && !contents.endpoint) {
                    throw new Error('constructFn passed to audioMixer.Track must' +
                            "return an object with 'startables' and 'endpoint' properties");
                } else {
                    created = true;
                    construct = null;
                    endpoint.it = contents.endpoint;
                    gainParam.it = contents.endpoint.gain;
                }
            }
        };
        
        this._destroy = function() {
            //contents.endpoint.disconnect();
            contents = endpoint = gainParam = endpoint.it = gainParam.it = null;
        }; 

        var command = function(cmd) {
            for (var prop in contents.startables) {
                if (contents.startables.hasOwnProperty(prop)) {
                    var it = contents.startables[prop];
                    if (it[cmd]) {
                        it[cmd]();
                        return true;
                    } else {
                        return false;
                    }
                }
            }
        };
        this.start = function() {
            var cmds = ['start', 'play', 'execute'];
            for (var i = 0; i < cmds.length; i++) {
                if (!command(cmds[i])) continue;
                else break;
            }
        };
        this.pause = function() {
            command('pause');
        };
        this.stop = function() {
            var cmds = ['stop', 'shirk'];
            for (var i = 0; i < cmds.length; i++) {
                if (!command(cmds[i])) continue;
                else break;
            }
        };

        this.gain = gainParam.it;
        
        var soloed = false;
        Object.defineProperty(this, 'solo', {
            get: function() { return soloed; },
            set: function(v) {
                if (soloed && !v) soloCnt--;
                else if (v) soloCnt++;
                soloed = v;
                document.dispatchEvent(soloEvent);
            }
        });

        var outer = this; // possible mem leak
        document.addEventListener('trackSoloedStateChange', function() {
            if (soloCnt && outer.soloed) outer.mute = false;
            else if (soloCnt && !outer.soloed) outer.mute = true;
            else if (!soloCnt) outer.mute = false;
        });

        var muted = false,
            last_gain = 0;
        Object.defineProperty(this, 'mute', {
            get: function() { return muted; },
            set: function(v) { 
                muted = v;
                if (muted && last_gain === 0) {
                    last_gain = endpoint.gain.value;
                    endpoint.gain.value = 0;
                } else if (!muted && endpoint.gain.value === 0) {
                    endpoint.gain.value = last_gain;
                    last_gain = 0;
                }
            }
        });

        this._link_alias_out = endpoint.it;
    };
    audioMixer.Track.prototype = new audioCore.AudioModule();

    audioMixer.Bus = function() {
        var tracks = {};

        var input = audioNodes.Gain();
        this.inputGain = input.gain;
        
        var output = audioNodes.Gain();
        this.outputGain = output.gain;

        input.link(output);
        
        var effectsChain = [];
        
        this.addEffect = function(module, index) {
            var idx = index > effectsChain.length ? effectsChain.length : 
                      index < 0 ? 0 : index;

            effectsChain.splice(idx, 0, module); 
        
            var nodeInFront = idx - 1 >= 0 ? effectsChain[idx - 1] : input,
                nodeBehind = idx + 1 <= effectsChain.length ? effectsChain[idx + 1] : output;

            nodeInFront.sever();
            nodeInFront.link(module).link(nodeBehind);
        };

        // args number idx or AudioModule to rm
        this.removeEffect = function(index) {
            var idx = index instanceof audioCore.AudioModule ? effectsChain.indexOf(index) : 
                      index < 0 ? 0 :
                      index >= effectsChain.length ? effectsChain.length - 1 :
                      index;

            if (idx > -1) {
                var nodeInFront = idx - 1 >= 0 ? effectsChain[idx - 1] : input,
                    nodeBehind = idx + 1 <= effectsChain.length ? effectsChain[idx + 1] : output;

                effectsChain.splice(idx, 1);

                nodeInFront.sever();
                nodeInFront.link(nodeBehind);
            } else {
                throw new Error("audioModule not found in effects chain");
            }
        };

        // is completely dereferencing the track after removing it 
        // from the bus a good idea?
        this.removeTrack = function(track) {
            for (var trk in tracks) {
                if (tracks.hasOwnProperty(trk)) {
                    if (track === tracks[trk]) {
                        delete tracks[trk];
                        track._destroy();
                        track = null;
                    }
                }
            } 
        };

        var lla = 0;
        this.addTrack = function() {
            for (var i = 0; i < arguments.length; i++) {
                var trk = arguments[i];
                if (trk instanceof audioMixer.Track || trk instanceof audioMixer.Bus) {
                    trk._create();
                    tracks[lla++] = trk;
                    trk.link(input); 
                }
            }
        };

        var command = function(cmd) {
            for (var trk in tracks) {
                if (tracks.hasOwnProperty(trk)) {
                    tracks[trk][cmd]();
                }
            }
        };

        this.start = function() {
            command('start');            
        };
        this.stop = function() {
            command('stop');
        };
        this.pause = function() {
            command('pause');
        };

        this._create = function() {
            command('_create');           
        };
        this._destroy = function() {
            command('_destroy');
            // and local things too!
        };

        this._link_alias_out = output;
    };
    audioMixer.Bus.prototype = new audioCore.AudioModule();
        
return audioMixer; });
