define( 
    [
        'audio'
    ],
/*
 *  AudioNodes with mixin'd AudioModule - mostly for syntactic sugar.
 */
function(audio) { var nodes = {};
    nodes.Gain = function() { 
        return audio.wrapNode(audio.ctx.createGain());
    };
    nodes.Split = function(channels) { 
        return audio.wrapNode(audio.ctx.createChannelSplitter(channels));
    };
    nodes.Merge = function(channels) {
        return audio.wrapNode(audio.ctx.createChannelMerger(channels));
    };
    nodes.Convolve = function() {
        return audio.wrapNode(audio.ctx.createConvolver()); 
    };
return nodes; });
