/*
 * Nowhere close to great test coverage; just where
 * it was nice to have a test, I suppose.
 */
define(
    [
        'envelopeCore'
    ],

function(envelopeCore) {
    
    describe("Envelope Core", function() {

        it("envelopeCore.Envelope.toAbsolute correctly resolves relative time values",
            function() {
                var env = new envelopeCore.Envelope();
                env.duration = 2000;
                env.interpolationType = 'linear';

                var values = [
                    new envelopeCore.EnvelopeValue(0, 0),
                    new envelopeCore.EnvelopeValue(10, 20),
                    new envelopeCore.EnvelopeValue(30, 40),
                    new envelopeCore.EnvelopeValue(20, 60),
                    new envelopeCore.EnvelopeValue(10, 80),
                    new envelopeCore.EnvelopeValue(15, 100)
                ];
                env.valueSequence = values;

                var abs = env.toAbsolute(1000);

                expect(abs.valueSequence[0].time).toEqual(0);
                expect(abs.valueSequence[1].time).toEqual(200);
                expect(abs.valueSequence[2].time).toEqual(400);
                expect(abs.valueSequence[3].time).toEqual(600);
                expect(abs.valueSequence[4].time).toEqual(800);
                expect(abs.valueSequence[5].time).toEqual(1000);
        });

        it("envelopeCore.concat correctly scales relative time values", function() {
            var env = new envelopeCore.Envelope();
            env.duration = 1000;
            env.valueSequence.push(new envelopeCore.EnvelopeValue(20, 50));
            env.interpolationType = "linear";

            var ven = new envelopeCore.Envelope();
            ven.duration = 1000;
            ven.valueSequence.push(new envelopeCore.EnvelopeValue(10, 50));
            ven.interpolationType = "linear";

            var cat = envelopeCore.concat(env, ven);

            expect(cat.valueSequence[0].time).toEqual(25);
            expect(cat.valueSequence[1].time).toEqual(75);
        });

        it("envelopeCore.concat adds durations", function() {
            var env = new envelopeCore.Envelope();
            env.duration = 1000;
            env.valueSequence.push(new envelopeCore.EnvelopeValue(20, 50));
            env.interpolationType = "linear";

            var abs = env.toAbsolute(5000),
                abs2 = env.toAbsolute(3000);
            
            var cat = envelopeCore.concat(abs, abs2);
            expect(cat.duration).toEqual(8000); 
        });
  
        var start = new envelopeCore.EnvelopeValue(0, 0),
            end = new envelopeCore.EnvelopeValue(10, 100);
        
        var negStart = new envelopeCore.EnvelopeValue(10, 0),
            negEnd = new envelopeCore.EnvelopeValue(0, 100);
        
        var between = new envelopeCore.EnvelopeValue(5, 50),
            negBetween = new envelopeCore.EnvelopeValue(-5, 50); 
       
        var linearRefraction = envelopeCore.interpolation.linearRefraction;

        it("envelopeCore.interpolation.linearRefraction - "+
            "positive slope, positive refract case", function() {
            var inter = linearRefraction(start, end, between, 1);

            expect(inter.time).toEqual(50);
            expect(inter.value).toEqual(10); 
        });

        it("envelopeCore.interpolation.linearRefraction - "+
           "positive slope, negative refract case", function() {
            var inter = linearRefraction(start, end, negBetween, 1);

            expect(inter.time).toEqual(50);
            expect(inter.value).toEqual(0);
        });

        it ("envelope.interpolation.linearRefraction - "+
            "negative slope, positive refract case", function() {
            var inter = linearRefraction(negStart, negEnd, between, 1);

            expect(inter.time).toEqual(50);
            expect(inter.value).toEqual(10);
        });

        it("envelope.interpolation.linearRefraction - "+
           "negative slope, negative refract case", function() {
            var inter = linearRefraction(negStart, negEnd, negBetween, 1);
            
            expect(inter.time).toEqual(50);
            expect(inter.value).toEqual(0);
        });
       
        var bakeEnv = new envelopeCore.Envelope();
        bakeEnv.duration = 1000;
        bakeEnv.valueSequence = [
            new envelopeCore.EnvelopeValue(0, 0),
            new envelopeCore.EnvelopeValue(10, 50),
            new envelopeCore.EnvelopeValue(0, 100)
        ];
        bakeEnv.interpolationType = 'linear';

        var bakeMod = new envelopeCore.Envelope();
        bakeMod.duration = 100;
        bakeMod.valueSequence = [
            new envelopeCore.EnvelopeValue(1, 0),
            new envelopeCore.EnvelopeValue(-1, 50)
        ];
        bakeMod.interpolationType = 'linear';

        it("envelopeCore.Envelope.bake makes tasty cakes", function() {
            var cooked = bakeEnv.bake(bakeMod, 10, 1);
            var seq = cooked.valueSequence;

            expect(seq[0].value).toEqual(1);
            expect(seq[1].value).toEqual(0);
            expect(seq[2].value).toEqual(3);
            expect(seq[3].value).toEqual(2);
            expect(seq[4].value).toEqual(5);
            expect(seq[5].value).toEqual(4);
            expect(seq[6].value).toEqual(7);
            expect(seq[7].value).toEqual(6);
            expect(seq[8].value).toEqual(9);
            expect(seq[9].value).toEqual(8);
            expect(seq[10].value).toEqual(11);
            expect(seq[11].value).toEqual(8);
            expect(seq[12].value).toEqual(9);
            expect(seq[13].value).toEqual(6);
            expect(seq[14].value).toEqual(7);
            expect(seq[15].value).toEqual(4);
            expect(seq[16].value).toEqual(5);
            expect(seq[17].value).toEqual(2);
            expect(seq[18].value).toEqual(3);
            expect(seq[19].value).toEqual(0);
            expect(seq[20].value).toEqual(1); 
        });
    });
});
