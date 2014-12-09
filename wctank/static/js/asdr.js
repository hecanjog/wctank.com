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
            if ( (val < 0) || (val > 1) || (val !== null) ) {
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
            checkAmpComponentParam('valueSequenceItem.value item', item.value);
            if ( (val.time < 0) || (item.time > 100) ) {
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

        this.duration = duration;
        this.interpolationType = interpolationType;
        this.interpolationArgs = interpolationArgs;
        this.valueSequence = valueSequence;
    };
    asdr.ComponentEnvelope.prototype = new envelopeCore.Envelope();
    
    asdr.Sustain = function(duration, amplitude, modEnv, modEnvDurPercent) {
        this.duration = duration;
        
        var ownVS, cookedVS;
        Object.defineProperty(this, 'valueSequence', {
            get: function() { return cookedVS ? cookedVS : ownVS; }
        });
        
        ownVS = [ 
            new envelopeCore.EnvelopeValue(amplitude, 0),
            new envelopeCore.EnvelopeValue(amplitude, 100)
        ];

        this.interpolationType = 'none';
        this.interpolationArgs = null;

        var reBake = function(env, mev, mevpercent) {
            cookedVS = null;
            var cookedEnv = envelopeCore.bake(env, mev, mevpercent);
            cookedVS = cookedEnv.valueSequence;
        };

        //TODO: bug - may bake twice on initialization
        var m, medp,
            parent = this;
        Object.defineProperty(this, 'modEnv', {
            get: function() { return m; },
            set: function(val) {
                rebake(parent, val, medp);
                m = val;
            }
        });

        Object.defineProperty(this, 'modEnvDurPercent', {
            get: function() { return medp; },
            set: function(val) {
                rebake(parent, m, val);
                medp = val;
            }
        });

        if (typeof modEnv !== 'undefined') {
            this.modEnvDurPercent = modEnvDurPercent ? modEnvDurPercent : 100;
            this.modEnv = modEnv;
        }
    };
    asdr.Sustain.prototype = new asdr.ComponentEnvelope();
   
    asdr.A = 0;
    asdr.S = 1;
    asdr.D = 2;
    asdr.R = 3;

    asdr.Generator = function(attack, sustain, decay, release) {
        var a, s, d, r, env, 
            priorDuration = -999;
        var asdrGenException = function(text) {
            throw "Invalid asdr.Generator param: " + text;
        };
        var checkEnvelope = function(name, env) {
            if ( (!env instanceof asdr.ComponentEnvelope) ) {
                asdrGenException(name+" envelope must be "+
                    "an instance of asdr.ComponentEnvelope, not "+val.constructor.name);
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
                if ( !(val instanceof asdr.Sustain) ) {
                    asdrGenException("SUSTAIN envelope must be "+
                        "an instance of asdr.Sustain, not "+val.constructor.name);
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
                var absA = this.attack.toAbsolute(),
                    absS = this.sustain.toAbsolute(sustainDuration),
                    absD = this.decay.toAbsolute(),
                    absR = this.release.toAbsolute();
                
                env = envelopeCore.concat(absA, absS, absD, absR);
            }
            return env;
        };
    };

return asdr; });
