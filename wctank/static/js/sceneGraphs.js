define(
    [
        'sceneGraphCore',
        'audioCore',
        'rhythm',
        'instruments',
        'mutexVisualEffects',
        'mutexVisualEffectsCore',
        'tableux'
    ],

function(sceneGraphCore, audioCore, rhythm, instruments, 
         mutexVisualEffects, mutexVisualEffectsCore, tableux) { var sceneGraphs = {};

    sceneGraphs.klangMarche = function() {
        
        var clock = new rhythm.Clock(100);
    
        var rasp = new instruments.raspyCarpark();    
       
        // locked loop callback broken...

        var config = {
            opt: {
                loop: 20
            },
            targets: {
                rasp: rasp
            },
            seq: { 
                0: { subd: 0.05, val: {rasp: ""}, rep: 10, smudge: 1.5 },
                1: { subd: 0.25, val: {rasp: ""}, rep: 6}
            },
            callbacks: function() {
                raspyRhythm.parseConfig(cfig2);
                raspyRhythm.execute();
            }
        };
        var raspyRhythm = new rhythm.Generator(clock, config);
       
        var cfig2 = config;
        cfig2.opt.loop = true;
        cfig2.seq[3] = { subd: 0.11, val: {rasp: ""}, smudge: 20 };
        cfig2.seq[4] = { subd: 0.27, val: {rasp: ""} };
        delete cfig2.callbacks;

        var iowa = new instruments.angularNastay();

        var rubber_count = 0;

        var rubberConfig = {
            opt: {
                loop: 8
            },
            targets: {
                attack: iowa.attack,
                freq: iowa.pitch
            },
            seq: {
                0: { subd: 0.63123476, val: {attack: true, freq: 80}, smudge: 5},
                1: { subd: 0.05, val: {attack: false} }
            },
            callbacks: function() {
                rubberRhy.execute(); 
                if ( (rubber_count++ % 8) === 0) {
                    rubberRhy2.execute();
                }
            }
        };
        var rubberRhy = new rhythm.Generator(clock, rubberConfig);

        var iowa2 = new instruments.angularNastay();
        var rubberConfig2 = rubberConfig;
        rubberConfig.targets = {
            attack: iowa2.attack,
            freq: iowa2.pitch
        };
        rubberConfig2.opt.loop = 4;
        rubberConfig2.seq[0] = { subd: 1.1, val: {attack: true, freq: 100} };
        rubberConfig2.seq[1] = { subd: 0.17, val: {attack: false} };
        rubberConfig2.callbacks = function() {
            rubberConfig2.opt.loop++;
            rubberRhy2.shirk();
            rubberRhy2.parseConfig(rubberConfig2);
        };
        var rubberRhy2 = new rhythm.Generator(clock, rubberConfig2);

        iowa.link(audioCore.out);
        iowa2.link(audioCore.out);
        rasp.link(audioCore.out);

        var vidFilt = new mutexVisualEffects.CausticGlow(); 

        var tableuxEngine = new tableux.Engine();
        tableuxEngine.parseData(tableux.stockList);
        tableuxEngine.select(vidFilt);

        this.init = function() {
            mutexVisualEffectsCore.apply(vidFilt); 
            clock.start();
            raspyRhythm.execute(); 
            rubberRhy.execute();
        };

        this.teardown = function() {
            raspyRhythm.shirk();
            rubberRhy.shirk(); 
            clock.stop();
        };
    };
    sceneGraphs.klangMarche.prototype = new sceneGraphCore.SceneGraph();
         
    

return sceneGraphs; });
