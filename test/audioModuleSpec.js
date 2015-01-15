define(
    [
        'audioCore',
        'audioElements',
        'audioNodes',
        'audioActors'
    ],

function(audio, audioElements, audioNodes, audioActors) {
    
    describe("AudioModule.link", function() {
        beforeEach(function() {
            module = audioElements.Bandpass(50, 100, 1);
            module2 = audioElements.Noise();
            mixinNode = audioNodes.Gain();
            mixinNode2 = audioNodes.Delay(1);
            audioNode = audio.ctx.createGain();
            multipleInModule = new audioActors.SubtractiveSynthesis();
            multipleInMixinNode = audioNodes.Merge(2);
            multipleOutMixinNode = audioNodes.Split(2);
        });
        
        it("links audioModules", function() {
            expect(function() { module2.link(module); }).not.toThrow();
        });

        it("links audioModules to audioNodes", function() {
            expect(function() { module2.link(audioNode); }).not.toThrow();
        });

        it("links audioModules to mixinNodes", function() {
            expect(function() { module.link(mixinNode); }).not.toThrow();
        });

        it("links mixinNodes to audioModules", function() {
            expect(function() { mixinNode.link(module); }).not.toThrow();
        });

        it("links mixinNodes", function() {
            expect(function() { mixinNode.link(mixinNode2); }).not.toThrow();
        });
        
        it("links modules to modules with multiple ins", function() {
            expect(function() { module.link(multipleInModule, null, 0); }).not.toThrow();
            expect(function() { module2.link(multipleInModule, null, 1); }).not.toThrow();
        });

        it("links modules to mixinNodes with multiple ins", function() {
            expect(function() { module.link(multipleInMixinNode, null, 0); }).not.toThrow();
            expect(function() { module.link(multipleInMixinNode, null, 1); }).not.toThrow(); 
        });

        it("links mixinNodes to modules with multiple ins", function() {
            expect(function() { mixinNode.link(multipleInModule, 0, 0); }).not.toThrow();
            expect(function() { mixinNode.link(multipleInModule, 0, 1); }).not.toThrow();
        });

        it("links mixinNodes with multiple outs to modules", function() {
            expect(function() { multipleOutMixinNode.link(module, 0, 0); }).not.toThrow();
            expect(function() { multipleOutMixinNode.link(module, 1, 0); }).not.toThrow();
        });

        it("links mixinNodes with multiple outs to mixinNodes", function() {
            expect(function() { multipleOutMixinNode.link(mixinNode, 0, null); }).not.toThrow();
            expect(function() { multipleOutMixinNode.link(mixinNode2, 1, null); }).not.toThrow();
        });

    });

});
