wctank = wctank || {};
wctank.audio = wctank.audio || {};

wctank.audio.actors = (function(actors) {
    var audio = wctank.audio;
    var elements = wctank.audio.elements;
    
    actors.Driver = function(sonority) {
        this.noise = elements.Noise();
     
        this.oscBank = [];
        for (var i = 0; i < num_osc; i++) {
            this.oscBank.push(A.Osc);
            this.noise.link(oscBank[i]);
        }
     
    }; 
    actors.Driver.prototype = new audio.AudioModule();

    return actors;
}({}))
 
/*
 * audio dev whateves
 */
var noise = wctank.audio.elements.Noise(); 
 console.log(noise);
 var bank = [
     wctank.audio.elements.Bandpass(262, 120),
     wctank.audio.elements.Bandpass(327.5, 120),
     wctank.audio.elements.Bandpass(393, 120),
     wctank.audio.elements.Bandpass(500, 120),
 ];
 var censor_out_that_thanks = wctank.audio.elements.Osc('triangle', 440, 0.6);
 censor_out_that_thanks.start();
 console.log(censor_out_that_thanks);
 console.log(bank[2]); 
 for (var i = 0; i < bank.length; i++) {
     noise.link(bank[i]);
     censor_out_that_thanks.link(bank[i]);
 }
 noise.start();
 for (var i = 0; i < bank.length; i++) {
     bank[i].link(wctank.audio.out);
 }
 var vibEve = function() {
     for (var i = 0; i < bank.length; i++) {
         bank[i].accent();
     }
 };
 var turnOff = function() {
     for (var i = 0; i < bank.length; i++) {
         bank[i].fadeInOut(2000);//util.smudgeNumber(10000, 50));
     }
 };
 var whatever = 0;
 wctank.glissDbg = function(freq, time) {
     whatever = freq * 0.75;
     for (var i = 0; i < bank.length; i++) {
         bank[i].setFrequency(whatever, time);
         whatever *= 1.10;
     }
     censor_out_that_thanks.setFrequency(freq, time);
 };
 wctank.gMap.events.push(wctank.gMap.events.MAP, 'zoom_changed', function() {
     google.maps.event.addListener(wctank.gMap.map, 'zoom_changed', turnOff);
 }, true); 
 wctank.gMap.events.push(wctank.gMap.events.MAP, 'drag', vibEve);
 

