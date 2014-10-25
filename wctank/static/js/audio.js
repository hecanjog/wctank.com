var audio = (function(audio) {
    wctank.util.aliasNamespace.call(audio.prototype);
    var actx = new (window.AudioContext || window.webkitAudioContext)();  
    
    // make a white noise buffer source
    var noise = (function() {
        var sr = actx.sampleRate;
        var samples = sr * 2.5;
        var noise_buf = actx.createBuffer(2, samples, sr);
        for (var channel = 0; channel < 2; channel++) {
            var channelData = noise_buf.getChannelData(channel);
            for (var i = 0; i < samples; i++) {
                channelData[i] = Math.random() * 2 - 1;
            }
        }
        var source = actx.createBufferSource();
        source.buffer = noise_buf;
        source.loop = true;
        return source;
    }())
    noise.connect(actx.destination);
    audio.start = function() {
        noise.start();
    };
    
    return audio;
}({}))
