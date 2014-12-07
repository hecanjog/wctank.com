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
    
    asdr.Sustain = function(duration, amplitude, modEnv) {
        var mod;
        Object.defineProperty(this, 'modEnv', {
            get: function() { return mod; },
            set: function(val) {
                if (val instanceof envelopeCore.Envelope) {
                    mod = val;
                } else {
                    ASDRComponentException("modEnv must be an instance of envelopeCore.Envelope");
                }
            }
        });

        this.duration = duration;
        this.valueSequence = [ 
            new envelopeCore.EnvelopeValue(amplitude, 0),
            new envelopeCore.EnvelopeValue(amplitude, 100)
        ];
        // alias value sequence into something else,
        // allow updating against modEnv
        // modEnv setter re-bakes valueSequence
        this.modEnv = modEnv; //?

        this.interpolationType = 'none';
        this.interpolationArgs = null;
    };
    asdr.Sustain.prototype = new asdr.ComponentEnvelope();
   
    asdr.A = 0;
    asdr.S = 1;
    asdr.D = 2;
    asdr.R = 3;

    asdr.Generator = function(attack, sustain, decay, release, amplitudePntr) {
        var a, s, d, r, pnt, env, 
            priorScalar = -999;
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

        Object.defineProperty(this, 'amplitudePointer', {
            get: function() { return pnt; },
            set: function(val) {
                if (val < 4) {
                   pnt = val | 0;
                } else {
                    asdrGenException("AMPLITUDEPOINTER must be a NUMBER less than 4 "+
                                     "not "+(typeof val));
                }
            }
        });
       
        this.attack = attack;
        this.sustain = sustain;
        this.decay = decay;
        this.release = release;
        
        if (typeof amplitudePntr !== 'undefined') {
            this.amplitudePointer = amplitudePntr;
        } else {
            this.amplitudePointer = asdf.S; 
        }
    
        this.getASDR = function(durationScalar) {
            if (durationScalar !== priorScalar) {
                env = envelopeCore.concat(durationScalar, a, s, d, r);
                priorScalar = durationScalar; // cache more than one?
            }
            return env;
        };
    };

return asdr; });
