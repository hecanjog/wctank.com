define(
    [
        'envelopeCore'
    ],

function(envelopeCore) { var asdr = {};

    asdr.ComponentEnvelope = function(duration, interpolationType, 
                                      interpolationArgs, valueSequence) {
        var ASDRComponentException = function(text) {
            throw "ASDRComponent param error: " + text;
        };
        var checkAmpComponentParam = function(name, val) {
            if ( (val < 0) || (val > 1) ) {
                ASDRComponentException(name+" must be a number between " + 
                    "0 and 1 inclusive or null not " + val);
            }
        };
        
        var seq = [];
        var checkEnvelopeValue = function(val) {
            if ( !(val instanceof envelopeCore.EnvelopeValue) ) {
                ASDRComponentException("valueSequenceItem must be an instance of "+
                                       "envelopeCore.EnvelopeValue");
  
            }
            checkAmpComponentParam('valueSequenceItem.value item', val.value);
            if ( (val.time < 0) || (val.time > 100) ) {
                ASDRComponentException("valueSequenceItem.time must be "+
                                       "a percentage between 0 and 100 inclusive");

            }
            
        };
        Object.defineProperty(this, 'valueSequence', {
            get: function() { return seq; },
            set: function(val) {
                if (Array.isArray(val)) {
                    val.forEach(function(item) {
                        checkEnvelopeValue(item); //?
                        seq.push(item);
                    });
                } else {
                    checkEnvelopeValue(val); //?
                    seq.push(val);
                }
            }
        });
        
        if (duration) this.duration = duration;
        if (interpolationType) this.interpolationType = interpolationType;
        if (interpolationArgs) this.interpolationArgs = interpolationArgs;
        if (valueSequence) this.valueSequence = valueSequence;
    };
    asdr.ComponentEnvelope.prototype = new envelopeCore.Envelope();
    
    asdr.Sustain = function(duration, amplitude) {
        this.duration = duration;
       
        var vs, cookedVs,
            cooked = false;

        var checkAmpValue = function(n) {
            if ( (n < 0) || (n > 1) ) {
                throw "invalid asdr.Sustain param: amplitude must be a value "+
                        "between 0 and 1 inclusive";
            }
        };
        var setValSeq = function(n) {
            vs = [ 
                new envelopeCore.EnvelopeValue(n, 0),
                new envelopeCore.EnvelopeValue(n, 99)
            ];
        };

        checkAmpValue(amplitude);
        setValSeq(amplitude);
        
        Object.defineProperty(this, 'amplitude', {
            get: function() { return amp; },
            set: function(val) {
                checkAmpValue(val);
                amp = val;
                setValSeq(val);
                if (cooked) {
                    rebake();
                }            
            }
        });
        if (amplitude) this.amplitude = amplitude;
        
        Object.defineProperty(this, 'valueSequence', {
            get: function() { 
                if (!cooked) {
                    return vs;
                } else {
                    return cookedVs;
                }
            }
        });

        var interType = 'none';
        Object.defineProperty(this, 'interpolationType', {
            get: function() { return interType; }
        });
        this.interpolationArgs = null;
        
        var dummy = new envelopeCore.Envelope();
        this.bake = function(modEnv, modDurPercent, refractMag) {
            if (modEnv instanceof envelopeCore.Envelope) {
                dummy.valueSequence = vs;
                interType = dummy.interpolationType = modEnv.interpolationType;
                this.interpolationArgs = dummy.interpolationArgs = modEnv.interpolationArgs;
                dummy.duration = modEnv.duration; 
                cookedVs = dummy.bake(modEnv, modDurPercent, refractMag).valueSequence;
                cooked = true;
            } else if ( (typeof dummy.valueSequence[0].value === 'number') && !cooked) {
                interType = dummy.interpolationType;
                cooked = true; 
            } else {
                console.warn("asdr.Sustain.bake called sans arguments without a prior "+
                            ".bake and .unBake - no action taken.");
            }
        };
        this.unBake = function() {
            interType = 'none';
            this.interpolationArgs = null;
            cooked = false;
        };

    };
    asdr.Sustain.prototype = new asdr.ComponentEnvelope();
   
    asdr.A = 0;
    asdr.S = 1;
    asdr.D = 2;
    asdr.R = 3;

    var parent = asdr;

    asdr.Generator = function(attack, sustain, decay, release) {
        var a, s, d, r, env, 
            priorDuration = -999;
        var asdrGenException = function(text) {
            throw "Invalid asdr.Generator param: " + text;
        };
        var checkEnvelope = function(name, env) {
            if ( (!env instanceof asdr.ComponentEnvelope) ) {
                asdrGenException(name+" envelope must be "+
                    "an instance of asdr.ComponentEnvelope, not "+val);
            }
        };
        
        Object.defineProperty(this, 'attack', {
            get: function() { return a; },
            set: function(val) { 
                checkEnvelope('ATTACK', val);
                a = val;
            }
        }); 
       
        Object.defineProperty(this, 'sustain', {
            get: function() { return s; },
            set: function(val) {
                if ( !(val instanceof parent.Sustain) ) {
                    asdrGenException("SUSTAIN envelope must be "+
                        "an instance of asdr.Sustain, not "+val);
                } else {
                    s = val;
                } 
            }
        }); 
        
        Object.defineProperty(this, 'decay', {
            get: function() { return d; },
            set: function(val) { 
                checkEnvelope('DECAY', val);
                d = val;
            }
        });

        Object.defineProperty(this, 'release', {
            get: function() { return r; },
            set: function(val) {
                checkEnvelope('RELEASE', val);
                r = val;
            }
        });
   
        this.attack = attack;
        this.sustain = sustain;
        this.decay = decay;
        this.release = release;

        this.getASDR = function(sustainDuration) {
            if (!env || (sustainDuration !== priorDuration)) {
                var absA = this.attack.toAbsolute(this.attack.duration),
                    absS = this.sustain.toAbsolute(sustainDuration),
                    absD = this.decay.toAbsolute(this.decay.duration),
                    absR = this.release.toAbsolute(this.release.duration);
                
                env = envelopeCore.concat(absA, absS, absD, absR);
            }
            return env;
        };
    };

return asdr; });
