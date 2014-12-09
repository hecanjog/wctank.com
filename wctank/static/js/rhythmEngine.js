define(
    [

    ],

function() { var rhythmEngine = {};
   
    rhythmEngine.Engine;
// 
    /*
     *  The RhythmicActionInterface is constructed within AudioModules or Visual Effects 
     *  that perform actions that should be rhythmized, and provides a standard interface
     *  for objects to interact with the RhythmEngine object  
     */ 
    rhythmEngine.ActionInterface = function(scope) {
        var actions = {};
        
        Object.defineProperty(scope, "_actions", {
            get: function() { return actions; }
        }); 
        
        var checkRAIParam = function(name, type, val) {
            if (typeof val !== type)   
                throw "RhythmicActionInterface param error: " + name + " must be a " + 
                    type + "not " + val + " which is (a) " + typeof val;
        };

        function RhythmicAction(trigger, validation, minTime, isAudio) {
            this.trigger = trigger;
            this.validation = validation;
            this.minTime = minTime;
            this.isAudio = isAudio;
        } 
        this.create = function(name, trigger, validation, minTime, isAudio) {
            checkRAIParam("NAME", "string", name);
            checkRAIParam("TRIGGER", "function", trigger);
            checkRAIParam("VALIDATION", "function", validation);
            checkRAIParam("MINTIME", "number", minTime);
            checkRAIParam("ISAUDIO", "boolean", isAudio);

            if (typeof actions[name] !== "undefined") {
                throw "RhythmicActionInterface param error: action name already exists!";
            } else {
                actions[name] = new RhythmicAction(trigger, validation, minTime, isAudio);
            }
        };
    };

    

return rhythmEngine; });
