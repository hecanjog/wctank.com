define(
    [
        'envelopeCore',
        'util'
    ],

function(envelopeCore, util) { var asdr = {};

    asdr.ComponentEnvelope = function(duration, interpolationType, 
                                      interpolationArgs, valueSequence) {
        
        envelopeCore.Envelope.call(this);
       
        var ASDRComponentException = function(text) {
            throw new Error("ASDRComponent param error: " + text);
        };
        var checkAmpComponentParam = function(val) {
            if (val.value < 0 || val.value > 1) {
                ASDRComponentException(" must be a number between " + 
                    "0 and 1 inclusive or null not " + val);
            }
        };

        var vsAssessors = Object.getOwnPropertyDescriptor(this, 'valueSequence');
        Object.defineProperty(this, 'valueSequence', {
            get: vsAssessors.get,
            set: function(val) {
                vsAssessors.set(val, false, checkAmpComponentParam);                       
            }
        });

        if (duration) this.duration = duration;
        if (interpolationType) this.interpolationType = interpolationType;
        if (interpolationArgs) this.interpolationArgs = interpolationArgs;
        if (valueSequence) this.valueSequence = valueSequence;
    };
    asdr.ComponentEnvelope.prototype = Object.create(envelopeCore.Envelope.prototype);
    asdr.ComponentEnvelope.prototype.constructor = asdr.ComponentEnvelope;
    
    asdr.Sustain = function(duration, amplitude) {
        var outer = this;
        asdr.ComponentEnvelope.call(this);

        this.duration = duration;
      
        this._vs; 
        this._cookedVs;
        this._cooked = false;
        this._priorBakeParams = {};

        Object.defineProperty(this, 'valueSequence', {
            get: function() { 
                if (!outer._cooked) {
                    return outer._vs;
                } else {
                    return outer._cookedVs;
                }
            },
            set: function(v) {
                outer.unBake();
                outer._vs = v;
                outer._cookedVs = null;
            }
        });
        var checkAmpValue = function(n) {
            if (n < 0 || n > 1) {
                throw new RangeError("invalid asdr.Sustain param: amplitude must be a value "+
                        "between 0 and 1 inclusive");
            }
        };
        var setValSeq = function(n) {
            outer.valueSequence = [ 
                new envelopeCore.EnvelopeValue(n, 0),
                new envelopeCore.EnvelopeValue(n, 99)
            ];
        };
        checkAmpValue(amplitude);
        setValSeq(amplitude);
       
        var amp; 
        Object.defineProperty(this, 'amplitude', {
            get: function() { return amp; },
            set: function(val) {
                checkAmpValue(val);
                amp = val;
                setValSeq(val);
                if (outer._cooked) {
                    outer.bake(_priorBakeParams.modEnv, 
                               _priorBakeParams.modDurPercent,
                               _priorBakeParams.refractMag );
                }            
            }
        });
        if (amplitude) this.amplitude = amplitude;

        this.interpolationType = 'none';
        this.interpolationArgs = null;
    };
    asdr.Sustain.prototype = Object.create(asdr.ComponentEnvelope.prototype);
    asdr.Sustain.prototype.constructor = asdr.Sustain;

    var dummy = new envelopeCore.Envelope();
    
    asdr.Sustain.prototype.bake = function(modEnv, modDurPercent, refractMag) {
        if (modEnv instanceof envelopeCore.Envelope) {
            dummy.valueSequence = this._vs;
            this.interpolationType = dummy.interpolationType = modEnv.interpolationType;
            this.interpolationArgs = dummy.interpolationArgs = modEnv.interpolationArgs;
            dummy.duration = modEnv.duration; 
            this._cookedVs = dummy.bake(modEnv, modDurPercent, refractMag).valueSequence;
            this._cooked = true;
            this._priorBakeParams = { modEnv: modEnv, 
                                      modDurPercent: modDurPercent, 
                                      refractMag: refractMag };

        } else if (dummy.valueSequence[0] && !this._cooked) {
            this.interpolationType = dummy.interpolationType;
            this._cooked = true; 
        } else {
            console.warn("asdr.Sustain.bake called sans arguments without a prior "+
                        ".bake and .unBake - no action taken.");
        }
    };
    
    asdr.Sustain.prototype.unBake = function() {
        this.interpolationType = 'none';
        this.interpolationArgs = null;
        this._cooked = false;
    };

    asdr.Generator = function(attack, sustain, decay, release) {
        var a, s, d, r, env, as, dr, 
            changed = false,
            priorDuration = -999;
        
        var asdrGenException = function(text) {
            throw new TypeError("Invalid asdr.Generator param: " + text);
        };
        var checkEnvelope = function(name, env) {
            if ( (!env instanceof asdr.ComponentEnvelope) ) {
                asdrGenException(name+" envelope must be "+
                    "an instance of asdr.ComponentEnvelope, not "+val);
            }
        };
       
        var adrSet = function(env, name) {
            checkEnvelope(name, env);
            changed = true;
            var keys = [];
            for (var key in env) {
                keys.push(key);
            }
            util.watchProperty(env, 'duration', function() {
                changed = true;
            });
        };

        Object.defineProperties(this, {
            'attack': {
                get: function() { return a; },
                set: function(val) { 
                    adrSet(val, 'ATTACK');
                    a = val;
                }
            },
            'decay': {
                get: function() { return d; },
                set: function(val) { 
                    adrSet(val, 'DECAY');
                    d = val;
                }

            },
            'release': {
                get: function() { return r; },
                set: function(val) { 
                    adrSet(val, 'RELEASE');
                    r = val;
                }
            }
        });

        Object.defineProperty(this, 'sustain', {
            get: function() { return s; },
            set: function(val) {
                if ( !(val instanceof asdr.Sustain) ) {
                    asdrGenException("SUSTAIN envelope must be "+
                        "an instance of asdr.Sustain, not "+val);
                } else {
                    s = val;
                    changed = true;
                    util.watchProperty(val, ['duration', 'valueSequence'], function() {
                        changed = true;
                    });
                } 
            }
        }); 
        
        var aIsComponent = attack instanceof asdr.ComponentEnvelope;   

        if (aIsComponent) this.attack = attack;
        if (sustain) this.sustain = sustain;
        if (decay) this.decay = decay;
        if (release) this.release = release;

        var parseStage = function(o) {
            var inter_type, inter_args;
            
            var dur = o.dur;
            if ('inter' in o) {
                inter_type = o.inter.type;
                inter_args = o.inter.args ? o.inter.args : null;
            } else {
                inter_type = 'none';
                inter_args = null;
            }
            
            var r = new asdr.ComponentEnvelope(dur, inter_type, inter_args, 
                envelopeCore.arrayToEnvelopeValues(o.val));

            return r;
        };

        // construct with object
        if ( !aIsComponent && ('a' in attack) && ('s' in attack) &&
            ('d' in attack) && ('r' in attack) ) {
            this.attack = parseStage(attack.a);
            this.sustain = new asdr.Sustain(attack.s.dur, attack.s.val);
            this.decay = parseStage(attack.d);
            this.release = parseStage(attack.r);
        }
      
        var generator = this; 
        var updateEnv = function(dur) {
            if (!env || (typeof dur === 'number' && dur !== priorDuration) || changed) {
                var absA = generator.attack.toAbsolute(),
                    absS = generator.sustain.toAbsolute(dur),
                    absD = generator.decay.toAbsolute(),
                    absR = generator.release.toAbsolute();
               
                as = envelopeCore.concat(absA, absS);
                dr = envelopeCore.concat(absD, absR);
                env = envelopeCore.concat(absA, absS, absD, absR);
                priorDuration = dur;
                changed = false;

            }
        }; 
        
        // TODO: allow variable durations in attack and decay stages
        this.getAS = function() {
            updateEnv();
            return as;
        };
        this.getDR = function() {
            updateEnv();
            return dr;
        };

        this.getASDR = function(sustainDuration) {
            updateEnv(sustainDuration);
            return env;
        };
    };

    asdr.clipValueSequence = function(env) {
        env.valueSequence.forEach(function(v) {
            if (v.value > 1) v.value = 1;
            if (v.value < 0) v.value = 0;
        });
    };

    // a collection of useful param objs to construct envelopeAsdr.Generators with
    asdr.presets = {
        roughStart: {
            a: {
                dur: 100,
                inter: {type: 'none'},
                val: [0.01, 0,      1, 10,
                      0.2, 20,      0.9, 30,
                      0.4, 40,      0.8, 50,
                      0.3, 57,      0.75, 64,
                      0.45, 73,     0.83, 83,
                      0.15, 90,     1, 99]
            },
            s: {
                dur: 100,
                val: 1
            },
            d: {
                dur: 200,
                inter: {type: 'linear'},
                val: [1, 0,  0.5, 99]              
            },
            r: {
                dur: 50,
                inter: {type: 'linear'},
                val: [0.5, 0,  0.01, 99]
            }
        }
    };
return asdr; });
