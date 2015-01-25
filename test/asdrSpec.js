define(
    [
        'envelopeAsdr',
        'envelopeCore'
    ],

function(asdr, envelopeCore) {

    describe("ASDR", function() {

        beforeEach(function() {
            gen = new asdr.Generator({
                a: {
                    dur: 20,
                    inter: {type: 'exponential'},
                    val: [0, 0,  1, 99]
                },
                s: {
                    dur: 1000,
                    val: 1
                },
                d: {
                    dur: 300,
                    inter: {type: 'linear'},
                    val: [1, 0,  0.5, 99]
                },
                r: {
                    dur: 20,
                    inter: {type: 'linear'},
                    val: [0.5, 0,  0, 99]
                }
            });
        });
  
        

        describe("ComponentEnvelope", function() {
            it("throws when provided invalid amplitude values", function() {
                expect(function() {
                    var env = new asdr.ComponentEnvelope(100, 'linear', null, [
                        new envelopeCore.EnvelopeValue(-10, 0)
                    ]);
                }).toThrow(); 
            });
        });

        describe("Sustain", function() {
           
            xit("throws when given invalid amplitude parameters", function() {
                expect(function() {
                    var sus = new asdr.Sustain(100, -10);
                }).toThrow();
            });

            it("updates .valueSequence when amplitude changes", function() {
                expect(gen.sustain.valueSequence[0].value).toEqual(1);
                gen.sustain.amplitude = 0.5;
                expect(gen.sustain.valueSequence[0].value).toEqual(0.5);
            });

            it("bakes then updates with the correct valueSequence, "+
               "and interpolationType. Then, a call to .unBake reverses "+
               "these changes. A subsequent call to .bake w/o args reverses the unBake, "+
               "another .bake call sans args throws a warning, and a final .bake call with "+
               "args behaves normally.", function() {
                
                var expectNormal = function() {
                    expect(sus.valueSequence[0].value).toEqual(0.9);
                    expect(sus.valueSequence[1].value).toEqual(1);
                    expect(sus.valueSequence[2].value).toEqual(0.9);
                    expect(sus.interpolationType).toEqual('linear');
                };

                var sus = new asdr.Sustain(100, 1);
                var menv = new envelopeCore.Envelope();
                menv.interpolationType = 'linear';
                menv.valueSequence.push(
                    new envelopeCore.EnvelopeValue(-0.1, 0),
                    new envelopeCore.EnvelopeValue(0, 50)
                );
                menv.duration = 100;
                
                sus.bake(menv, 10, 1);
                expectNormal();
            
                sus.unBake();
                expect(sus.valueSequence[0].value).toEqual(1);
                expect(sus.valueSequence[1].value).toEqual(1);
                expect(sus.interpolationType).toEqual('none');

                sus.bake();
                expectNormal();

                spyOn(console, 'warn');
                sus.bake();
                expect(console.warn).toHaveBeenCalled();

                sus.bake(menv, 10, 1);
                expectNormal();
            });
        });

        describe("Generator", function() {
            it("can swap attack envelopes", function() {
                var anotherAttack = new asdr.ComponentEnvelope(15, 'linear', null, [
                    new envelopeCore.EnvelopeValue(0, 0),
                    new envelopeCore.EnvelopeValue(1, 10),
                    new envelopeCore.EnvelopeValue(0.3, 15),
                    new envelopeCore.EnvelopeValue(1, 99)
                ]); 

                gen.attack = anotherAttack;

                expect(gen.attack.valueSequence[0].value).toEqual(0);
                expect(gen.attack.valueSequence[1].value).toEqual(1);
                expect(gen.attack.valueSequence[2].value).toEqual(0.3);
                expect(gen.attack.valueSequence[3].value).toEqual(1);
            });

            it("can swap sustain envelopes", function() {
                var anotherSustain = new asdr.Sustain(1000, 0.5);
                gen.sustain = anotherSustain;
                expect(gen.sustain.valueSequence[0].value).toEqual(0.5);
            });

            it(".getASDR() returns correct times, with scaled sustain component", function() {
                var abs = gen.getASDR(2000);
                expect(abs.valueSequence[0].time).toEqual(0);
                expect(abs.valueSequence[1].time).toEqual(20 * 0.99);
                expect(abs.valueSequence[2].time).toEqual(20);
                expect(abs.valueSequence[4].time).toEqual(2020);
            });

            it(".getADSR() returns correct values", function() {
                var abs = gen.getASDR(2000);
                expect(abs.valueSequence[0].value).toEqual(0);
                expect(abs.valueSequence[1].value).toEqual(1);
                expect(abs.valueSequence[2].value).toEqual(1);
                expect(abs.valueSequence[3].value).toEqual(1);
                expect(abs.valueSequence[4].value).toEqual(1);
                expect(abs.valueSequence[5].value).toEqual(0.5); 
                expect(abs.valueSequence[6].value).toEqual(0.5); 
                expect(abs.valueSequence[7].value).toEqual(0); 
            });

            it(" - envelopes bound to a generator can be independently modified", function() {
                expect(gen.decay.duration).toEqual(300);             
                gen.attack.duration = 100;
                expect(gen.attack.duration).toEqual(100);
                expect(gen.decay.duration).toEqual(300);
            });

        });
    });
});
