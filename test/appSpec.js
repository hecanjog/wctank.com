/*
 * Nowhere close to great test coverage; just where
 * convenient, I suppose.
 */
define(
    [
        'wctank/static/js/envelopeCore'
    ],
function(envelopeCore) {
    describe("Envelope Core", function() {
        var env = new envelopeCore.Envelope();
        env.duration = 1000;
        env.valueSequence.push(new envelopeCore.EnvelopeValue(20, 50));
        env.interpolationType = "linear";

        it("envelopeCore.concat adds durations", function() {
            var abs = env.toAbsolute(5000),
                abs2 = env.toAbsolute(3000);
            
            var cat = envelopeCore.concat(abs, abs2);
            expect(cat.duration).toEqual(8000); 
        });
    });
});
