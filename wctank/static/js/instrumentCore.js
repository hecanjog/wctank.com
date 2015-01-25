define(
    [
        'audioCore',
        'envelopeCore'
    ],

function(audioCore, envelopeCore) { var instrumentCore = {};

    instrumentCore.ParameterizedAction = function(target, envelope) {
        var outer = this;
        
        var throwActionTypeError = function(mess) {
            throw new TypeError("Invalid instrumentCore.ParameterizedAction param: " + mess); 
        };

        var tget, env, type;
        Object.defineProperty(this, 'target', {
           get: function() { return tget; },
           set: function(val) {
                if (val instanceof AudioParam) {
                    tget = val;
                    type = 'AudioParam';
                } else if (typeof val === 'function') {
                    tget = val;
                    type = 'function';
                } else {
                    throwActionTypeError(".target must be an instance of "+
                                         "AudioParam or a function.");
                }
           }
        });
        if (target) this.target = target; 

        Object.defineProperty(this, 'type', {
            get: function() { return type; },
        });

        Object.defineProperty(this, 'envelope', {
            get: function() { return env; },
            set: function(val) {
                if (val instanceof envelopeCore.AbsoluteEnvelope) {
                    env = val;
                } else {
                    throwActionTypeError(".envelope must be an instance of "+
                                         "envelopeCore.AbsoluteEnvelope.");
                }
            }
        });
        if (envelope) this.envelope = envelope;

        this.execute = function(offset) {
            envelopeCore.apply(this.target, this.envelope, offset);
        };
  
        /*
         * Override createEnvelope with a function that can be called to generate a new
         * envelope for this ParameterizedAction. rhythm.Generator will call this and apply the
         * envelope returned, unless this value is left falsy, in which case it will use
         * this.envelope.
         */ 
        this.createEnvelope = null;
    };

    instrumentCore.Instrument = function() {
        /*
         * Optional: override .actionTarget with a ref to a parameterized action that 
         * can be called by rhythm.Generator. Otherwise, target specific nodes in the 
         * Generator config.
         */
        this.actionTarget;
    };
    instrumentCore.Instrument.prototype = new audioCore.AudioModule();

return instrumentCore; });
