define( 
    [
        'audioCore'
    ],
/*
 *  AudioNodes with mixin'd AudioModule mostly for syntactic sugar.
 */
function(audioCore) { var nodes = {};
    nodes.Gain = function() { 
        return audioCore.wrapNode(audioCore.ctx.createGain());
    };
    nodes.Split = function(channels) { 
        return audioCore.wrapNode(audioCore.ctx.createChannelSplitter(channels));
    };
    nodes.Merge = function(channels) {
        return audioCore.wrapNode(audioCore.ctx.createChannelMerger(channels));
    };
    nodes.Convolve = function() {
        return audioCore.wrapNode(audioCore.ctx.createConvolver()); 
    };
    nodes.Delay = function(delay) {
        return audioCore.wrapNode(audioCore.ctx.createDelay(delay));
    };
    nodes.Biquad = function(type, frequency, Q) {
        var bq = audioCore.wrapNode(audioCore.ctx.createBiquadFilter());
        if (type) bq.type = type;
        if (frequency) bq.frequency.value = frequency;
        if (Q) bq.Q.value = Q;
        return bq;
    };
    nodes.MediaElementSource = function(elem) {
        return audioCore.wrapNode(audioCore.ctx.createMediaElementSource(elem));
    };
return nodes; });
