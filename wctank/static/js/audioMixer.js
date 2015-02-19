define(
    [
        'audioCore',
        'audioNodes',
        'util'
    ],

function(audioCore, audioNodes, util) { var audioMixer = {};
   
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
            contents.endpoint.disconnect();
            contents = endpoint = gainParam = endpoint.it = gainParam.it = null;
            bus.removeTrack(this);
        }; 
        this._nullBusref = function() {
            bus = null;
        };

        var command = function(cmd) {
            for (var prop in contents.startables) {
                if (contents.startables.hasOwnProperty(prop)) {
                    var it = contents.startables[prop];
                    if (it[cmd]) it[cmd]();
                }
            }
        };
        this.start = function() {
            command('start');
        };
        this.pause = function() {
            command('pause');
        };
        this.stop = function() {
            command('stop');
        };

        this.gain = gainParam.it;
        
        var bus;
        this._busLink = function(busRef) {
            bus = busRef;
        };
        
        var soloed = false;
        Object.defineProperty(this, 'solo', {
            get: function() { return soloed; },
            set: function(v) {
                if (bus instanceof audioMixer.Bus) {
                    soloed = v;
                    bus._soloTracks();
                } else {
                    throw new Error("");
                } 
            }
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
       
        var gain = audioNodes.Gain();
        this.gain = gain.gain;

        this._soloTracks = function() {
            var isSoloing = false;
            for (var trk in tracks) {
                if (tracks.hasOwnProperty(trk)) {
                    if (!tracks[trk].solo) {
                        tracks[trk].mute = true;
                        isSoloing = true;
                    }
                }
            }
            if (!isSoloing) {
                for (var trk in tracks) {
                    if (tracks.hasOwnProperty(trk)) {
                        tracks[trk].mute = false;
                    }
                }
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
                        track._nullBusref();
                        track = null;
                    }
                }
            } 
        };

        var lla = 0,
            outer = this;
        this.addTrack = function(trk) {
            if (trk instanceof audioMixer.Track) {
                trk._create();
                tracks[lla++] = trk;
                trk._busLink(outer);
                trk.link(gain); 
            }
        };
        
        this._link_alias_out = gain;
    };
    audioMixer.Bus.prototype = new audioCore.AudioModule();
        
return audioMixer; });
