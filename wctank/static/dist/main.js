"format global";
(function(global) {

  var defined = {};

  // indexOf polyfill for IE8
  var indexOf = Array.prototype.indexOf || function(item) {
    for (var i = 0, l = this.length; i < l; i++)
      if (this[i] === item)
        return i;
    return -1;
  }

  var getOwnPropertyDescriptor = true;
  try {
    Object.getOwnPropertyDescriptor({ a: 0 }, 'a');
  }
  catch(e) {
    getOwnPropertyDescriptor = false;
  }

  var defineProperty;
  (function () {
    try {
      if (!!Object.defineProperty({}, 'a', {}))
        defineProperty = Object.defineProperty;
    }
    catch (e) {
      defineProperty = function(obj, prop, opt) {
        try {
          obj[prop] = opt.value || opt.get.call(obj);
        }
        catch(e) {}
      }
    }
  })();

  function register(name, deps, declare) {
    if (arguments.length === 4)
      return registerDynamic.apply(this, arguments);
    doRegister(name, {
      declarative: true,
      deps: deps,
      declare: declare
    });
  }

  function registerDynamic(name, deps, executingRequire, execute) {
    doRegister(name, {
      declarative: false,
      deps: deps,
      executingRequire: executingRequire,
      execute: execute
    });
  }

  function doRegister(name, entry) {
    entry.name = name;

    // we never overwrite an existing define
    if (!(name in defined))
      defined[name] = entry;

    // we have to normalize dependencies
    // (assume dependencies are normalized for now)
    // entry.normalizedDeps = entry.deps.map(normalize);
    entry.normalizedDeps = entry.deps;
  }


  function buildGroups(entry, groups) {
    groups[entry.groupIndex] = groups[entry.groupIndex] || [];

    if (indexOf.call(groups[entry.groupIndex], entry) != -1)
      return;

    groups[entry.groupIndex].push(entry);

    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      var depEntry = defined[depName];

      // not in the registry means already linked / ES6
      if (!depEntry || depEntry.evaluated)
        continue;

      // now we know the entry is in our unlinked linkage group
      var depGroupIndex = entry.groupIndex + (depEntry.declarative != entry.declarative);

      // the group index of an entry is always the maximum
      if (depEntry.groupIndex === undefined || depEntry.groupIndex < depGroupIndex) {

        // if already in a group, remove from the old group
        if (depEntry.groupIndex !== undefined) {
          groups[depEntry.groupIndex].splice(indexOf.call(groups[depEntry.groupIndex], depEntry), 1);

          // if the old group is empty, then we have a mixed depndency cycle
          if (groups[depEntry.groupIndex].length == 0)
            throw new TypeError("Mixed dependency cycle detected");
        }

        depEntry.groupIndex = depGroupIndex;
      }

      buildGroups(depEntry, groups);
    }
  }

  function link(name) {
    var startEntry = defined[name];

    startEntry.groupIndex = 0;

    var groups = [];

    buildGroups(startEntry, groups);

    var curGroupDeclarative = !!startEntry.declarative == groups.length % 2;
    for (var i = groups.length - 1; i >= 0; i--) {
      var group = groups[i];
      for (var j = 0; j < group.length; j++) {
        var entry = group[j];

        // link each group
        if (curGroupDeclarative)
          linkDeclarativeModule(entry);
        else
          linkDynamicModule(entry);
      }
      curGroupDeclarative = !curGroupDeclarative; 
    }
  }

  // module binding records
  var moduleRecords = {};
  function getOrCreateModuleRecord(name) {
    return moduleRecords[name] || (moduleRecords[name] = {
      name: name,
      dependencies: [],
      exports: {}, // start from an empty module and extend
      importers: []
    })
  }

  function linkDeclarativeModule(entry) {
    // only link if already not already started linking (stops at circular)
    if (entry.module)
      return;

    var module = entry.module = getOrCreateModuleRecord(entry.name);
    var exports = entry.module.exports;

    var declaration = entry.declare.call(global, function(name, value) {
      module.locked = true;

      if (typeof name == 'object') {
        for (var p in name)
          exports[p] = name[p];
      }
      else {
        exports[name] = value;
      }

      for (var i = 0, l = module.importers.length; i < l; i++) {
        var importerModule = module.importers[i];
        if (!importerModule.locked) {
          for (var j = 0; j < importerModule.dependencies.length; ++j) {
            if (importerModule.dependencies[j] === module) {
              importerModule.setters[j](exports);
            }
          }
        }
      }

      module.locked = false;
      return value;
    });

    module.setters = declaration.setters;
    module.execute = declaration.execute;

    // now link all the module dependencies
    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      var depEntry = defined[depName];
      var depModule = moduleRecords[depName];

      // work out how to set depExports based on scenarios...
      var depExports;

      if (depModule) {
        depExports = depModule.exports;
      }
      else if (depEntry && !depEntry.declarative) {
        depExports = depEntry.esModule;
      }
      // in the module registry
      else if (!depEntry) {
        depExports = load(depName);
      }
      // we have an entry -> link
      else {
        linkDeclarativeModule(depEntry);
        depModule = depEntry.module;
        depExports = depModule.exports;
      }

      // only declarative modules have dynamic bindings
      if (depModule && depModule.importers) {
        depModule.importers.push(module);
        module.dependencies.push(depModule);
      }
      else
        module.dependencies.push(null);

      // run the setter for this dependency
      if (module.setters[i])
        module.setters[i](depExports);
    }
  }

  // An analog to loader.get covering execution of all three layers (real declarative, simulated declarative, simulated dynamic)
  function getModule(name) {
    var exports;
    var entry = defined[name];

    if (!entry) {
      exports = load(name);
      if (!exports)
        throw new Error("Unable to load dependency " + name + ".");
    }

    else {
      if (entry.declarative)
        ensureEvaluated(name, []);

      else if (!entry.evaluated)
        linkDynamicModule(entry);

      exports = entry.module.exports;
    }

    if ((!entry || entry.declarative) && exports && exports.__useDefault)
      return exports['default'];

    return exports;
  }

  function linkDynamicModule(entry) {
    if (entry.module)
      return;

    var exports = {};

    var module = entry.module = { exports: exports, id: entry.name };

    // AMD requires execute the tree first
    if (!entry.executingRequire) {
      for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
        var depName = entry.normalizedDeps[i];
        var depEntry = defined[depName];
        if (depEntry)
          linkDynamicModule(depEntry);
      }
    }

    // now execute
    entry.evaluated = true;
    var output = entry.execute.call(global, function(name) {
      for (var i = 0, l = entry.deps.length; i < l; i++) {
        if (entry.deps[i] != name)
          continue;
        return getModule(entry.normalizedDeps[i]);
      }
      throw new TypeError('Module ' + name + ' not declared as a dependency.');
    }, exports, module);

    if (output)
      module.exports = output;

    // create the esModule object, which allows ES6 named imports of dynamics
    exports = module.exports;
 
    if (exports && exports.__esModule) {
      entry.esModule = exports;
    }
    else {
      entry.esModule = {};
      
      // don't trigger getters/setters in environments that support them
      if ((typeof exports == 'object' || typeof exports == 'function') && exports !== global) {
        if (getOwnPropertyDescriptor) {
          var d;
          for (var p in exports)
            if (d = Object.getOwnPropertyDescriptor(exports, p))
              defineProperty(entry.esModule, p, d);
        }
        else {
          var hasOwnProperty = exports && exports.hasOwnProperty;
          for (var p in exports) {
            if (!hasOwnProperty || exports.hasOwnProperty(p))
              entry.esModule[p] = exports[p];
          }
         }
       }
      entry.esModule['default'] = exports;
      defineProperty(entry.esModule, '__useDefault', {
        value: true
      });
    }
  }

  /*
   * Given a module, and the list of modules for this current branch,
   *  ensure that each of the dependencies of this module is evaluated
   *  (unless one is a circular dependency already in the list of seen
   *  modules, in which case we execute it)
   *
   * Then we evaluate the module itself depth-first left to right 
   * execution to match ES6 modules
   */
  function ensureEvaluated(moduleName, seen) {
    var entry = defined[moduleName];

    // if already seen, that means it's an already-evaluated non circular dependency
    if (!entry || entry.evaluated || !entry.declarative)
      return;

    // this only applies to declarative modules which late-execute

    seen.push(moduleName);

    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      if (indexOf.call(seen, depName) == -1) {
        if (!defined[depName])
          load(depName);
        else
          ensureEvaluated(depName, seen);
      }
    }

    if (entry.evaluated)
      return;

    entry.evaluated = true;
    entry.module.execute.call(global);
  }

  // magical execution function
  var modules = {};
  function load(name) {
    if (modules[name])
      return modules[name];

    // node core modules
    if (name.substr(0, 6) == '@node/')
      return require(name.substr(6));

    var entry = defined[name];

    // first we check if this module has already been defined in the registry
    if (!entry)
      throw "Module " + name + " not present.";

    // recursively ensure that the module and all its 
    // dependencies are linked (with dependency group handling)
    link(name);

    // now handle dependency execution in correct order
    ensureEvaluated(name, []);

    // remove from the registry
    defined[name] = undefined;

    // exported modules get __esModule defined for interop
    if (entry.declarative)
      defineProperty(entry.module.exports, '__esModule', { value: true });

    // return the defined module object
    return modules[name] = entry.declarative ? entry.module.exports : entry.esModule;
  };

  return function(mains, depNames, declare) {
    return function(formatDetect) {
      formatDetect(function(deps) {
        var System = {
          _nodeRequire: typeof require != 'undefined' && require.resolve && typeof process != 'undefined' && require,
          register: register,
          registerDynamic: registerDynamic,
          get: load, 
          set: function(name, module) {
            modules[name] = module; 
          },
          newModule: function(module) {
            return module;
          }
        };
        System.set('@empty', {});

        // register external dependencies
        for (var i = 0; i < depNames.length; i++) (function(depName, dep) {
          if (dep && dep.__esModule)
            System.register(depName, [], function(_export) {
              return {
                setters: [],
                execute: function() {
                  for (var p in dep)
                    if (p != '__esModule' && !(typeof p == 'object' && p + '' == 'Module'))
                      _export(p, dep[p]);
                }
              };
            });
          else
            System.registerDynamic(depName, [], false, function() {
              return dep;
            });
        })(depNames[i], arguments[i]);

        // register modules in this bundle
        declare(System);

        // load mains
        var firstLoad = load(mains[0]);
        if (mains.length > 1)
          for (var i = 1; i < mains.length; i++)
            load(mains[i]);

        if (firstLoad.__useDefault)
          return firstLoad['default'];
        else
          return firstLoad;
      });
    };
  };

})(typeof self != 'undefined' ? self : global)
/* (['mainModule'], ['external-dep'], function($__System) {
  System.register(...);
})
(function(factory) {
  if (typeof define && define.amd)
    define(['external-dep'], factory);
  // etc UMD / module pattern
})*/

(['1'], [], function($__System) {

$__System.registerDynamic("2", ["3", "4"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var isObject = req('3');
  req('4')('freeze', function($freeze) {
    return function freeze(it) {
      return $freeze && isObject(it) ? $freeze(it) : it;
    };
  });
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("5", ["2", "6"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  req('2');
  module.exports = req('6').Object.freeze;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("7", ["5"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {
    "default": req('5'),
    __esModule: true
  };
  global.define = __define;
  return module.exports;
});

$__System.register('8', ['7', '9', '10', 'b', 'c', 'd', 'e', 'f', 'a'], function (_export) {
    var _Object$freeze, core, _Object$getOwnPropertyDescriptor, _get, _inherits, _createClass, _classCallCheck, _Symbol, util, compEnvParentAssessors, ComponentEnvelope, sustainVs, sustainCookedVs, sustainCooked, sustainPriorBakeParams, sustainAmplitude, sustainDummy, Sustain, genA, genS, genD, genR, genEnv, genAS, genDR, genChanged, genPriorDuration, genSet, genUpdateEnvs, Generator, presets;

    function clipValueSequence(env) {
        env.valueSequence.forEach(function (v) {
            if (v.value > 1) v.value = 1;else if (v.value < 0) v.value = 0;
        });
    }

    // a collection of useful param objs to construct envelopeAsdr.Generators with
    return {
        setters: [function (_2) {
            _Object$freeze = _2['default'];
        }, function (_3) {
            core = _3;
        }, function (_) {
            _Object$getOwnPropertyDescriptor = _['default'];
        }, function (_b) {
            _get = _b['default'];
        }, function (_c) {
            _inherits = _c['default'];
        }, function (_d) {
            _createClass = _d['default'];
        }, function (_e) {
            _classCallCheck = _e['default'];
        }, function (_f) {
            _Symbol = _f['default'];
        }, function (_a) {
            util = _a;
        }],
        execute: function () {
            'use strict';

            _export('clipValueSequence', clipValueSequence);

            compEnvParentAssessors = _Symbol('assessors');

            ComponentEnvelope = (function (_core$Envelope) {
                _inherits(ComponentEnvelope, _core$Envelope);

                function ComponentEnvelope(duration, interpolationType, interpolationArgs, valueSequence) {
                    _classCallCheck(this, ComponentEnvelope);

                    _get(Object.getPrototypeOf(ComponentEnvelope.prototype), 'constructor', this).call(this);

                    // oof this is ugly
                    var desc = _Object$getOwnPropertyDescriptor(this.__proto__.__proto__, 'valueSequence');

                    // this is here b/c of a quirk in the babel implementation of classes
                    // where this in inherited assessors is bound to the property descriptor instead
                    // of the constructed object
                    this[compEnvParentAssessors] = {
                        get: desc.get.bind(this),
                        set: desc.set.bind(this)
                    };

                    if (duration) this.duration = duration;
                    if (interpolationType) this.interpolationType = interpolationType;
                    if (interpolationArgs) this.interpolationArgs = interpolationArgs;
                    if (valueSequence) this.valueSequence = valueSequence;
                }

                _createClass(ComponentEnvelope, [{
                    key: 'valueSequence',
                    get: function get() {
                        return this[compEnvParentAssessors].get();
                    },
                    set: function set(v) {
                        this[compEnvParentAssessors].set(v, false, function (val) {
                            if (val.value < 0 || val.value > 1) throw new Error("ASDR Component param error: must be a number between " + "0 and 1 inclusive or null not " + val);
                        });
                    }
                }]);

                return ComponentEnvelope;
            })(core.Envelope);

            _export('ComponentEnvelope', ComponentEnvelope);

            sustainVs = _Symbol();
            sustainCookedVs = _Symbol();
            sustainCooked = _Symbol();
            sustainPriorBakeParams = _Symbol();
            sustainAmplitude = _Symbol();
            sustainDummy = _Symbol();

            Sustain = (function (_ComponentEnvelope) {
                _inherits(Sustain, _ComponentEnvelope);

                function Sustain(duration, amplitude) {
                    _classCallCheck(this, Sustain);

                    _get(Object.getPrototypeOf(Sustain.prototype), 'constructor', this).call(this);

                    this[sustainAmplitude];
                    this[sustainVs];
                    this[sustainCookedVs];
                    this[sustainCooked] = false;
                    this[sustainPriorBakeParams] = {};
                    this[sustainDummy] = new core.Envelope();

                    this.duration = duration;
                    this.amplitude = amplitude;
                    this.interpolationType = 'none';
                    this.interpolationArgs = null;
                }

                _createClass(Sustain, [{
                    key: 'unBake',
                    value: function unBake() {
                        this[sustainCooked] = false;
                        this.interpolationType = 'none';
                        this.interpolationArgs = null;
                    }
                }, {
                    key: 'bake',
                    value: function bake(modEnvelope, modDuration, refractMag) {
                        if (modEnvelope instanceof core.Envelope) {
                            this[sustainDummy].valueSequence = this[sustainVs];
                            this.interpolationType = this[sustainDummy].interpolationType = modEnvelope.interpolationType;
                            this.interpolationArgs = this[sustainDummy].interpolationArgs = modEnvelope.interpolationArgs;
                            this[sustainDummy].duration = modEnvelope.duration;
                            this[sustainCookedVs] = this[sustainDummy].bake(modEnvelope, modDuration, refractMag).valueSequence;
                            this[sustainCooked] = true;
                            this[sustainPriorBakeParams] = { modEnvelope: modEnvelope,
                                modDuration: modDuration,
                                refractMag: refractMag };
                        } else if (this[sustainDummy].valueSequence[0] && !this[sustainCooked]) {
                            this.interpolationType = this[sustainDummy].interpolationType;
                            this[sustainCooked] = true;
                        } else {
                            console.warn("asdr.Sustain.bake called sans arguments without a prior " + ".bake and .unBake - no action taken.");
                        }
                    }
                }, {
                    key: 'amplitude',
                    get: function get() {
                        return this[sustainAmplitude];
                    },
                    set: function set(v) {
                        if (v < 0 || v > 1) throw new RangeError("invalid asdr.sustain param: amplitude must be a value " + "between 0 and 1 inclusive");
                        this[sustainAmplitude] = v;
                        this.valueSequence = [new core.EnvelopeValue(v, 0), new core.EnvelopeValue(v, 99)];
                        if (this[sustainCooked]) outer.bake(this[sustainPriorBakeParams].modEnvelope, this[sustainPriorBakeParams].modDuration, this[sustainPriorBakeParams].refractMag);
                    }
                }, {
                    key: 'valueSequence',
                    get: function get() {
                        if (!this[sustainCooked]) return this[sustainVs];else return this[sustainCookedVs];
                    },
                    set: function set(v) {
                        //?
                        this.unBake();
                        this[sustainVs] = v;
                        this[sustainCookedVs] = null;
                    }
                }]);

                return Sustain;
            })(ComponentEnvelope);

            _export('Sustain', Sustain);

            genA = _Symbol();
            genS = _Symbol();
            genD = _Symbol();
            genR = _Symbol();
            genEnv = _Symbol();
            genAS = _Symbol();
            genDR = _Symbol();
            genChanged = _Symbol();
            genPriorDuration = _Symbol();
            genSet = _Symbol();
            genUpdateEnvs = _Symbol();

            Generator = (function () {
                // TODO: allow variable durations in attack and decay stages

                function Generator(attack, sustain, decay, release) {
                    var _this = this;

                    _classCallCheck(this, Generator);

                    this[genChanged] = false;
                    this[genPriorDuration] = -999;

                    this[genSet] = function (env, name, symbol, watchedProperties, reqInstance) {
                        if (!(env instanceof (reqInstance ? reqInstance : ComponentEnvelope))) throw new TypeError("Invalid asdr.Generator param: " + name + " must " + "be an instance of asdr.ComponentEnvelope.");

                        _this[genChanged] = true;
                        util.watchProperty(env, watchedProperties, function () {
                            return _this[genChanged] = true;
                        });

                        _this[symbol] = env;
                    };

                    var aIsComponent = attack instanceof ComponentEnvelope;

                    if (aIsComponent) {
                        this.attack = attack;
                        this.sustain = sustain;
                        this.decay = decay;
                        this.release = release;
                    }

                    var parseStage = function parseStage(o) {
                        var inter_type = undefined,
                            inter_args = undefined;

                        var dur = o.dur;
                        if ('inter' in o) {
                            inter_type = o.inter.type;
                            inter_args = o.inter.args ? o.inter.args : null;
                        } else {
                            inter_type = 'none';
                            inter_args = null;
                        }

                        return new ComponentEnvelope(dur, inter_type, inter_args, core.arrayToEnvelopeValues(o.val));
                    };

                    if (!aIsComponent) {
                        this.attack = parseStage(attack.a);
                        this.sustain = new Sustain(attack.s.dur, attack.s.val);
                        this.decay = parseStage(attack.d);
                        this.release = parseStage(attack.r);
                    }

                    this[genUpdateEnvs] = function (duration) {
                        if (!_this[genEnv] || typeof duration === 'number' && duration !== _this[genPriorDuration] || _this[genChanged]) {
                            var absA = _this.attack.toAbsolute(),
                                absS = _this.sustain.toAbsolute(duration),
                                absD = _this.decay.toAbsolute(),
                                absR = _this.release.toAbsolute();

                            _this[genAS] = core.concat(absA, absS);
                            _this[genDR] = core.concat(absD, absR);
                            _this[genEnv] = core.concat(absA, absS, absD, absR);
                            _this[genPriorDuration] = duration;
                            _this[genChanged] = false;
                        }
                    };
                }

                _createClass(Generator, [{
                    key: 'getAS',
                    value: function getAS() {
                        this[genUpdateEnvs]();
                        return this[genAS];
                    }
                }, {
                    key: 'getDR',
                    value: function getDR() {
                        this[genUpdateEnvs]();
                        return this[genAS];
                    }
                }, {
                    key: 'getASDR',
                    value: function getASDR(duration) {
                        this[genUpdateEnvs](duration);
                        return this[genEnv];
                    }
                }, {
                    key: 'attack',
                    get: function get() {
                        return this[genA];
                    },
                    set: function set(v) {
                        this[genSet](v, "attack", genA, 'duration');
                    }
                }, {
                    key: 'decay',
                    get: function get() {
                        return this[genD];
                    },
                    set: function set(v) {
                        this[genSet](v, "decay", genD, 'duration');
                    }
                }, {
                    key: 'release',
                    get: function get() {
                        return this[genR];
                    },
                    set: function set(v) {
                        this[genSet](v, "release", genR, 'duration');
                    }
                }, {
                    key: 'sustain',
                    get: function get() {
                        return this[genS];
                    },
                    set: function set(v) {
                        this[genSet](v, "sustain", genS, ['duration', 'valueSequence']);
                    }
                }]);

                return Generator;
            })();

            _export('Generator', Generator);

            presets = {
                roughStart: {
                    a: {
                        dur: 100,
                        inter: { type: 'none' },
                        val: [0.01, 0, 1, 10, 0.2, 20, 0.9, 30, 0.4, 40, 0.8, 50, 0.3, 57, 0.75, 64, 0.45, 73, 0.83, 83, 0.15, 90, 1, 99]
                    },
                    s: {
                        dur: 100,
                        val: 1
                    },
                    d: {
                        dur: 200,
                        inter: { type: 'linear' },
                        val: [1, 0, 0.5, 99]
                    },
                    r: {
                        dur: 50,
                        inter: { type: 'linear' },
                        val: [0.5, 0, 0.01, 99]
                    }
                }
            };

            _export('presets', presets);

            _Object$freeze(presets);
        }
    };
});
$__System.register('11', ['9', '12', '13', '14', '15', 'd', 'e', 'f', 'a'], function (_export) {
    var envelopeCore, ParameterizedAction, Clock, _getIterator, _Object$keys, _createClass, _classCallCheck, _Symbol, util, Rval, flr, floatingLoopReinitializer, genClock, genTarget, genSequence, genCbks, genLoop, genWasLooping, genLoopCount, genLocked, genRangeError, genPropError, genTypeError, genIsFunction, genQueue, genPriorTime, genAddCancelable, genTriggerCancelables, genClockFunctions, genReinitId, genConfig, Generator;

    return {
        setters: [function (_3) {
            envelopeCore = _3;
        }, function (_4) {
            ParameterizedAction = _4['default'];
        }, function (_5) {
            Clock = _5['default'];
        }, function (_) {
            _getIterator = _['default'];
        }, function (_2) {
            _Object$keys = _2['default'];
        }, function (_d) {
            _createClass = _d['default'];
        }, function (_e) {
            _classCallCheck = _e['default'];
        }, function (_f) {
            _Symbol = _f['default'];
        }, function (_a) {
            util = _a;
        }],
        execute: function () {
            /**
             * @module rhythm.Generator
             */

            // convienence for floatingLoopReinitializer
            'use strict';

            Rval = (function () {
                function Rval(duration, fn, clock) {
                    _classCallCheck(this, Rval);

                    this.duration = duration;
                    this.fn = fn;
                    this.clock = clock;
                    this.endTime = this.clock.lastBeat + this.duration;
                    //this._id_ = util.hashCode((Math.random() * 100000).toString());
                }

                /*
                 * invoked in .Generator when performing floating clock loops. 
                 * Adds a function to each rhythm.Generator.clock queue that requeues rhythms.
                 */
                // no static initializer in es6?

                _createClass(Rval, [{
                    key: 'updateEndTime',
                    value: function updateEndTime(startTime) {
                        this.endTime = startTime + this.duration;
                    }
                }]);

                return Rval;
            })();

            flr = {
                queue: {},
                clocks: [],
                scheduleLoop: function scheduleLoop(rval) {

                    if (rval.endTime < rval.clock.nextBeat) {
                        var offset = rval.endTime - rval.clock.lastBeat;
                        rval.fn(offset);
                        // undefined check b/c rvalObj may be derefrenced during execution
                        if (typeof rval !== 'undefined') rval.updateEndTime(rval.clock.lastBeat + offset);
                        if (rval.endTime < rval.clock.nextBeat) flr.scheduleLoop(rval);
                    }
                },
                comparator: function comparator() {
                    var _iteratorNormalCompletion = true;
                    var _didIteratorError = false;
                    var _iteratorError = undefined;

                    try {
                        for (var _iterator = _getIterator(_Object$keys(flr.queue)), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                            var fn = _step.value;

                            flr.scheduleLoop(flr.queue[fn]);
                        }
                    } catch (err) {
                        _didIteratorError = true;
                        _iteratorError = err;
                    } finally {
                        try {
                            if (!_iteratorNormalCompletion && _iterator['return']) {
                                _iterator['return']();
                            }
                        } finally {
                            if (_didIteratorError) {
                                throw _iteratorError;
                            }
                        }
                    }
                }
            };

            floatingLoopReinitializer = (function () {
                function floatingLoopReinitializer() {
                    _classCallCheck(this, floatingLoopReinitializer);
                }

                /**
                 * rhythm.core.Generator executes rhythmic sequences against a clock
                 * @namespace rhythm
                 * @class Generator
                 * @constructor
                 * @param {rhythm.core.Clock} clock - clock to synchronize to
                 * @param {Object} config - config object that sets obj properties and defines
                 *      the rhythmic sequence to be executed.
                 *      
                 *      @example
                 *      // rhythm.core.Generator config object
                 *      {                          
                 *          opt: {  // execution options       
                 *              loop: {Number | Boolean}  // see this.loop     
                 *              locked: {Number | Boolean} // see this.locked
                 *          },          
                 *          targets: {  // execution targets
                 *              {x}: {instrument.core.ParameterizedAction | function | instrument.core.Instrument}                
                 *          },       
                 *          seq: {  // rhythmic sequence                 
                 *              {number}: {  // individual item in sequence; the key can be anything, but numbers are helpful      
                 *                  subd: {number}, // length of subdivision relative to beat, e.g., 1.0 = length of beat
                 *                  val: { 
                 *                      {x}: params // 'pass' params to targets[x] (see instrument.core.ParameterizedAction)
                 *                  },              
                 *                  smudge: {number}, // smudgeFactor of this part of the sequence (see Clock.smudgeFactor)  
                 *                  rep: {number}  // number of times to repeat this portion of the sequence              
                 *              },                 
                 *              {number}: ...              
                 *          }
                 *          callbacks: {function | function[]}            
                 *      }
                 */

                _createClass(floatingLoopReinitializer, null, [{
                    key: 'add',
                    value: function add(duration, fn, clock) {
                        // first determine if a comparator exists for the given clock
                        var found = false;
                        for (var i = 0; i < flr.clocks.length; i++) {
                            if (flr.clocks[i] === clock) {
                                found = true;
                                break;
                            }
                        }

                        // ... if not, add a comparator function to its queue
                        if (!found) {
                            flr.clocks.push(clock);
                            clock.add(flr.comparator);
                        }

                        var rhy = new Rval(duration, fn, clock);

                        var id = util.hashCode((Math.random() * 100000).toString());
                        flr.queue[id] = rhy;

                        return id;
                    }
                }, {
                    key: 'rm',
                    value: function rm(id) {
                        delete flr.queue[id];
                    }
                }, {
                    key: 'has',
                    value: function has(id) {
                        return id in flr.queue;
                    }
                }]);

                return floatingLoopReinitializer;
            })();

            genClock = _Symbol('clock');
            genTarget = _Symbol('target');
            genSequence = _Symbol('sequence');
            genCbks = _Symbol('callbacks');
            genLoop = _Symbol('loop');
            genWasLooping = _Symbol('wasLooping');
            genLoopCount = _Symbol('loopCount');
            genLocked = _Symbol('locked');
            genRangeError = _Symbol('rangeError');
            genPropError = _Symbol('propError');
            genTypeError = _Symbol('typeError');
            genIsFunction = _Symbol('isFunction');
            genQueue = _Symbol('queue');
            genPriorTime = _Symbol('priorTime');
            genAddCancelable = _Symbol('addCancelable');
            genTriggerCancelables = _Symbol('triggerCancelables');
            genClockFunctions = _Symbol('clockFunctions');
            genReinitId = _Symbol('reinitId');
            genConfig = _Symbol('config');

            Generator = (function () {
                function Generator(clock, config) {
                    var _this = this;

                    _classCallCheck(this, Generator);

                    var cancelables = {
                        active: 0,
                        0: [],
                        1: []
                    };

                    var updateCancelables = function updateCancelables() {
                        var active = cancelables.active,
                            other = (cancelables.active + 1) % 2;

                        for (var i = 0; i < cancelables[active].length; i++) {
                            if (cancelables[active][i].fresh) cancelables[other].push(cancelables[active][i]);
                        }

                        util.emptyArray(cancelables[active]);

                        cancelables.active = other;
                    };
                    window.setInterval(updateCancelables, 1000);

                    this[genTriggerCancelables] = function () {
                        var _iteratorNormalCompletion2 = true;
                        var _didIteratorError2 = false;
                        var _iteratorError2 = undefined;

                        try {
                            for (var _iterator2 = _getIterator(cancelables[cancelables.active]), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                                var cncl = _step2.value;

                                cncl.cancel();
                            }
                        } catch (err) {
                            _didIteratorError2 = true;
                            _iteratorError2 = err;
                        } finally {
                            try {
                                if (!_iteratorNormalCompletion2 && _iterator2['return']) {
                                    _iterator2['return']();
                                }
                            } finally {
                                if (_didIteratorError2) {
                                    throw _iteratorError2;
                                }
                            }
                        }
                    };
                    this[genAddCancelable] = function (cncl) {
                        cancelables[cancelables.active].push(cncl);
                    };

                    this[genClockFunctions] = [];
                    this[genReinitId] = "";
                    this[genLoop] = false;
                    this[genWasLooping] = false;
                    this[genLoopCount] = 0;
                    this[genLocked] = false;
                    this[genConfig] = config;
                    this[genQueue] = {};
                    this[genPriorTime] = 0;
                    this[genCbks] = [];

                    var genErrorMess = function genErrorMess(mess) {
                        return 'Invalid rhythm.Generator param: ' + mess;
                    };

                    this[genRangeError] = function (mess) {
                        throw new RangeError(genErrorMess(mess));
                    };

                    this[genPropError] = function (name) {
                        throw new Error(genErrorMess('All rhythmic breakpoints must "+\n                "specify a ' + name + ' property.'));
                    };

                    this[genTypeError] = function (mess) {
                        throw new TypeError(genErrorMess(mess));
                    };

                    this[genIsFunction] = function () {
                        if (typeof f !== 'function') _this[genTypeError]('callback must be a function');
                    };

                    if (!(clock instanceof Clock)) this[genTypeError]("rhythm.Generator must be constructed with a " + " reference to an instance of rhythm.Clock");else this.clock = clock;

                    if (config) this.parseConfig(config);

                    util.watchProperty(clock, 'bpm', function () {
                        _this.shirk();
                        _this.parseConfig(_this[genConfig]);
                        _this.execute();
                    });
                }

                /**
                 * If locked is set to n, rhythms will not be allowed to phase
                 * against the clock, regardless of their length, and will be 
                 * triggered every n beats. 
                 * @property {number} locked
                 */

                _createClass(Generator, [{
                    key: 'parseConfig',

                    /**
                     * Parses a config object in the form described in rhythm.Generator.constructor
                     * @method parseConfig
                     */
                    value: function parseConfig(c) {
                        var _this2 = this;

                        //TODO: use input validation defined in assessors above! sheesh.

                        var throwParseConfigErr = function throwParseConfigErr(name) {
                            throw new Error('rhythm/Generator config error: \n                    config must specify a \'' + name + '\' property');
                        };

                        if (!c.targets) throwParseConfigError('targets');else if (!c.seq && !c.sequence) throwParseConfigError('seq or sequence');

                        this[genTarget] = c.targets;

                        var optSettable = ['locked', 'loop'];

                        // parse options
                        if (c.opt) {
                            var _iteratorNormalCompletion3 = true;
                            var _didIteratorError3 = false;
                            var _iteratorError3 = undefined;

                            try {
                                for (var _iterator3 = _getIterator(_Object$keys(c.opt)), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                                    var prop = _step3.value;

                                    if (optSettable.indexOf(prop) >= 0) this[prop] = c.opt[prop];else throw new Error(this[genPropError]('config object .opt can\n                                only have keys ' + optSettable));
                                }
                            } catch (err) {
                                _didIteratorError3 = true;
                                _iteratorError3 = err;
                            } finally {
                                try {
                                    if (!_iteratorNormalCompletion3 && _iterator3['return']) {
                                        _iterator3['return']();
                                    }
                                } finally {
                                    if (_didIteratorError3) {
                                        throw _iteratorError3;
                                    }
                                }
                            }
                        }

                        if (c.callbacks) this.callbacks = c.callbacks;

                        this[genSequence] = c.seq || c.sequence;

                        this[genQueue] = null;
                        this[genQueue] = {};
                        this[genPriorTime] = 0;

                        /*
                         * Resolve the rhythmic sequence
                         */
                        var i = 0,
                            subd2time = function subd2time(subd) {
                            return 60 / _this2[genClock].bpm * 1000 * subd;
                        };

                        var interTargVal = function interTargVal(time, value) {
                            this.time = time;
                            this.value = value;
                        };

                        if (this[genSequence].off) this[genPriorTime] = subd2time(this[genSequence].off.subd);

                        var _iteratorNormalCompletion4 = true;
                        var _didIteratorError4 = false;
                        var _iteratorError4 = undefined;

                        try {
                            for (var _iterator4 = _getIterator(_Object$keys(this[genSequence])), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
                                var step = _step4.value;

                                var rsStep = this[genSequence][step];
                                if (step !== 'off') {
                                    var values = {},
                                        smudge = rsStep.smudge,
                                        repeats = rsStep.rep ? rsStep.rep : 1;

                                    while (repeats-- > 0) {
                                        var time = typeof sumdge === 'number' ? util.smudgeNumber(this[genPriorTime], smudge) : this[genPriorTime];

                                        if (rsStep.val) {
                                            var _iteratorNormalCompletion5 = true;
                                            var _didIteratorError5 = false;
                                            var _iteratorError5 = undefined;

                                            try {
                                                for (var _iterator5 = _getIterator(_Object$keys(rsStep.val)), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
                                                    var val = _step5.value;

                                                    var ceFn = this[genTarget][val].createEnvelope;
                                                    values[val] = ceFn ? ceFn(rsStep.val[val]) : ceFn;
                                                }
                                            } catch (err) {
                                                _didIteratorError5 = true;
                                                _iteratorError5 = err;
                                            } finally {
                                                try {
                                                    if (!_iteratorNormalCompletion5 && _iterator5['return']) {
                                                        _iterator5['return']();
                                                    }
                                                } finally {
                                                    if (_didIteratorError5) {
                                                        throw _iteratorError5;
                                                    }
                                                }
                                            }
                                        } else {
                                            values = null;
                                        }

                                        this[genQueue][i++] = new interTargVal(time, values);
                                        this[genPriorTime] = time + subd2time(rsStep.subd);
                                    }
                                }
                            }
                        } catch (err) {
                            _didIteratorError4 = true;
                            _iteratorError4 = err;
                        } finally {
                            try {
                                if (!_iteratorNormalCompletion4 && _iterator4['return']) {
                                    _iterator4['return']();
                                }
                            } finally {
                                if (_didIteratorError4) {
                                    throw _iteratorError4;
                                }
                            }
                        }
                    }

                    /**
                     * Starts execution of the rhythmicSequence.
                     * @method execute
                     */
                }, {
                    key: 'execute',
                    value: function execute() {
                        var _this3 = this;

                        var bootstrap_count = 0;

                        this[genLoopCount] = typeof this.loop === 'number' ? this.loop : -999;

                        var sounder = function sounder(offset) {
                            var off = offset ? offset : 0,
                                bang = false;

                            if (!_this3.locked || _this3[genClock].cycleCount % _this3.locked === 0) {

                                bang = true;

                                var _iteratorNormalCompletion6 = true;
                                var _didIteratorError6 = false;
                                var _iteratorError6 = undefined;

                                try {
                                    for (var _iterator6 = _getIterator(_Object$keys(_this3[genQueue])), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
                                        var step = _step6.value;
                                        var _iteratorNormalCompletion7 = true;
                                        var _didIteratorError7 = false;
                                        var _iteratorError7 = undefined;

                                        try {

                                            for (var _iterator7 = _getIterator(_Object$keys(_this3[genQueue][step].value)), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
                                                var seqItem = _step7.value;

                                                var target = _this3[genTarget][seqItem].target;

                                                var envelope = _this3[genQueue][step].value[seqItem] ? _this3[genQueue][step].value[seqItem] : _this3[genTarget][seqItem].envelope;

                                                var thisOffset = _this3[genQueue][step].time + off;

                                                _this3[genAddCancelable](envelopeCore.apply(target, envelope, thisOffset));
                                            }
                                        } catch (err) {
                                            _didIteratorError7 = true;
                                            _iteratorError7 = err;
                                        } finally {
                                            try {
                                                if (!_iteratorNormalCompletion7 && _iterator7['return']) {
                                                    _iterator7['return']();
                                                }
                                            } finally {
                                                if (_didIteratorError7) {
                                                    throw _iteratorError7;
                                                }
                                            }
                                        }
                                    }
                                } catch (err) {
                                    _didIteratorError6 = true;
                                    _iteratorError6 = err;
                                } finally {
                                    try {
                                        if (!_iteratorNormalCompletion6 && _iterator6['return']) {
                                            _iterator6['return']();
                                        }
                                    } finally {
                                        if (_didIteratorError6) {
                                            throw _iteratorError6;
                                        }
                                    }
                                }

                                if (_this3[genLoopCount]) _this3[genLoopCount]--;
                            }

                            var executeCallbacks = function executeCallbacks() {
                                var call_offset = offset ? offset : 0;

                                window.setTimeout(function () {
                                    if (_this3.callbacks.length > 0) _this3.callbacks.forEach(function (v) {
                                        return v();
                                    });
                                }, (_this3[genPriorTime] + call_offset) * 0.95);
                            };

                            var done = function done() {
                                floatingLoopReinitializer.rm(_this3[genReinitId]);
                                _this3.clock.remove(clk_q_id);
                                _this3[genClockFunctions].splice(_this3[genClockFunctions].indexOf(clk_q_id), 1);

                                executeCallbacks();
                            };

                            if (_this3[genWasLooping]) done();

                            if (!_this3.locked && _this3[genPriorTime] < _this3.clock.beatlength && bootstrap_count < _this3.clock.beatLength) {
                                var offend = off + _this3[genPriorTime];
                                bootstrap_count += _this3[genPriorTime];
                                sounder(offend);
                            }

                            if (!_this3.locked || !_this3.loop && bang) {
                                _this3.clock.remove(clk_q_id);
                                _this3[genClockFunctions].splice(_this3[genClockFunctions].indexOf(clk_q_id), 1);
                            }

                            if (!_this3.loop && bang) executeCallbacks();

                            if (!_this3.locked && _this3.loop && !floatingLoopReinitializer.has(_this3[genReinitId])) {
                                _this3[genReinitId] = floatingLoopReinitializer.add(_this3[genPriorTime], sounder, _this3.clock);
                            }
                            if (!_this3[genLoopCount] && _this3[genLoopCount] !== -999) done();
                        };

                        var clk_q_id = this.clock.add(sounder);
                        this[genClockFunctions].push(clk_q_id);
                    }

                    /**
                     * Stops the execution of this.rhythmicSequence
                     * @method shirk
                     */
                }, {
                    key: 'shirk',
                    value: function shirk() {
                        var _this4 = this;

                        this[genClockFunctions].forEach(function (v) {
                            return _this4.clock.remove(v);
                        });
                        floatingLoopReinitializer.rm(this[genReinitId]);
                        this[genTriggerCancelables]();
                    }
                }, {
                    key: 'locked',
                    get: function get() {
                        return this[genLocked];
                    },
                    set: function set(v) {
                        if (v === false || v >= 0) this[genLocked] = v;else this[genRangeError]('.locked must be false or a number >= 0, not ' + v);
                    }

                    /**
                     * If loop is set to true, the rhythm will loop indefinitely, and will
                     * do so in such a way that if the length of this Generator's rhythm
                     * does not correspond to beat length, the rhythm will change phase
                     * relative to the beat. If loop is a number, the rhythm will loop
                     * that number of times.
                     * @property {boolean | number} loop
                     */
                }, {
                    key: 'loop',
                    get: function get() {
                        return this[genLoop];
                    },
                    set: function set(v) {
                        if (!v && loop) this[genWasLooping] = true;else this[genWasLooping] = false;

                        this[genLoop] = v;
                    }

                    /**
                     * The clock used by this Generator.
                     * @property {rhythm.Clock} clock
                     */
                }, {
                    key: 'clock',
                    get: function get() {
                        return this[genClock];
                    },
                    set: function set(v) {
                        if (v instanceof Clock) this[genClock] = v;else this[genTypeError]('rhythm/core.Generator.clock must be ' + 'an instance of core.Clock');
                    }

                    /**
                     * This Generator's callbacks. Called after a finite number of loops are executed, 
                     * or after an iteration of the rhythm if no loops are scheduled.
                     * @property {function[] | function} callbacks
                     */
                }, {
                    key: 'callbacks',
                    get: function get() {
                        return this[genCbks];
                    },
                    set: function set(v) {
                        var _this5 = this;

                        var validateCallback = function validateCallback() {
                            if (typeof f !== 'function') _this5[genTypeError]('callback must be a function');
                        };

                        var r = [];
                        if (Array.isArray(v)) {
                            var _iteratorNormalCompletion8 = true;
                            var _didIteratorError8 = false;
                            var _iteratorError8 = undefined;

                            try {
                                for (var _iterator8 = _getIterator(v), _step8; !(_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done); _iteratorNormalCompletion8 = true) {
                                    var clbk = _step8.value;

                                    validateCallback(clbk);
                                    r.push(clbk);
                                }
                            } catch (err) {
                                _didIteratorError8 = true;
                                _iteratorError8 = err;
                            } finally {
                                try {
                                    if (!_iteratorNormalCompletion8 && _iterator8['return']) {
                                        _iterator8['return']();
                                    }
                                } finally {
                                    if (_didIteratorError8) {
                                        throw _iteratorError8;
                                    }
                                }
                            }
                        } else {
                            r.push(v);
                        }
                        this[genCbks] = r;
                    }

                    /**
                     * The targets to execute rhythmically. 
                     * @property {Object} targets
                     */
                }, {
                    key: 'targets',
                    get: function get() {
                        return this[genTarget];
                    },
                    set: function set(v) {
                        var _this6 = this;

                        this[genTarget] = null;
                        this[genTarget] = {};

                        var checkTarget = function checkTarget(toOperate, name) {
                            if (toOperate instanceof ParameterizedAction) {
                                _this6[genTarget][name] = toOperate;
                            } else if (typeof toOperate === 'function') {
                                // a little help so rhythm gen can be passed arbitrary
                                // functions to call; if passing any particular values to
                                // this function is unimportant
                                var action = new ParameterizedAction(toOperate),
                                    env = new envelopeCore.Envelope();

                                env.duration = 1000;
                                env.interpolationType = 'none';
                                env.valueSequence.push(new envelopeCore.EnvelopeValue(0, 0));
                                action.envelope = env.toAbsolute();
                                _this6[genTarget][name] = action;
                            } else if ('actionTarget' in v[targ]) {
                                checkTarget(toOperate.actionTarget, name);
                            } else {
                                _this6[genTypeError]("All targets must be instances of " + "must be instances of instrumentCore.ParameterizedAction, functions, " + "or an instance of instrumentCore.Instrument that overrides its " + "actionTarget property with a reference to one of the above.");
                            }
                        };

                        var _iteratorNormalCompletion9 = true;
                        var _didIteratorError9 = false;
                        var _iteratorError9 = undefined;

                        try {
                            for (var _iterator9 = _getIterator(_Object$keys(v)), _step9; !(_iteratorNormalCompletion9 = (_step9 = _iterator9.next()).done); _iteratorNormalCompletion9 = true) {
                                var _targ = _step9.value;

                                checkTarget(v[_targ], _targ);
                            }
                        } catch (err) {
                            _didIteratorError9 = true;
                            _iteratorError9 = err;
                        } finally {
                            try {
                                if (!_iteratorNormalCompletion9 && _iterator9['return']) {
                                    _iterator9['return']();
                                }
                            } finally {
                                if (_didIteratorError9) {
                                    throw _iteratorError9;
                                }
                            }
                        }

                        util.objectLength.call(this[genTarget]);
                    }

                    /**
                     * The rhythmic sequence to execute.
                     * @property {Object} rhtyhmicSequence
                     */
                }, {
                    key: 'rhythmicSequence',
                    get: function get() {
                        return this[genSequence];
                    },
                    set: function set(v) {
                        var _iteratorNormalCompletion10 = true;
                        var _didIteratorError10 = false;
                        var _iteratorError10 = undefined;

                        try {
                            for (var _iterator10 = _getIterator(_Object$keys(v)), _step10; !(_iteratorNormalCompletion10 = (_step10 = _iterator10.next()).done); _iteratorNormalCompletion10 = true) {
                                var prop = _step10.value;

                                if (!('subd' in v[prop])) this[genPropError]('subd');else if (v[prop].subd < 0) this[genRangeError]('rhythm.' + prop + '.subd must be a number greater than 0.');

                                // TODO: enforce existance of targets
                                // TODO: allow not defining a val prop if only one target
                                // and no env recalculation
                                if (prop !== 'off' && !('val' in v[prop])) this[genPropError]('val');

                                if ('call' in v[prop]) {
                                    if (Array.isArray(v[prop].call)) v[prop].call.forEach(this[genIsFunction]);else this[genIsFunction](s[prop].call);
                                }
                            }
                        } catch (err) {
                            _didIteratorError10 = true;
                            _iteratorError10 = err;
                        } finally {
                            try {
                                if (!_iteratorNormalCompletion10 && _iterator10['return']) {
                                    _iterator10['return']();
                                }
                            } finally {
                                if (_didIteratorError10) {
                                    throw _iteratorError10;
                                }
                            }
                        }

                        this[genSequence] = null;
                        this[genSequence] = v;
                    }
                }]);

                return Generator;
            })();

            _export('default', Generator);
        }
    };
});
$__System.register('13', ['14', '15', 'd', 'e', 'f', 'a'], function (_export) {
    var _getIterator, _Object$keys, _createClass, _classCallCheck, _Symbol, util, clkQueue, clkSmudge, clkBpm, clkLast, clkNext, clkLen, clkIsOn, clkCycles, clkId, clkWasPaused, clkBeatStart, clkBeatRemaining, clkMachine, clkParamException, Clock;

    return {
        setters: [function (_) {
            _getIterator = _['default'];
        }, function (_2) {
            _Object$keys = _2['default'];
        }, function (_d) {
            _createClass = _d['default'];
        }, function (_e) {
            _classCallCheck = _e['default'];
        }, function (_f) {
            _Symbol = _f['default'];
        }, function (_a) {
            util = _a;
        }],
        execute: function () {
            /**
             * @module rhythm.Clock
             */

            /**
             * The clock class produces large-scale time intervals.
             * @namespace rhythm
             * @class Clock
             * @constructor
             * @param {number} tempo - Initial tempo in BPM
             * @param {number} smudgeFactor - Optional. initial amount of smudge - see this.smudgeFactor
             */
            'use strict';

            clkQueue = _Symbol();
            clkSmudge = _Symbol();
            clkBpm = _Symbol();
            clkLast = _Symbol();
            clkNext = _Symbol();
            clkLen = _Symbol();
            clkIsOn = _Symbol();
            clkCycles = _Symbol();
            clkId = _Symbol();
            clkWasPaused = _Symbol();
            clkBeatStart = _Symbol();
            clkBeatRemaining = _Symbol();
            clkMachine = _Symbol();
            clkParamException = _Symbol();

            Clock = (function () {
                function Clock(tempo, smudgeFactor) {
                    var _this = this;

                    _classCallCheck(this, Clock);

                    this[clkIsOn] = false;
                    this[clkCycles] = 0;
                    this[clkQueue] = {};

                    this[clkParamException] = function (mess) {
                        throw new RangeError("Invalid Clock param: ${mess}");
                    };

                    this[clkMachine] = function () {
                        _this[clkLast] = performance.now();
                        _this[clkNext] = _this[clkLast] + _this[clkLen];

                        var loop = function loop() {
                            var msec = 60000 / _this[clkBpm],
                                time = _this[clkSmudge] > 0 ? util.smudgeNumber(msec, _this[clkSmudge]) : msec;

                            _this[clkId] = window.setTimeout(function () {
                                _this[clkLast] = _this[clkNext];
                                _this[clkNext] = performance.now() + time;

                                _this[clkBeatStart] = performance.now();

                                var _iteratorNormalCompletion = true;
                                var _didIteratorError = false;
                                var _iteratorError = undefined;

                                try {
                                    for (var _iterator = _getIterator(_Object$keys(_this[clkQueue])), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                                        var fn = _step.value;

                                        _this[clkQueue][fn]();
                                    }
                                } catch (err) {
                                    _didIteratorError = true;
                                    _iteratorError = err;
                                } finally {
                                    try {
                                        if (!_iteratorNormalCompletion && _iterator['return']) {
                                            _iterator['return']();
                                        }
                                    } finally {
                                        if (_didIteratorError) {
                                            throw _iteratorError;
                                        }
                                    }
                                }

                                _this[clkCycles]++;

                                loop();
                            }, time);
                        };
                        loop();
                    };

                    this.bpm = tempo;
                    if (smudgeFactor) this.smudgeFactor = smudgeFactor;
                }

                _createClass(Clock, [{
                    key: 'add',

                    /**
                     * Adds a function to the queue to be executed on each beat.
                     * @method add
                     * @param {function} fn - function to add
                     * @return {number} - a hash that identifies this function in the queue.
                     *      Needed to remove this function from the clock.
                     */
                    value: function add(fn) {
                        var hash = util.hashCode((Math.random() * 100000).toString());
                        this[clkQueue][hash] = fn;
                        return hash;
                    }

                    /**
                     * Removes a function from the clock queue.
                     * @method remove
                     * @param {number} hash - hashCode of function in queue, obained by calling this.add. 
                     */
                }, {
                    key: 'remove',
                    value: function remove(hash) {
                        delete this[clkQueue][hash];
                    }

                    /**
                     * Start the clock.
                     * @method start
                     * @param {number} tempo - optional tempo at which to start the clock in bpm. 
                     */
                }, {
                    key: 'start',
                    value: function start(tempo) {
                        var _this2 = this;

                        if (this[clkIsOn]) {
                            this.stop();
                            this[clkIsOn] = false;
                            this.start(tempo);
                        } else {
                            this[clkIsOn] = true;
                            if (typeof tempo !== 'number' && typeof this.bpm === 'undefined') {
                                throw new Error("rhythm.Clock.Start can only be called without a bpm " + "param if a bpm was previously defined through assignment or " + "a prior start call.");
                            } else if (typeof v !== 'undefined') {
                                this.bpm = tempo;
                            }

                            if (this[clkWasPaused]) {
                                window.setTimeout(function () {
                                    return _this2[clkMachine]();
                                }, this[clkBeatRemaining]);
                                this[clkWasPaused] = false;
                            } else {
                                this[clkMachine]();
                            }
                        }
                    }

                    /**
                     * Stop the clock.
                     * @method stop
                     */
                }, {
                    key: 'stop',
                    value: function stop() {
                        this[clkIsOn] = false;
                        window.clearTimeout(this[clkId]);
                    }

                    /**
                     * Pause the clock. On start, will resume with the remainder of the
                     * last beat executed.
                     * @method pause
                     */
                }, {
                    key: 'pause',
                    value: function pause() {
                        this.stop();
                        this[clkWasPaused] = true;

                        var paused_at = performance.now() + 0.5 | 0;
                        this[clkBeatRemaining] = paused_at - this[clkBeatStart];
                    }
                }, {
                    key: 'dbg',
                    get: function get() {
                        return this[clkQueue];
                    }

                    /**
                     * Number of beats this clock has counted
                     * @property {number} cycleCount
                     */
                }, {
                    key: 'cycleCount',
                    get: function get() {
                        return this[clkCycles];
                    }

                    /**
                     * Indicates if this clock is currently running
                     * @property {boolean} isEngaged
                     */
                }, {
                    key: 'isEngaged',
                    get: function get() {
                        return this[clkIsOn];
                    }

                    /**
                     * Indicates the absolute time of the next beat in seconds from 0 being when
                     * scripts on this wobsite were started (uses performance.now)
                     * @property {number} nextBeat
                     */
                }, {
                    key: 'nextBeat',
                    get: function get() {
                        return this[clkNext];
                    }

                    /**
                     * Indicates the absolute time of the last beat fired in delta seconds from
                     * when the web page was loaded.
                     * @property {number} lastBeat
                     */
                }, {
                    key: 'lastBeat',
                    get: function get() {
                        return this[clkLast];
                    }

                    /**
                     * Indicates the length of the beat (sans any smudgeFactor adjustment) in msec
                     * @property {number} beatLength
                     */
                }, {
                    key: 'beatLength',
                    get: function get() {
                        return this[clkLen];
                    }

                    /**
                     * Set or get the BPM of this clock.
                     * @property {number} bpm
                     */
                }, {
                    key: 'bpm',
                    get: function get() {
                        return this[clkBpm];
                    },
                    set: function set(v) {
                        if (typeof v === 'number' && v > 0) {
                            this[clkBpm] = v;
                            this[clkLen] = 60000 / this.bpm;
                        } else {
                            this[clkParamException]("bpm must be a Number " + "greater than zero, not ${v}.");
                        }
                    }

                    /**
                     * Set or get a pecent within which to randomly distort the duration of each beat, 
                     * e.g., if smudgeFactor = 50, and the length of each beat is 1000ms, each beat 
                     * will be between 500 and 1500ms in duration.
                     * @property {number} smudgeFactor
                     */
                }, {
                    key: 'smudgeFactor',
                    get: function get() {
                        return this[clkSmudge];
                    },
                    set: function set(v) {
                        if (typeof v === 'number' && v >= 0) this[clkSmudge] = v;else this[clkParamException]("smudgeFactor must be " + "a Number greater than or equal to zero, not ${v}.");
                    }
                }]);

                return Clock;
            })();

            _export('default', Clock);
        }
    };
});
$__System.register('9', ['16', '17', '18', 'd', 'e', 'b', 'c', 'f', 'a'], function (_export) {
    var audioCore, audioUtil, TWEEN, _createClass, _classCallCheck, _get, _inherits, _Symbol, util, envelopeValueThrowException, envelopeValueValidateTimeRange, envelopeValueValue, envelopeValueTime, EnvelopeValue, envDuration, envInterpolationType, envInterpolationArgs, envValueSequence, envCheckEnvelopeValue, Envelope, AbsoluteEnvelopeValue, absEnvValueSequence, AbsoluteEnvelope, interpolation, cancelableTarg, cancelableFresh, cancelableSpoil, Cancelable, audioFatalFns, audioFatal;

    function concat() {
        var targets = [],
            isAbsolute = false,
            isFirst = true,
            total_duration = 0;

        for (var k = 0; k < arguments.length; k++) {
            if (isFirst && arguments[k] instanceof AbsoluteEnvelope) isAbsolute = true;

            if (isAbsolute && arguments[k] instanceof AbsoluteEnvelope || !isAbsolute && !(arguments[k] instanceof AbsoluteEnvelope)) {
                targets.push(arguments[k]);
            } else {
                throw new TypeError('envelopeCore.concat error: cannot concat non-absolute ' + 'and absolute time envelopes together.');
            }
            total_duration += arguments[k].duration;
            isFirst = false;
        }

        var concatted = undefined;
        if (isAbsolute) {
            concatted = new AbsoluteEnvelope(total_duration);
        } else {
            concatted = new Envelope();
            concatted.duration = total_duration;
        }

        var last_duration = 0,
            envValues = [],
            scale = 0,
            last_scale = 0;

        targets.forEach(function (env) {
            if (!isAbsolute) scale = env.duration / total_duration;

            env.valueSequence.forEach(function (item) {
                if (isAbsolute) {
                    envValues.push(new AbsoluteEnvelopeValue(item.value, item.time + last_duration, item.interpolationType, item.interpolationArgs));
                } else {
                    envValues.push(new EnvelopeValue(item.value, item.time * scale + last_scale));
                }
            });
            last_scale += scale * 100;
            last_duration += env.duration;
        });

        concatted.valueSequence = envValues;

        if (!isAbsolute) {
            concatted.interpolationType = arguments[0].interpolationType;
            concatted.interpolationArgs = arguments[0].interpolationArgs;
        }

        return concatted;
    }

    function apply(target, envelope, offset) {
        var r = undefined;

        // if the target is an AudioParam, this is all pretty easy
        var off = typeof offset === 'number' ? offset : 10;

        if (target instanceof AudioParam) {
            envelope.valueSequence.forEach(function (val) {
                var t = audioCore.ctx.currentTime + util.time.msec2sec(off) + util.time.msec2sec(val.time);
                try {
                    if (val.interpolationType === 'linear') {
                        target.linearRampToValueAtTime(val.value, t);
                    } else if (val.interpolationType === 'exponential') {
                        target.exponentialRampToValueAtTime(val.value, t);
                    } else if (val.interpolationType === 'none') {
                        target.setValueAtTime(val.value, t);
                    }
                } catch (e) {
                    // this branch is usually reached if there are audio driver problems
                    audioFatal.exec();
                }
            });

            r = target;
        } else {
            (function () {
                // ARRGH! It's an arbitrary function!
                // So, we assume that updating at visual rate is a-ok,
                // and, I hope you don't expect to do any supa kewl microtiming
                // involving intervals less than 10-15 msec or so.
                // TODO: need to initialize this properly
                // works assuming that first value is at time 0
                var params = { value: envelope.valueSequence[0].value },
                    machine = new TWEEN.Tween(params);

                machine.onUpdate(function () {
                    return target(params.value);
                });

                var first = true,
                    prior_time = off,
                    onCompleteCache = [],
                    c = 0;

                var queryCompleteCache = function queryCompleteCache() {
                    return onCompleteCache[c++] ? onCompleteCache[c] : false;
                };

                var addToMachineQueue = function addToMachineQueue(v) {
                    var cycle = function cycle() {
                        if (v.interpolationType === 'linear') machine.easing(TWEEN.Easing.Linear);else if (v.interpolationType === 'exponential') machine.easing(TWEEN.Easing.Exponential);

                        machine.to({ value: v.value }, v.time - prior_time);
                        machine.onUpdate(function () {
                            return target(params.value);
                        });

                        var fn = queryCompleteCache();
                        if (fn) machine.onComplete(fn);
                        machine.start();
                    };

                    if (first) cycle(); // offset goes here??
                    else onCompleteCache.push(cycle);

                    prior_time = v.time + off;
                };

                var timeout_ids = [],
                    uses_interpolation = false;

                // need to start and stop machine when interpolation is 'none'
                // i.e., TODO: account for case where sequence switches between none
                // and other types
                envelope.valueSequence.forEach(function (val) {
                    if (val.interpolationType === 'none') {
                        var tid = window.setTimeout(function () {
                            return target(val.value);
                        }, offset + val.time);
                        timeout_ids.push(tid);
                    } else {
                        uses_interpolation = true;
                        addToMachineQueue(val);
                    }
                });

                if (uses_interpolation) {
                    onCompleteCache.push(function () {
                        audioUtil.stopTweens();
                        machine = null;
                    });
                    audioUtil.tween.startTweens();
                    machine.start();
                    r = machine;
                } else {
                    machine = null;
                    r = timeout_ids;
                }
            })();
        }

        return new Cancelable(r, envelope.duration + off);
    }

    function arrayToEnvelopeValues(arr) {
        var r = [];
        for (var i = 0; i < arr.length; i += 2) {
            r.push(new EnvelopeValue(arr[i], arr[i + 1]));
        }
        return r;
    }

    return {
        setters: [function (_) {
            audioCore = _;
        }, function (_2) {
            audioUtil = _2;
        }, function (_3) {
            TWEEN = _3['default'];
        }, function (_d) {
            _createClass = _d['default'];
        }, function (_e) {
            _classCallCheck = _e['default'];
        }, function (_b) {
            _get = _b['default'];
        }, function (_c) {
            _inherits = _c['default'];
        }, function (_f) {
            _Symbol = _f['default'];
        }, function (_a) {
            util = _a;
        }],
        execute: function () {
            'use strict';

            _export('concat', concat);

            _export('apply', apply);

            _export('arrayToEnvelopeValues', arrayToEnvelopeValues);

            envelopeValueThrowException = _Symbol();
            envelopeValueValidateTimeRange = _Symbol();
            envelopeValueValue = _Symbol();
            envelopeValueTime = _Symbol();

            EnvelopeValue = (function () {
                function EnvelopeValue(value, time) {
                    var _this = this;

                    _classCallCheck(this, EnvelopeValue);

                    this[envelopeValueThrowException] = function (text) {
                        throw new Error("Invalid EnvelopeValue param: " + text);
                    };

                    this[envelopeValueValidateTimeRange] = function (t) {
                        if (t < 0 && t > 100) {
                            _this[envelopeValueThrowException]("EnvelopeValue.time must be a percentage " + "between 0 and 100 inclusive");
                        } else {
                            return t;
                        }
                    };

                    if (typeof value !== 'undefined' && typeof time !== 'undefined') {
                        this.value = value;
                        this.time = time;
                    }
                }

                _createClass(EnvelopeValue, [{
                    key: 'time',
                    get: function get() {
                        return this[envelopeValueTime];
                    },
                    set: function set(v) {
                        this[envelopeValueTime] = this[envelopeValueValidateTimeRange](v);
                    }
                }]);

                return EnvelopeValue;
            })();

            _export('EnvelopeValue', EnvelopeValue);

            envDuration = _Symbol();
            envInterpolationType = _Symbol();
            envInterpolationArgs = _Symbol();
            envValueSequence = _Symbol();
            envCheckEnvelopeValue = _Symbol();

            Envelope = (function () {
                function Envelope() {
                    _classCallCheck(this, Envelope);

                    var throwEnvelopeException = function throwEnvelopeException(text) {
                        throw new Error("Envelope param error: " + text);
                    };

                    this[envCheckEnvelopeValue] = function (val) {
                        if (!(val instanceof EnvelopeValue)) {
                            throwEnvelopeException("item in valueSequence must be an instance of " + "envelopeCore.EnvelopeValue, not " + val);
                        }
                        if (val.time < 0 || val.time > 100) {
                            throwEnvelopeException("valueSequenceItem.time must be " + "a percentage between 0 and 100 inclusive, not " + val.time);
                        }
                    };

                    this[envDuration];
                    this[envInterpolationType];
                    this[envInterpolationArgs];
                    this[envValueSequence];
                }

                _createClass(Envelope, [{
                    key: 'bake',

                    // interleaves the values of two Envelopes together,
                    // repeating the modEnv over this.duration at an interval of
                    // modDurPercent * 0.01 * this.duration
                    // TODO: throw error if asttempting to bake with an envelope
                    // that has values that are not numbers.
                    value: function bake(modEnvelope, modDuration, refractMagnitude) {
                        var throwBakeException = function throwBakeException(text) {
                            throw new Error("Invalid envelopeCore.bake args: " + text);
                        };

                        if (!(modEnvelope instanceof Envelope)) throwBakeException("MODENV must be an instance of envelopeCore.Envelope");

                        if (modDuration < 0 && modDuration > 100) throwBakeException("MODDURPERCENT must be a NUMBER greater than 0 and " + "less than or equal to 100, not" + modDuration);

                        if (refractMagnitude < 0 && refractMagnitude > 1) throwBakeException("REFRACTMAG must be a NUMBER greater than 0 and " + "less than or equal to 1, not" + refractMagnitude);

                        var cooked = new Envelope(),
                            values = this.valueSequence.slice(0);

                        values.sort(function (a, b) {
                            return a.time - b.time;
                        });

                        var modValues = [],
                            repeats = 0.01 * modDuration + 0.5 | 0,
                            last_time = 0;

                        // create array with modEnv repeating to 100%
                        for (var i = 1; i <= repeats + 1; i++) {
                            modEnvelope.valueSequence.forEach(function (item) {
                                var t = item.time / repeats + last_time;
                                if (t <= 100) modValues.push(new EnvelopeValue(item.value, t));
                            });
                            last_time += 100 / repeats | 0;
                        }

                        var inter_values = [],
                            last_val = { value: -999, time: -999 };

                        values.reduce(function (previous, current) {
                            for (var l = 0; l < modValues.length; l++) {
                                if (modValues[l].time >= previous.time && modValues[l].time <= current.time && modValues[l].time !== last_val.time) {
                                    var inter = interpolation.linearRefraction(previous, current, modValues[l], refractMagnitude);
                                    inter_values.push(inter);
                                    last_val = inter;
                                }
                            }
                            return current;
                        });

                        filtered_values = [];

                        // rm original values if overlapping with time in inter_values
                        values.forEach(function (val) {
                            var found = false;
                            for (var _j = 0; _j < inter_values.length; _j++) {
                                if (val.time === inter_values[_j].time) {
                                    found = true;
                                    break;
                                }
                            }
                            // TODO: the undefined check here patches over some weird behavior in
                            // envelopeAsdr.Sustain.bake() where inter_values[j] was sometimes undefined.
                            // THIS IS SUPER STUPID!
                            if (!found && typeof inter_values[j] !== 'undefined') filtered_values.push(inter_values[j].time);
                        });

                        var final_val = filtered_values.concat(inter_values);

                        final_val.sort(function (a, b) {
                            return a.time - b.time;
                        });

                        cooked.valueSequence = final_val;
                        cooked.duration = this.duration;
                        cooked.interpolationType = modEnvelope.interpolationType;
                        cooked.interpolationArgs = modEnvelope.interpolationArgs;

                        return cooked;
                    }
                }, {
                    key: 'toAbsolute',
                    value: function toAbsolute(duration) {
                        var _this2 = this;

                        var d = duration ? duration : this.duration,
                            absolute = new AbsoluteEnvelope(d);

                        var vals = [];

                        this.valueSequence.forEach(function (item) {
                            var t = absolute.duration * item.time * 0.01,
                                ev = new AbsoluteEnvelopeValue(item.value, t, _this2.interpolationType, _this2.interpolationArgs);
                            vals.push(ev);
                        });

                        absolute.valueSequence = vals;
                        return absolute;
                    }
                }, {
                    key: 'valueSequence',
                    get: function get() {
                        return this[envValueSequence];
                    },
                    set: function set(val) {
                        var _arguments = arguments,
                            _this3 = this;

                        // override?, tests...
                        if (arguments.length > 2) {
                            var checks = [];
                            for (var i = 2; i < arguments.length; i++) {
                                checks.push(arguments[i]);
                            }
                        }
                        var runAddlChecks = function runAddlChecks(item) {
                            if (checks) {
                                checks.forEach(function (test) {
                                    test(item);
                                });
                            }
                        };
                        if (Array.isArray(val)) {
                            if (!(val[0] instanceof EnvelopeValue)) {
                                this[envValueSequence] = arrayToEnvelopeValues(val);
                            } else {
                                var seq = [];
                                val.forEach(function (v) {
                                    if (!_arguments[1]) _this3[envCheckEnvelopeValue](v);
                                    runAddlChecks(v);
                                    seq.push(v);
                                });
                                this[envValueSequence] = seq;
                            }
                        } else {
                            if (!arguments[1]) this[envCheckEnvelopeValue](val);
                            runAddlChecks(val);
                            this[envValueSequence] = [val];
                        }
                    }
                }, {
                    key: 'duration',
                    get: function get() {
                        return this[envDuration];
                    },
                    set: function set(v) {
                        if (v >= 0 || v === null) this[envDuration] = v;else throwEnvelopeException("duration must be a number >= 0 or null not " + val);
                    }
                }, {
                    key: 'interpolationType',
                    get: function get() {
                        return this[envInterpolationType];
                    },
                    set: function set(val) {
                        if (val === "linear" || val === "exponential" || val === "none" || val === "stairstep") {
                            this[envInterpolationType] = val;
                        } else {
                            throwEnvelopeException("interpolation must be 'linear', 'exponential', " + "'none', or 'stairstep', not " + val);
                        }
                    }
                }, {
                    key: 'interpolationArgs',
                    get: function get() {
                        return this[envInterpolationArgs];
                    },
                    set: function set(v) {
                        if (this[envInterpolationType] === "stairstep") {
                            if (val > 0) {
                                this[envInterpolationArgs] = v;
                            } else {
                                throwEnvelopeException("if using stairstep interpolation, " + "a number of steps > 0 must be provided.");
                            }
                        }
                    }
                }]);

                return Envelope;
            })();

            _export('Envelope', Envelope);

            AbsoluteEnvelopeValue = (function (_EnvelopeValue) {
                _inherits(AbsoluteEnvelopeValue, _EnvelopeValue);

                function AbsoluteEnvelopeValue(value, time, interpolationType, interpolationArgs) {
                    _classCallCheck(this, AbsoluteEnvelopeValue);

                    _get(Object.getPrototypeOf(AbsoluteEnvelopeValue.prototype), 'constructor', this).call(this);
                    this.value = value;
                    this.time = time;
                    this.interpolationType = interpolationType;
                    this.interpolationArgs = interpolationArgs;
                }

                return AbsoluteEnvelopeValue;
            })(EnvelopeValue);

            _export('AbsoluteEnvelopeValue', AbsoluteEnvelopeValue);

            absEnvValueSequence = _Symbol();

            AbsoluteEnvelope = (function (_Envelope) {
                _inherits(AbsoluteEnvelope, _Envelope);

                function AbsoluteEnvelope(duration) {
                    _classCallCheck(this, AbsoluteEnvelope);

                    _get(Object.getPrototypeOf(AbsoluteEnvelope.prototype), 'constructor', this).call(this);
                    delete this.interpolationType;
                    delete this.interpolationArgs;
                    delete this.bake;
                    delete this.toAbsolute;
                    delete this.valueSequence;

                    Object.defineProperty(this, 'duration', {
                        value: duration,
                        writable: false
                    });

                    this[absEnvValueSequence] = [];
                }

                _createClass(AbsoluteEnvelope, [{
                    key: 'valueSequence',
                    get: function get() {
                        return this[absEnvValueSequence];
                    },
                    set: function set(v) {
                        var checkAbEnvVal = function checkAbEnvVal(abval) {
                            if (!(abval instanceof AbsoluteEnvelopeValue)) {
                                throw new TypeError("Invalid AbsoluteEnvelope param: " + "valueSequence must be comprised of AbsoluteEnvelopeValue objects");
                            }
                        };
                        if (Array.isArray(v)) {
                            v.forEach(checkAbEnvVal);
                            this[absEnvValueSequence] = v;
                        } else {
                            checkAbEnvVal(v);
                            this[absEnvValueSequence].push(v);
                        }
                    }
                }]);

                return AbsoluteEnvelope;
            })(Envelope);

            _export('AbsoluteEnvelope', AbsoluteEnvelope);

            interpolation = (function () {
                function interpolation() {
                    _classCallCheck(this, interpolation);
                }

                _createClass(interpolation, null, [{
                    key: 'linearRefraction',
                    value: function linearRefraction(a, b, n, refractMag) {
                        var dy = b.value - a.value,
                            dx = b.time - a.time,
                            slope = dy / dx,
                            intercept = a.value;

                        var inter_val = slope * (n.time - a.time) + intercept;

                        var point = new EnvelopeValue(inter_val, n.time);

                        point.value += n.value * refractMag;

                        return point;
                    }
                }]);

                return interpolation;
            })();

            _export('interpolation', interpolation);

            cancelableTarg = _Symbol();
            cancelableFresh = _Symbol();
            cancelableSpoil = _Symbol();

            Cancelable = (function () {
                function Cancelable(t, expiration) {
                    var _this4 = this;

                    _classCallCheck(this, Cancelable);

                    this[cancelableTarg] = t;
                    var expiry = expiration;

                    this[cancelableFresh] = 1;

                    this[cancelableSpoil] = function () {
                        _this4[cancelableFresh] = 0;
                        _this4.cancel = function () {};
                        _this4[cancelableTarg] = null;
                    };

                    window.setTimeout(this[cancelableSpoil], expiry);
                }

                _createClass(Cancelable, [{
                    key: 'cancel',
                    value: function cancel() {
                        if (this[cancelableTarg] instanceof TWEEN.Tween) {
                            this[cancelableTarg].stop();
                            this[cancelableTarg] = null;
                            audioUtil.tween.stopTweens();
                        } else if (this[cancelableTarg] instanceof AudioParam) {
                            this[cancelableTarg].cancelScheduledValues(audioCore.ctx.currentTime);
                        } else if (Array.isArray(targ)) {
                            this[cancelableTarg].forEach(function (v) {
                                return window.clearTimeout(v);
                            });
                        }
                        this[cancelableSpoil]();
                    }
                }, {
                    key: 'fresh',
                    get: function get() {
                        return this[cancelableFresh];
                    }
                }]);

                return Cancelable;
            })();

            audioFatalFns = _Symbol();

            audioFatal = (function () {
                function audioFatal() {
                    _classCallCheck(this, audioFatal);

                    this[audioFatalFns] = [];
                }

                _createClass(audioFatal, null, [{
                    key: 'addCallback',
                    value: function addCallback(fn) {
                        if (typeof fn === 'function') this[audioFatalFns].push(fn);else throw new TypeError("addAudioFatalCallback error: can only accept functions");
                    }
                }, {
                    key: 'exec',
                    value: function exec() {
                        this[audioFatalFns].forEach(function (fn) {
                            return fn();
                        });
                    }
                }]);

                return audioFatal;
            })();

            _export('audioFatal', audioFatal);
        }
    };
});
$__System.register('12', ['9', 'd', 'e', 'f'], function (_export) {
  var apply, AbsoluteEnvelope, _createClass, _classCallCheck, _Symbol, paTarget, paEnv, paType, paError, ParameterizedAction;

  return {
    setters: [function (_) {
      apply = _.apply;
      AbsoluteEnvelope = _.AbsoluteEnvelope;
    }, function (_d) {
      _createClass = _d['default'];
    }, function (_e) {
      _classCallCheck = _e['default'];
    }, function (_f) {
      _Symbol = _f['default'];
    }],
    execute: function () {
      /**
       * @module instrument.ParameterizedAction
       */

      /**
       * The ParameterizedAction object is a wrapper around a WAAPI AudioParam or
       * arbitrary function and an envelope and/or a function that can generate envelopes.
       * @namespace instrument
       * @class ParameterizedAction
       * @constructor
       * @param {AudioParam | Function} target - optional on construction. 
       * @param {AbsoluteEnvelope} envelope - optional on construction. 
       */

      'use strict';

      paTarget = _Symbol();
      paEnv = _Symbol();
      paType = _Symbol();
      paError = _Symbol();

      ParameterizedAction = (function () {
        function ParameterizedAction(target, envelope) {
          _classCallCheck(this, ParameterizedAction);

          this[paError] = function (mess) {
            throw new TypeError("Invalid instrumentCore.ParameterizedAction param: " + mess);
          };

          /**
           * To dynamically create envelopes, override createEnvelope with a function
           * that returns an AbsoluteEnvelope. Then, rhythm.Generator will call this
           * function with arguments provided through seq[idx].val in the rhythm.Generator
           * config object. 
           *
           * @example
           *                      
           *      let thinglydoo = new ParameterizedAction(gain.gain);
           *  
           *      thinglydoo.createEnvelope = (params) => {
           *          // ...create an envelope, do other work with the params object...
           *          return env.toAbsolute();
           *      };
           *
           *      let generator = new rudy.rhythm.Generator({
           *          opt: { ... },
           *          targets: {
           *              thing: thinglydoo
           *          },
           *          seq: {
           *              0: {
           *                  subd: 0.1,
           *                  // value of 'thing', in this case an object ref, 
           *                  // is passed to thinglydoo.createEnvelope
           *                  val: {
           *                      thing: {
           *                          flip: 'flop',
           *                          marn: 'barn' 
           *                      }   
           *                  }
           *              }
           *          }     
           *      });
           *      
           * @property {function} createEnvelope
           * @default null
           */
          this.createEnvelope = null;

          if (target) this.target = target;
          if (envelope) this.envelope = envelope;
        }

        /**
         * The AudioParam or function which will have an envelope applied to it. 
         * @property {AudioParam | function} target
         */

        _createClass(ParameterizedAction, [{
          key: 'execute',

          /**
           * execute() facilitates manually applying this.envelope to this.target.  Try to 
           * avoid this, but, it may be useful in certain circumstances.
           * @method execute
           */
          value: function execute(offset) {
            apply(this.target, this.envelope, offset);
          }
        }, {
          key: 'target',
          get: function get() {
            return this[paTarget];
          },
          set: function set(v) {
            var type = undefined;

            if (v instanceof AudioParam) type = 'AudioParam';else if (typeof v === 'function') type = 'function';else this[paError](".target must be an instance of AudioParam or a function.");

            this[paType] = type;
            this[paTarget] = v;
          }

          /**
           * String indicating the type of this.target
           * @property {String} type
           */
        }, {
          key: 'type',
          get: function get() {
            return this[paType];
          }

          /**
           * The envelope to apply to this.target.
           * Favor using this property if the envelope to apply will remain static, as
           * may be the case in certain circumstances, e.g. for percussion instruments.
           * @property {AbsoluteEnvelope} envelope
           */
        }, {
          key: 'envelope',
          get: function get() {
            return this[paEnv];
          },
          set: function set(v) {
            if (v instanceof AbsoluteEnvelope) this[paEnv] = v;else this[paError]("envelope must be an instance of envelopeCore.AbsoluteEnvelope");
          }
        }]);

        return ParameterizedAction;
      })();

      _export('ParameterizedAction', ParameterizedAction);
    }
  };
});
$__System.register('19', ['16', 'b', 'c', 'e'], function (_export) {
  var AudioModule, _get, _inherits, _classCallCheck, Instrument;

  return {
    setters: [function (_) {
      AudioModule = _.AudioModule;
    }, function (_b) {
      _get = _b['default'];
    }, function (_c) {
      _inherits = _c['default'];
    }, function (_e) {
      _classCallCheck = _e['default'];
    }],
    execute: function () {
      /**
       * @module instrument.Instrument
       */

      /**
       * Base class for instruments
       * @namespace instrument
       * @class Instrument
       * @extends audio.core.AudioModule
       * @constructor
       */
      'use strict';

      Instrument = (function (_AudioModule) {
        _inherits(Instrument, _AudioModule);

        function Instrument() {
          _classCallCheck(this, Instrument);

          _get(Object.getPrototypeOf(Instrument.prototype), 'constructor', this).call(this);
          /**
           * overriding the actionTarget property with a ParameterizedAction allows
           * the instrument itself to be used within the Generator config .targets
           * object. This may be useful for simple instruments. However, for most 
           * instruments, multiple targets will be required and individually targeted
           * in .targets
           * @property {ParameterizedAction} actionTarget
           * @default null
           */
          this.actionTarget = null;
        }

        return Instrument;
      })(AudioModule);

      _export('Instrument', Instrument);
    }
  };
});
$__System.register("1a", ["16", "17", "b", "c", "d", "e", "f", "1b", "a"], function (_export) {
    var ctx, parseSpriteIntervals, _get, _inherits, _createClass, _classCallCheck, _Symbol, MediaElementPlayer, util, envelopeSprite, spriteList, ptoid, SpritePlayer;

    return {
        setters: [function (_2) {
            ctx = _2.ctx;
        }, function (_) {
            parseSpriteIntervals = _.parseSpriteIntervals;
        }, function (_b) {
            _get = _b["default"];
        }, function (_c) {
            _inherits = _c["default"];
        }, function (_d) {
            _createClass = _d["default"];
        }, function (_e) {
            _classCallCheck = _e["default"];
        }, function (_f) {
            _Symbol = _f["default"];
        }, function (_b2) {
            MediaElementPlayer = _b2.MediaElementPlayer;
        }, function (_a) {
            util = _a;
        }],
        execute: function () {
            /**
             * @module audio.modules.SpritePlayer
             */

            /**
             * A sprite player built around the MediaElementPlayer. 
             * @namespace audio.modules
             * @class SpritePlayer
             * @extends audio.modules.MediaElementPlayer
             * @constructor
             * @param {String} path - path to audio file
             * @param {String} intervals - string from .TextGridIntervals file
             */
            "use strict";

            envelopeSprite = _Symbol();
            spriteList = _Symbol();
            ptoid = _Symbol();

            SpritePlayer = (function (_MediaElementPlayer) {
                _inherits(SpritePlayer, _MediaElementPlayer);

                function SpritePlayer(path, intervals) {
                    var _this = this;

                    _classCallCheck(this, SpritePlayer);

                    _get(Object.getPrototypeOf(SpritePlayer.prototype), "constructor", this).call(this, path, true);

                    this[spriteList] = parseSpriteIntervals(intervals);
                    util.objectLength.call(this[spriteList]);

                    this[ptoid];

                    this[envelopeSprite] = function (val) {
                        return _this.gain.setValueAtTime(val, ctx.currentTime + 0.01);
                    };
                }

                /**
                 * Play a specific or random sprite
                 * @method playSprite
                 * @param {number} index - 0 indexed sprite by order in which they occur in 
                 *      audio file. If left undefined, will play a random sprite. 
                 * @default play a random sprite
                 */

                _createClass(SpritePlayer, [{
                    key: "playSprite",
                    value: (function (_playSprite) {
                        function playSprite(_x) {
                            return _playSprite.apply(this, arguments);
                        }

                        playSprite.toString = function () {
                            return _playSprite.toString();
                        };

                        return playSprite;
                    })(function (idx) {
                        var _this2 = this;

                        if (!this.isPlaying) {
                            var sprite = typeof idx === 'undefined' ? this[spriteList][Math.random() * this[spriteList].length | 0] : this[spriteList][idx];

                            var dur = sprite.end - sprite.start;

                            this.currentTime = sprite.start;

                            if ("xxxFEATURE_DETECTIONxxx") {
                                this.gain.value = 0;
                                this[envelopeSprite](1.0);
                            }
                            this.play();
                            this[ptoid] = window.setTimeout(function () {
                                if ("xxxFEATURE_DETECTIONxxx") _this2[envelopeSprite](0);
                                _this2.pause();
                            }, dur * 1000);
                        } else {
                            this.pause();
                            window.clearTimeout(this[ptoid]);
                            playSprite(idx);
                        }
                    })
                }]);

                return SpritePlayer;
            })(MediaElementPlayer);

            _export("SpritePlayer", SpritePlayer);
        }
    };
});
$__System.register('1c', ['16', 'b', 'c', 'e', 'd', 'f', '1d', '1e'], function (_export) {
    var AudioModule, ctx, _get, _inherits, _classCallCheck, _createClass, _Symbol, audioNodes, moduleExtensions, AllPass, FeedbackCombFilter, schroederComb1, schroederComb2, schroederComb3, schroederComb4, schroederFeedbackCoeffMultiplier, schroederPAR_A_GAIN, schroederPAR_B_GAIN, schroederPAR_C_GAIN, schroederPAR_D_GAIN, SchroederReverb;

    return {
        setters: [function (_) {
            AudioModule = _.AudioModule;
            ctx = _.ctx;
        }, function (_b) {
            _get = _b['default'];
        }, function (_c) {
            _inherits = _c['default'];
        }, function (_e) {
            _classCallCheck = _e['default'];
        }, function (_d) {
            _createClass = _d['default'];
        }, function (_f) {
            _Symbol = _f['default'];
        }, function (_d2) {
            audioNodes = _d2;
        }, function (_e2) {
            moduleExtensions = _e2;
        }],
        execute: function () {
            /**
             * @module audio.modules.SchroederReverb
             */

            'use strict';

            AllPass = (function (_AudioModule) {
                _inherits(AllPass, _AudioModule);

                function AllPass(delay) {
                    _classCallCheck(this, AllPass);

                    _get(Object.getPrototypeOf(AllPass.prototype), 'constructor', this).call(this);

                    var nop = audioNodes.Gain();
                    this.delay = audioNodes.Delay(1);
                    this.delay.delayTime.value = delay;
                    this.feedforwardGain = audioNodes.Gain();
                    this.feedforwardGain.gain.value = 0.7;
                    var nopOut = audioNodes.Gain();

                    nop.link(this.delay).link(this.feedforwardGain).link(nopOut);
                    nop.link(nopOut);

                    this._link_alias_in = nop;
                    this._link_alias_out = nopOut;
                }

                return AllPass;
            })(AudioModule);

            FeedbackCombFilter = (function (_AudioModule2) {
                _inherits(FeedbackCombFilter, _AudioModule2);

                function FeedbackCombFilter(delay, feedback) {
                    _classCallCheck(this, FeedbackCombFilter);

                    _get(Object.getPrototypeOf(FeedbackCombFilter.prototype), 'constructor', this).call(this);

                    var nop = audioNodes.Gain();
                    this.delay = audioNodes.Delay(1);
                    this.delay.delayTime.value = delay;
                    this.feedbackGain = audioNodes.Gain();
                    this.feedbackGain.gain.value = feedback;
                    var nopOut = audioNodes.Gain();

                    nop.link(this.delay).link(this.feedbackGain).link(nop);
                    nop.link(nopOut);

                    this._link_alias_in = nop;
                    this._link_alias_out = nopOut;
                }

                /**
                 * An implementation of a classic schroeder reverb, similar to 
                 * https://ccrma.stanford.edu/~jos/pasp/Schroeder_Reverberators.html
                 * @namespace audio.modules
                 * @class SchroederReverb
                 * @extends audio.core.AudioModule
                 * @constructor
                 */
                return FeedbackCombFilter;
            })(AudioModule);

            schroederComb1 = _Symbol();
            schroederComb2 = _Symbol();
            schroederComb3 = _Symbol();
            schroederComb4 = _Symbol();
            schroederFeedbackCoeffMultiplier = _Symbol();
            schroederPAR_A_GAIN = _Symbol();
            schroederPAR_B_GAIN = _Symbol();
            schroederPAR_C_GAIN = _Symbol();
            schroederPAR_D_GAIN = _Symbol();

            SchroederReverb = (function (_AudioModule3) {
                _inherits(SchroederReverb, _AudioModule3);

                function SchroederReverb() {
                    _classCallCheck(this, SchroederReverb);

                    _get(Object.getPrototypeOf(SchroederReverb.prototype), 'constructor', this).call(this);

                    this[schroederFeedbackCoeffMultiplier] = 1;

                    var BASE_TIME = 0.011,
                        SERIES_B_DIV = 3,
                        SERIES_C_DIV = 9.1,
                        PAR_A_MULT = 4.86167;
                    this[schroederPAR_A_GAIN] = 0.773;
                    var PAR_B_MULT = 4.61383;
                    this[schroederPAR_B_GAIN] = 0.802;
                    var PAR_C_MULT = 5.91642;
                    this[schroederPAR_C_GAIN] = 0.753;
                    var PAR_D_MULT = 6.48703;
                    this[schroederPAR_D_GAIN] = 0.733;

                    var dry = audioNodes.Split(2);

                    var all1 = new AllPass(BASE_TIME),
                        all2 = new AllPass(BASE_TIME / SERIES_B_DIV),
                        all3 = new AllPass(BASE_TIME / SERIES_C_DIV);

                    var split = audioNodes.Split(4);

                    this[schroederComb1] = new FeedbackCombFilter(BASE_TIME * PAR_A_MULT, this[schroederPAR_A_GAIN]);
                    this[schroederComb2] = new FeedbackCombFilter(BASE_TIME * PAR_B_MULT, this[schroederPAR_B_GAIN]);
                    this[schroederComb3] = new FeedbackCombFilter(BASE_TIME * PAR_C_MULT, this[schroederPAR_C_GAIN]);
                    this[schroederComb4] = new FeedbackCombFilter(BASE_TIME * PAR_D_MULT, this[schroederPAR_D_GAIN]);

                    var mergeL = audioNodes.Merge(2),
                        mergeR = audioNodes.Merge(2);

                    var wetGain = audioNodes.Gain(),
                        dryGain = audioNodes.Gain(),
                        gain = audioNodes.Gain();

                    /**
                     * Controls how much reverb is mixed into output
                     * @method wetDry
                     * @param {number} wet - 0 to 100 inclusive - 100 = 100% wet output
                     * @param {number} time - milliseconds over which to linearly envelope wet/dry percentage
                     * @default 50
                     */
                    moduleExtensions.linearCrossfade(this, dryGain, wetGain, 'wetDry');
                    this.wetDry(50);

                    /**
                     * AudioParam that can be used to control output gain.
                     * @property {AudioParam} gain
                     */
                    this.gain = gain.gain;

                    /**
                     * Input node
                     * @property {AudioNode} _link_alias_in
                     * @extends audio.core.AudioModule._link_alias_in
                     */
                    this._link_alias_in = dry;

                    /**
                     * Output node
                     * @property {AudioNode} _link_alias_out
                     * @extends audio.core.AudioModule._link_alias_out
                     */
                    this._link_alias_out = gain;

                    /*
                     * connections
                     */
                    dry.link(all1).link(all2).link(all3).link(split);

                    split.link(this[schroederComb1], 0).link(mergeL, 0, 0);
                    split.link(this[schroederComb2], 1).link(mergeR, 0, 0);
                    split.link(this[schroederComb3], 0).link(mergeL, 0, 1).link(wetGain);
                    split.link(this[schroederComb4], 1).link(mergeR, 0, 1).link(wetGain).link(gain);

                    dry.link(dryGain).link(gain);
                }

                /**
                 * Sets a multiplier by which to modulate the feedbacck gain of each comb filter
                 * in the parallel stage of the reverb. CAUTION: setting this value too high
                 * can result in uncontrolled feedback, and if this persists for too long, can kill
                 * all audio playback.
                 * @method setFeedbackCoeffMultiplier
                 * @param {number} multiplier - number above 0, generally less than 2.
                 * @param {number} time - optional. time in milliseconds over which to linearly
                 *      envelope multiplier
                 */

                _createClass(SchroederReverb, [{
                    key: 'setFeedbackCoeffMultiplier',
                    value: function setFeedbackCoeffMultiplier(n, time) {
                        var t = time ? time / 1000 : 0;
                        this[schroederComb1].feedbackGain.gain.linearRampToValueAtTime(this[schroederPAR_A_GAIN] * n, ctx.currentTime + t);
                        this[schroederComb2].feedbackGain.gain.linearRampToValueAtTime(this[schroederPAR_B_GAIN] * n, ctx.currentTime + t);
                        this[schroederComb3].feedbackGain.gain.linearRampToValueAtTime(this[schroederPAR_C_GAIN] * n, ctx.currentTime + t);
                        this[schroederComb4].feedbackGain.gain.linearRampToValueAtTime(this[schroederPAR_D_GAIN] * n, ctx.currentTime + t);

                        this[schroederFeedbackCoeffMultiplier] = n;
                    }

                    /**
                     * @property {number} feedbackCoeffMultiplier
                     * @readOnly
                     */
                }, {
                    key: 'feedbackCoeffMultiplier',
                    get: function get() {
                        return this[schroederFeedbackCoeffMultiplier];
                    }
                }]);

                return SchroederReverb;
            })(AudioModule);

            _export('SchroederReverb', SchroederReverb);
        }
    };
});
$__System.register('1f', ['14', '15', '16', '17', '20', 'b', 'c', 'd', 'e', 'f', 'a'], function (_export) {
    var _getIterator, _Object$keys, AudioModule, ctx, parseSpriteIntervals, taffyFactory, _Promise, _get, _inherits, _createClass, _classCallCheck, _Symbol, util, sampleBuffer, gainNode, breakpoints, livingNodes, sampleDb, readyFn, SamplePlayer;

    return {
        setters: [function (_2) {
            _getIterator = _2['default'];
        }, function (_3) {
            _Object$keys = _3['default'];
        }, function (_4) {
            AudioModule = _4.AudioModule;
            ctx = _4.ctx;
        }, function (_5) {
            parseSpriteIntervals = _5.parseSpriteIntervals;
            taffyFactory = _5.taffyFactory;
        }, function (_) {
            _Promise = _['default'];
        }, function (_b) {
            _get = _b['default'];
        }, function (_c) {
            _inherits = _c['default'];
        }, function (_d) {
            _createClass = _d['default'];
        }, function (_e) {
            _classCallCheck = _e['default'];
        }, function (_f) {
            _Symbol = _f['default'];
        }, function (_a) {
            util = _a;
        }],
        execute: function () {
            /**
             * @module audio.modules.SamplePlayer
             */

            /**
             * Special player built around a buffer source. Can play many simultaneous 
             * sprites/samples from a file. 
             * @namespace audio.modules
             * @class SamplePlayer
             * @extends audio.core.AudioModule
             * @constructor
             * @param {string} path - path to audio file
             * @param {string} intervals - string from .TextGridIntervals file
             */
            'use strict';

            sampleBuffer = _Symbol();
            gainNode = _Symbol();
            breakpoints = _Symbol();
            livingNodes = _Symbol();
            sampleDb = _Symbol();
            readyFn = _Symbol();

            SamplePlayer = (function (_AudioModule) {
                _inherits(SamplePlayer, _AudioModule);

                function SamplePlayer(path, path_to_annotations) {
                    var _this = this;

                    _classCallCheck(this, SamplePlayer);

                    console.log(AudioModule);
                    _get(Object.getPrototypeOf(SamplePlayer.prototype), 'constructor', this).call(this);

                    var arrayBufferReq = new _Promise(function (resolve, reject) {
                        try {
                            // TODO: should abstract this out.
                            var req = new XMLHttpRequest();
                            req.open("GET", path, true);
                            req.responseType = "arraybuffer";
                            req.onload = function () {
                                return ctx.decodeAudioData(req.response, function (audioBuffer) {
                                    return resolve(audioBuffer);
                                });
                            };
                            req.send();
                        } catch (e) {
                            reject(e);
                        }
                    });
                    var dbReq = taffyFactory(path_to_annotations);

                    _Promise.all([arrayBufferReq, dbReq]).then(function (vals) {
                        _this[sampleDb] = vals[1];

                        var frames = _this[sampleDb]().last().end * ctx.sampleRate;

                        _this[sampleBuffer] = ctx.createBuffer(2, frames, ctx.sampleRate);
                        _this[sampleBuffer].buffer = vals[0];

                        _this[readyFn]();
                    })['catch'](function (e) {
                        throw e;
                    });

                    this[gainNode] = ctx.createGain();

                    /**
                     * AudioParam that can be used to control output gain
                     * @property {AudioParam} gain
                     */
                    this.gain = this[gainNode].gain;

                    this[readyFn] = function () {};

                    this[livingNodes] = {};

                    /**
                     * Output node
                     * @property {AudioParam} _link_alias_out
                     */
                    this._link_alias_out = this[gainNode];
                }

                /**
                 * Play a specific or random sprite. 
                 * @method playSample
                 * @param {JSON} query - Query against sample database in form of object literal {key: value}.
                 *                       If query returns multiple results, will play random sprite from that set.
                 *                       If left undefined, will play a random sprite from the entire database.
                 * @default play a random sprite
                 */

                _createClass(SamplePlayer, [{
                    key: 'playSample',
                    value: function playSample(query) {
                        var _this2 = this;

                        var player = ctx.createBufferSource();

                        var queryResults = query ? this[sampleDb](query).get() : this[sampleDb]().get();

                        var idx = Math.random() * queryResults.length | 0;

                        player.buffer = this[sampleBuffer].buffer;
                        player.connect(this[gainNode]);

                        var id = util.hashCode((Math.random() * 100000).toString());
                        this[livingNodes][id] = player;

                        player.onended = function () {
                            return delete _this2[livingNodes][id];
                        };

                        var play_length = queryResults[idx].end - queryResults[idx].start;

                        player.start(0, queryResults[idx].start, play_length);
                    }

                    /**
                     * Get a reference to this SpritePlayer's database to facilitate more complex operations;
                     * a possible workflow would be to perform some operation on the database, .get the results,
                     * then use those results to construct queries for playSample.
                     * @method getDb
                     * @returns {TaffyDB} - the database
                     */
                }, {
                    key: 'getDb',
                    value: function getDb() {
                        return this[sampleDb];
                    }

                    /**
                     * Stop playback of all currently playing samples.
                     * @method kill
                     */
                }, {
                    key: 'kill',
                    value: function kill() {
                        var ln = this[livingNodes];
                        var _iteratorNormalCompletion = true;
                        var _didIteratorError = false;
                        var _iteratorError = undefined;

                        try {
                            for (var _iterator = _getIterator(_Object$keys(ln)), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                                var k = _step.value;

                                ln[k].stop();
                            }
                        } catch (err) {
                            _didIteratorError = true;
                            _iteratorError = err;
                        } finally {
                            try {
                                if (!_iteratorNormalCompletion && _iterator['return']) {
                                    _iterator['return']();
                                }
                            } finally {
                                if (_didIteratorError) {
                                    throw _iteratorError;
                                }
                            }
                        }

                        ln = {};
                    }

                    /**
                     * Set a function to be executed when the player is ready.
                     * @property {function} onReady
                     */
                }, {
                    key: 'onReady',
                    set: function set(fn) {
                        this[readyFn] = fn;
                    },
                    get: function get() {
                        return this[readyFn];
                    }
                }]);

                return SamplePlayer;
            })(AudioModule);

            _export('SamplePlayer', SamplePlayer);
        }
    };
});
$__System.register('21', ['16', 'b', 'c', 'e', '1e'], function (_export) {
  var AudioModule, ctx, _get, _inherits, _classCallCheck, moduleExtensions, Osc;

  return {
    setters: [function (_) {
      AudioModule = _.AudioModule;
      ctx = _.ctx;
    }, function (_b) {
      _get = _b['default'];
    }, function (_c) {
      _inherits = _c['default'];
    }, function (_e) {
      _classCallCheck = _e['default'];
    }, function (_e2) {
      moduleExtensions = _e2;
    }],
    execute: function () {
      /**
       * @module audio.modules.Osc
       */

      /**
       * A wrapper of the native OscillatorNode, with enhanced functionality.
       * @namespace audio.modules
       * @class Osc
       * @extends audio.core.AudioModule
       * @constructor
       * @param {String} oscType - a valid WAAPI oscillator type. 
       * @param {Number} frequency - initial frequency in hz
       * @param {Number} amplitude - initial amplitude (0 to 1 inclusive)
       */
      'use strict';

      Osc = (function (_AudioModule) {
        _inherits(Osc, _AudioModule);

        function Osc(oscType, frequency, amplitude) {
          _classCallCheck(this, Osc);

          _get(Object.getPrototypeOf(Osc.prototype), 'constructor', this).call(this);

          /**
           * The WAAPI oscillator node used. It's occasionally helpful to have 
           * this exposed.
           * @property {OscillatorNode} osc
           */
          this.osc = ctx.createOscillator();
          this.osc.frequency.value = frequency ? frequency : 440;
          this.osc.type = oscType ? oscType : 'sine';

          /**
           * AudioParam that can be used to control output signal gain
           * @property {AudioParam} gain
           */
          var gain = ctx.createGain();
          this.gain = gain.gain;
          this.gain.value = amplitude ? amplitude : 1.0;

          this.osc.connect(gain);

          /**
           * Osc signal out
           * @property {GainNode} _link_alias_out
           */
          this._link_alias_out = gain;

          /**
           * Start the oscillator
           * @method start
           */
          /**
           * Stop the oscillator
           * @method stop
           */
          moduleExtensions.startStopThese(this, this.osc);

          /**
           * sets or irregularly envelopes the frequency of this oscillator
           * @method setFrequency
           * @param {number} value - the new frequency
           * @param {number} time - optional. the amount of time over which to tween the
           *      frequency. 0 (no tweening) by default.
           */
          moduleExtensions.setValue(this, this.osc.frequency, 'setFrequency', true);

          /**
           * sets or irregularly envelopes the gain of this oscillator
           * @method setGain
           * @param {number} value - the new gain
           * @param {number} time - optional. the ampunt of time over which to tween the
           *      gain. 0 (no tweening) by default
           */
          moduleExtensions.setValue(this, this.gain, 'setGain', true);
        }

        /**
         * Valid non-custom WAAPI oscillator types. 
         * It is occasionally handy to have these around as a collection.
         * @property {Object} types
         * @static
         * @default {String SINE, String SQUARE, String SAWTOOTH, String TRIANGLE}
         */
        return Osc;
      })(AudioModule);

      _export('Osc', Osc);

      Osc.types = {
        SINE: 'sine',
        SQUARE: 'square',
        SAWTOOTH: 'sawtooth',
        TRIANGLE: 'triangle'
      };
    }
  };
});
$__System.register('22', ['16', 'b', 'c', 'd', 'e', 'f', '1d', '1e'], function (_export) {
  var AudioModule, ctx, _get, _inherits, _createClass, _classCallCheck, _Symbol, audioNodes, moduleExtensions, buffer, srDivisor, calcBuffer, Noise;

  return {
    setters: [function (_) {
      AudioModule = _.AudioModule;
      ctx = _.ctx;
    }, function (_b) {
      _get = _b['default'];
    }, function (_c) {
      _inherits = _c['default'];
    }, function (_d) {
      _createClass = _d['default'];
    }, function (_e) {
      _classCallCheck = _e['default'];
    }, function (_f) {
      _Symbol = _f['default'];
    }, function (_d2) {
      audioNodes = _d2;
    }, function (_e2) {
      moduleExtensions = _e2;
    }],
    execute: function () {
      /**
       * @module audio.modules.Noise
       */

      /**
       * A simple white noise generator.
       * @namespace audio.modules
       * @class Noise
       * @extends audio.core.AudioModule
       * @constructor
       * @param {Number} amplitude - initial gain (0 to 1 inclusive)
       * @param {Number} downsample - initial downsampling value (see: this.downsample)
       */
      'use strict';

      buffer = _Symbol();
      srDivisor = _Symbol();
      calcBuffer = _Symbol();

      Noise = (function (_AudioModule) {
        _inherits(Noise, _AudioModule);

        function Noise(amplitude, downsample) {
          _classCallCheck(this, Noise);

          _get(Object.getPrototypeOf(Noise.prototype), 'constructor', this).call(this);

          var sr = ctx.sampleRate,
              samples = sr * 2.5;

          this[buffer] = ctx.createBuffer(2, samples, sr);

          this[srDivisor] = downsample ? downsample : 1;

          this[calcBuffer] = function (downSamplingFactor) {
            var down = downSamplingFactor ? downSamplingFactor : 1;
            for (var channel = 0; channel < 2; channel++) {
              var channelData = this[buffer].getChannelData(channel);
              for (var i = 0; i < samples / down; i++) {
                var factor = down,
                    n = Math.random() * 2 - 1;
                while (--factor >= 0) {
                  channelData[i * down + factor] = n;
                }
              }
            }
          };

          if (downsample > 0) this[calcBuffer](downsample);else this[calcBuffer]();

          var source = ctx.createBufferSource();
          source.buffer = this[buffer];
          source.loop = true;

          var gain = new audioNodes.Gain();

          /**
           * AudioParam used to control amplitude of output.
           * @property {AudioParam} gain
           */
          this.gain = gain.gain;
          this.gain.value = amplitude ? amplitude : 1;

          source.connect(gain);

          /**
           * Noise output
           * @property {GainNode} _link_alias_out
           * @extends audio.core.AudioModule._link_alias_out
           */
          this._link_alias_out = gain;

          /**
           * Start generating noise
           * @method start
           */
          /**
           * Stop generating noise
           * TODO: need to construct a new source after stopping?
           * @method stop
           */
          moduleExtensions.startStopThese(this, source);
        }

        /**
         * downsample is a divisor used to reduce the samplerate at which the values
         * in the noise buffer change, e.g., if downsample = 2, the samplerate of the 
         * noise buffer is currentSampleRate/2.
         * @property {Number} downsample
         * @default 1
         */

        _createClass(Noise, [{
          key: 'downsample',
          get: function get() {
            return this[srDivisor];
          },
          set: function set(v) {
            if (v > 0) {
              this[srDivisor] = v;
              this[calcBuffer](v);
            }
          }
        }]);

        return Noise;
      })(AudioModule);

      _export('Noise', Noise);
    }
  };
});
$__System.register('1b', ['16', 'b', 'c', 'd', 'e', 'f'], function (_export) {
    var AudioModule, ctx, _get, _inherits, _createClass, _classCallCheck, _Symbol, mediaElementPlayerPath, mediaElement, canPlay, canPlayFn, canPlayHasFired, loadFile, isPlaying, disableRangeReq, MediaElementPlayer;

    return {
        setters: [function (_) {
            AudioModule = _.AudioModule;
            ctx = _.ctx;
        }, function (_b) {
            _get = _b['default'];
        }, function (_c) {
            _inherits = _c['default'];
        }, function (_d) {
            _createClass = _d['default'];
        }, function (_e) {
            _classCallCheck = _e['default'];
        }, function (_f) {
            _Symbol = _f['default'];
        }],
        execute: function () {
            /**
             * @module audio.modules.MediaElementPlayer
             */

            /**
             * Module for playing back sounds from a media element. Useful for audio sprites
             * and HTML5 fallbacks.
             * @namespace audio.modules
             * @class MediaElementPlayer
             * @extends audio.core.AudioModule
             * @constructor
             * @param {string} path - path to audio file
             * @param {boolean} disableRangeRequests - If true, triggers workaround if server 
             *      is not configured for range requests. This encodes the file in base64 and 
             *      sets that as the data URI of an audio element. 
             */
            'use strict';

            mediaElementPlayerPath = _Symbol('media path');
            mediaElement = _Symbol('media element');
            canPlay = _Symbol('can play');
            canPlayFn = _Symbol('can play fn');
            canPlayHasFired = _Symbol('can play through has fired');
            loadFile = _Symbol('load file');
            isPlaying = _Symbol('is playing');
            disableRangeReq = _Symbol('disable range requests');

            MediaElementPlayer = (function (_AudioModule) {
                _inherits(MediaElementPlayer, _AudioModule);

                function MediaElementPlayer(path, disableRangeRequests) {
                    var _this = this;

                    _classCallCheck(this, MediaElementPlayer);

                    _get(Object.getPrototypeOf(MediaElementPlayer.prototype), 'constructor', this).call(this);

                    this[mediaElement] = document.createElement('audio');
                    this[mediaElementPlayerPath] = path;

                    this[disableRangeReq] = !!disableRangeRequests;

                    this[loadFile] = function (path) {
                        if (_this[disableRangeReq]) {
                            (function () {
                                _this[mediaElementPlayerPath] = path;
                                var req = new XMLHttpRequest();
                                req.open("GET", path, true);
                                req.responseType = 'blob';
                                req.onload = function () {
                                    var reader = new FileReader();
                                    reader.readAsDataURL(req.response);
                                    reader.onloadend = function () {
                                        return _this[mediaElement].src = reader.result;
                                    };
                                };
                                req.send();
                            })();
                        } else {
                            _this[mediaElement].src = path;
                        }
                        _this[canPlayHasFired] = false;
                    };
                    this[loadFile](this[mediaElementPlayerPath]);

                    this[isPlaying] = false;

                    this[canPlay] = false;
                    this[canPlayFn] = function () {};
                    this[canPlayHasFired] = false;

                    this[mediaElement].addEventListener('canplaythrough', function () {
                        if (!_this[canPlayHasFired] || !_this[disableRangeReq]) {
                            _this[canPlay] = true;
                            _this[canPlayFn]();
                            _this[canPlayHasFired] = true;
                        }
                    });

                    if ("xxxFEATURE_DETECTIONxxx") {
                        // replace this with feature detection
                        var mediaSource = ctx.createMediaElementSource(this[mediaElement]),
                            gain = ctx.createGain();

                        /**
                         * AudioParam exposing output gain
                         * @property {AudioParam} gain
                         */
                        this.gain = gain.gain;

                        mediaSource.connect(gain);

                        /**
                         * Media element source used as signal out. 
                         * @property {AudioNode} _link_alias_out
                         */
                        this._link_alias_out = gain;
                    }
                }

                /**
                 * Start audio playback
                 * @method play 
                 */

                _createClass(MediaElementPlayer, [{
                    key: 'play',
                    value: function play() {
                        this[isPlaying] = true;
                        this[mediaElement].play();
                    }

                    /**
                     * Pause audio playback
                     * @method pause
                     */
                }, {
                    key: 'pause',
                    value: function pause() {
                        this[isPlaying] = false;
                        this[mediaElement].pause();
                    }

                    // expose some of the audio element functionality

                    /**
                     * use this property to set or get curent audio playback time in seconds.
                     * @property {number} currentTime
                     */
                }, {
                    key: 'stop',

                    // do something

                    /**
                     * Pause audio playback and set current time to 0 
                     * @method stop
                     */
                    value: function stop() {
                        this.pause();
                        this.currentTime = 0;
                    }

                    /**
                     * Indicates whether or not the player is playing
                     * @property {boolean} isPlaying
                     */
                }, {
                    key: 'currentTime',
                    get: function get() {
                        return this[mediaElement].currentTime;
                    },
                    set: function set(v) {
                        if (this[mediaElement].readyState > 0) {
                            this[mediaElement].currentTime = v;
                        } else {}
                    }
                }, {
                    key: 'isPlaying',
                    get: function get() {
                        return this[isPlaying];
                    }

                    /**
                     * Indicates whether or not the range request workaround is in use
                     * @property {boolean} rangeRequestsDisabled
                     */
                }, {
                    key: 'rangeRequestsDisabled',
                    get: function get() {
                        return this[disableRangeReq];
                    }

                    /**
                     * On get, indicates whether or not the player can play without stopping to
                     * buffer. On set, sets a callback for when this point is reached.
                     * @property {boolean | function} canPlayThrough
                     */
                }, {
                    key: 'canPlayThrough',
                    get: function get() {
                        return this[canPlay];
                    },
                    set: function set(fn) {
                        this[canPlayFn] = fn;
                    }

                    /**
                     * Indicates or sets whether or not the media element should loop on playback.
                     * @property {boolean} loop
                     */
                }, {
                    key: 'loop',
                    get: function get() {
                        return this[mediaElement].loop;
                    },
                    set: function set(v) {
                        this[mediaElement].loop = v;
                    }

                    /**
                     * Indicates or sets whether or not the player should play as soon as it is
                     * able without buffering.
                     * @property {boolean} autoplay
                     */
                }, {
                    key: 'autoplay',
                    get: function get() {
                        return this[mediaElement].autoplay;
                    },
                    set: function set(v) {
                        this[mediaElement].autoplay = v;
                    }

                    /**
                     * Gets or sets media element volume - between 0 and 1 inclusive
                     * @property {number} volume
                     */
                }, {
                    key: 'volume',
                    get: function get() {
                        return this[mediaElement].volume;
                    },
                    set: function set(v) {
                        this[mediaElement].volume = v;
                    }

                    /**
                     * If true, mutes mediaElement
                     * @property {boolean} muted
                     */
                }, {
                    key: 'muted',
                    get: function get() {
                        return this[mediaElement].muted;
                    },
                    set: function set(v) {
                        this[mediaElement].muted = v;
                    }
                }]);

                return MediaElementPlayer;
            })(AudioModule);

            _export('MediaElementPlayer', MediaElementPlayer);
        }
    };
});
$__System.register('23', ['16', 'b', 'c', 'e', '1d', '1e'], function (_export) {
  var AudioModule, ctx, _get, _inherits, _classCallCheck, audioNodes, moduleExtensions, Convolution;

  return {
    setters: [function (_) {
      AudioModule = _.AudioModule;
      ctx = _.ctx;
    }, function (_b) {
      _get = _b['default'];
    }, function (_c) {
      _inherits = _c['default'];
    }, function (_e) {
      _classCallCheck = _e['default'];
    }, function (_d) {
      audioNodes = _d;
    }, function (_e2) {
      moduleExtensions = _e2;
    }],
    execute: function () {
      /**
       * @module audio.modules.Convolution
       */

      /**
       * Simple wrapper around convolution node
       * @namespace audio.modules
       * @class Convolution
       * @extends audio.core.AudioModule
       * @constructor 
       * @param {String} path - path to audio file
       */
      'use strict';

      Convolution = (function (_AudioModule) {
        _inherits(Convolution, _AudioModule);

        function Convolution(path_to_audio) {
          _classCallCheck(this, Convolution);

          _get(Object.getPrototypeOf(Convolution.prototype), 'constructor', this).call(this);

          var nop = audioNodes.Gain(),
              conv = audioNodes.Convolve();

          conv.normalize = true;

          var dryGain = audioNodes.Gain(),
              wetGain = audioNodes.Gain(),
              gain = audioNodes.Gain();

          /**
           * AudioParam that can be used to control output gain
           * @property {AudioParam} gain
           */
          this.gain = gain.gain;

          nop.link(dryGain).link(gain);
          nop.link(conv).link(wetGain).link(gain);

          var req = new XMLHttpRequest();
          req.open("GET", path_to_audio, true);
          req.responseType = "arraybuffer";
          req.onload = function () {
            audioCore.ctx.decodeAudioData(req.response, function (audioBuffer) {
              conv.buffer = audioBuffer;
            });
          };
          req.send();

          /**
           * output node
           * @property {AudioNode} _link_alias_in
           * @extends audio.core.AudioModule._link_alias_in
           */
          this._link_alias_in = nop;

          /**
           * input node
           * @property {AudioNode} _link_alias_out
           * @extends audio.core.AudioModule._link_alias_out
           */
          this._link_alias_out = gain;

          /**
           * Controls how much of the convolved source is mixed into output
           * @method wetDry
           * @param {number} wet - 0 to 100 inclusive - 100 = 100% convolved output
           * @param {number} time - milliseconds over which to linearly envelope wet/dry percentage
           * @default 50
           */
          audioCore.moduleExtensions.linearCrossfade(this, dryGain, wetGain, 'wetDry');
          this.wetDry(50);
        }

        return Convolution;
      })(AudioModule);

      _export('Convolution', Convolution);
    }
  };
});
$__System.register('24', ['16', '18', 'b', 'c', 'd', 'e', 'f', '1e', 'a'], function (_export) {
    var AudioModule, ctx, TWEEN, _get, _inherits, _createClass, _classCallCheck, _Symbol, moduleExtensions, util, params, updateFrequency, updateQ, updateGain, Bandpass;

    return {
        setters: [function (_) {
            AudioModule = _.AudioModule;
            ctx = _.ctx;
        }, function (_2) {
            TWEEN = _2['default'];
        }, function (_b) {
            _get = _b['default'];
        }, function (_c) {
            _inherits = _c['default'];
        }, function (_d) {
            _createClass = _d['default'];
        }, function (_e) {
            _classCallCheck = _e['default'];
        }, function (_f) {
            _Symbol = _f['default'];
        }, function (_e2) {
            moduleExtensions = _e2;
        }, function (_a) {
            util = _a;
        }],
        execute: function () {
            /**
             * @module audio.modules.Bandpass
             */

            /**
             * A convienence wrapper around the native BiquadFilter
             * with enhanced functionality.
             * @namespace audio.modules
             * @class Bandpass
             * @extends audio.core.AudioModule
             * @constructor
             * @param {number} frequency - initial frequency in hz
             * @param {number} Q - initial q-value
             * @param {number} gain - initial gain (0 to 1 inclusive) 
             */
            'use strict';

            params = _Symbol();
            updateFrequency = _Symbol();
            updateQ = _Symbol();
            updateGain = _Symbol();

            Bandpass = (function (_AudioModule) {
                _inherits(Bandpass, _AudioModule);

                function Bandpass(frequency, Q, initGain) {
                    var _this = this;

                    _classCallCheck(this, Bandpass);

                    _get(Object.getPrototypeOf(Bandpass.prototype), 'constructor', this).call(this);

                    /**
                     * The biquad filter used for this bandpass. It is occasionally 
                     * helpful for this to be exposed.
                     * @property {AudioNode} biquad
                     */
                    this.biquad = ctx.createBiquadFilter();
                    this.biquad.type = "bandpass";
                    this.biquad.frequency.value = frequency ? frequency : 440;
                    this.biquad.Q.value = Q ? Q : this.biquad.Q.value;

                    var gain = ctx.createGain();

                    /**
                     * The gain AudioParam of this module's output. 
                     * @property {AudioParam} gain
                     */
                    this.gain = gain.gain;
                    this.gain.value = initGain ? initGain : 1.0;

                    this.biquad.connect(gain);

                    /**
                     * Signal chain input
                     * @property {AudioNode} _link_alias_in
                     * @extends audio.core.AudioModule._link_alias_in
                     */
                    this._link_alias_in = this.biquad;

                    /**
                     * Signal chain output
                     * @property {AudioNode} _link_alias_out
                     * @extends audio.core.AudioModule._link_alias_out
                     */
                    this._link_alias_out = gain;

                    /**
                     * set or irregularly envelope the bandpass frequency.
                     * @method setFrequency
                     * @param {number} value - the new frequency value
                     * @param {number} time - optional. the ampunt of time over which to tween the
                     *      frequency. 0 (no tweening) by default
                     */
                    moduleExtensions.setValue(this, this.biquad.frequency, 'setFrequency', false);

                    /**
                     * set or irregularly envelope the bandpass gain.
                     * @method setGain
                     * @param {number} value - the new gain value
                     * @param {number} time - optional. the ampunt of time over which to tween the
                     *      gain. 0 (no tweening) by default
                     */
                    moduleExtensions.setValue(this, this.gain, 'setGain', false);

                    this[params] = {
                        frequency: this.biquad.frequency.value,
                        Q: this.biquad.Q.value,
                        amplitude: gain.gain.value,
                        accenting: false,
                        gen: (function (gen) {
                            var cache = {
                                Q: 0,
                                amplitude: 0
                            };
                            var ret = function ret(p, pos, diff_base, smdg_pcnt) {
                                if (pos) {
                                    cache[p] = _this[params][p];
                                    return _this[params][p] + util.smudgeNumber(diff_base, smdg_pcnt);
                                } else {
                                    return cache[p];
                                }
                            };

                            var freqTarget = function freqTarget(prop, base, range) {
                                return prop + util.smudgeNumber(Math.random() < 0.5 ? base * -1 : base, range);
                            };

                            gen.Q = function (pos) {
                                return ret('Q', pos, 70, 20);
                            };

                            gen.amp = function (pos) {
                                return ret('amplitude', pos, 1, 50);
                            };

                            gen.freq = function (pos) {
                                var freq = _this[params].frequency;
                                return pos ? freqTarget(freq, 23, 10) : freqTarget(freq, 20, 20);
                            };

                            return gen;
                        })({})
                    };

                    this[updateFrequency] = function () {
                        return _this.biquad.frequency.value = _this[params].frequency;
                    };
                    this[updateQ] = function () {
                        return _this.biquad.Q.value = _this[params].Q;
                    };
                    this[updateGain] = function () {
                        return _this.gain.value = _this[params].amplitude;
                    };
                }

                /**
                 * A brief effect that modules the frequency, gain, and Q-value simultaneously
                 * to create a brief accent. Gain and Q will return to their values before .accent
                 * is called, but frequency is allowed to slowly drift. 
                 * TODO: make adjustable
                 * @method accent
                 */

                _createClass(Bandpass, [{
                    key: 'accent',
                    value: function accent() {
                        var _this2 = this;

                        if (!this[params].accenting) {
                            (function () {
                                _this2[params].accenting = true;

                                var gen = _this2[params].gen;

                                var accent_time = util.smudgeNumber(100, 10),
                                    repeats = util.smudgeNumber(8, 50) | 0,
                                    recovery_time = util.smudgeNumber(500, 20),
                                    total = accent_time * repeats + recovery_time;

                                var Q_trans_time = total * 0.5,
                                    gain_in_portion = util.smudgeNumber(0.3, 20),
                                    gain_in_time = total * gain_in_portion,
                                    gain_out_time = total * (1 - gain_in_portion);

                                var QIn = new TWEEN.Tween(_this2[params]).to({ Q: gen.Q(true) }, Q_trans_time).onUpdate(_this2[updateQ]);
                                var QOut = new TWEEN.Tween(_this2[params]).to({ Q: gen.Q(false) }, Q_trans_time).onUpdate(_this2[updateQ]);

                                var gainIn = new TWEEN.Tween(_this2[params]).to({ amplitude: gen.amp(true) }, gain_in_time).onUpdate(_this2[updateGain]);
                                var gainOut = new TWEEN.Tween(_this2[params]).to({ amplitude: gen.amp(false) }, gain_out_time).onUpdate(_this2[updateGain]);
                                gainIn.chain(gainOut);

                                var freqIn = new TWEEN.Tween(_this2[params]).to({ frequency: gen.freq(true) }, accent_time).easing(TWEEN.Easing.Bounce.InOut).repeat(util.smudgeNumber(8, 50) | 0).yoyo(true).onStart(function () {
                                    QIn.start();
                                    gainIn.start();
                                }).onUpdate(_this2[updateFrequency]);
                                var freqOut = new TWEEN.Tween(_this2[params]).to({ frequency: gen.freq(false) }, recovery_time).easing(TWEEN.Easing.Bounce.InOut).onUpdate(_this2[updateFrequency]).onStart(function () {
                                    QOut.start();
                                }).onComplete(function () {
                                    _this2[params].accenting = false;
                                    util.tween.stopTweens();
                                });
                                freqIn.chain(freqOut);

                                freqIn.start();
                                util.tween.startTweens();
                            })();
                        }
                    }
                }]);

                return Bandpass;
            })(AudioModule);

            _export('Bandpass', Bandpass);
        }
    };
});
$__System.register('1d', ['16', '17'], function (_export) {
  /**
   * Contains helper functions for getting AudioNodes prewrapped with AuddioModule.link
   * @module audio.nodes
   */

  /**
   * Create a gain node
   * @method Gain
   * @for audio.nodes
   * @return {AudioModule}  
   */
  'use strict';

  var ctx, wrapNode, Gain, Split, Merge, Convolve, Delay, MediaElementSource, Biquad;
  return {
    setters: [function (_) {
      ctx = _.ctx;
    }, function (_2) {
      wrapNode = _2.wrapNode;
    }],
    execute: function () {
      Gain = function Gain() {
        return wrapNode(ctx.createGain());
      };

      _export('Gain', Gain);

      /**
       * Create a channel splitting nodes
       * @method Split
       * @for audio.nodes
       * @param {number} channels - number of channels
       * @return {AudioModule}  
       */

      Split = function Split(channels) {
        return wrapNode(ctx.createChannelSplitter(channels));
      };

      _export('Split', Split);

      /**
       * Create a channel merge node
       * @method Merge
       * @for audio.nodes
       * @param {number} channels - number of channels
       * @return {AudioModule}  
       */

      Merge = function Merge(channels) {
        return wrapNode(ctx.createChannelMerger(channels));
      };

      _export('Merge', Merge);

      /**
       * Create a vanilla convolver node
       * @method Convolve
       * @for audio.nodes 
       * @return {AudioModule}  
       */

      Convolve = function Convolve() {
        return wrapNode(ctx.createConvolver());
      };

      _export('Convolve', Convolve);

      /**
       * Create delay node
       * @method Delay
       * @for audio.nodes
       * @param {number} delayTime - length of delay in seconds
       * @return {AudioModule}  
       */

      Delay = function Delay(delay) {
        return wrapNode(ctx.createDelay(delay));
      };

      _export('Delay', Delay);

      /**
       * Create MediaElementSource node
       * @method MediaElementSource
       * @for audio.nodes
       * @param {HTMLDOMElement} mediaElement - media element used as audio source
       * @return {AudioModule}  
       */

      MediaElementSource = function MediaElementSource(mediaElement) {
        return wrapNode(ctx.createMediaElementSource(mediaElement));
      };

      _export('MediaElementSource', MediaElementSource);

      /**
       * Create biquad filter node
       * @method Biquad
       * @for audio.nodes
       * @param {string} type - valid WAAPI biquad filter type
       * @param {number} frequency - init frequency of filter
       * @param {number} Q - init Q-value of filter
       * @return {AudioModule}  
       */

      Biquad = function Biquad(type, frequency, Q) {
        var bq = wrapNode(ctx.createBiquadFilter());
        if (type) bq.type = type;
        if (frequency) bq.frequency.value = frequency;
        if (Q) bq.Q.value = Q;
        return bq;
      };

      _export('Biquad', Biquad);
    }
  };
});
$__System.registerDynamic("25", ["26"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var cof = req('26');
  module.exports = Array.isArray || function(arg) {
    return cof(arg) == 'Array';
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("27", ["28"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $ = req('28');
  module.exports = function(it) {
    var keys = $.getKeys(it),
        getSymbols = $.getSymbols;
    if (getSymbols) {
      var symbols = getSymbols(it),
          isEnum = $.isEnum,
          i = 0,
          key;
      while (symbols.length > i)
        if (isEnum.call(it, key = symbols[i++]))
          keys.push(key);
    }
    return keys;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("29", ["2a", "28"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var toString = {}.toString,
      toIObject = req('2a'),
      getNames = req('28').getNames;
  var windowNames = typeof window == 'object' && Object.getOwnPropertyNames ? Object.getOwnPropertyNames(window) : [];
  var getWindowNames = function(it) {
    try {
      return getNames(it);
    } catch (e) {
      return windowNames.slice();
    }
  };
  module.exports.get = function getOwnPropertyNames(it) {
    if (windowNames && toString.call(it) == '[object Window]')
      return getWindowNames(it);
    return getNames(toIObject(it));
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("2b", ["28", "2a"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $ = req('28'),
      toIObject = req('2a');
  module.exports = function(object, el) {
    var O = toIObject(object),
        keys = $.getKeys(O),
        length = keys.length,
        index = 0,
        key;
    while (length > index)
      if (O[key = keys[index++]] === el)
        return key;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("2c", ["28", "2d", "2e", "2f", "30", "31", "32", "33", "34", "35", "36", "2b", "29", "27", "25", "37", "2a", "38", "39"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var $ = req('28'),
      global = req('2d'),
      has = req('2e'),
      DESCRIPTORS = req('2f'),
      $def = req('30'),
      $redef = req('31'),
      $fails = req('32'),
      shared = req('33'),
      setToStringTag = req('34'),
      uid = req('35'),
      wks = req('36'),
      keyOf = req('2b'),
      $names = req('29'),
      enumKeys = req('27'),
      isArray = req('25'),
      anObject = req('37'),
      toIObject = req('2a'),
      createDesc = req('38'),
      getDesc = $.getDesc,
      setDesc = $.setDesc,
      _create = $.create,
      getNames = $names.get,
      $Symbol = global.Symbol,
      $JSON = global.JSON,
      _stringify = $JSON && $JSON.stringify,
      setter = false,
      HIDDEN = wks('_hidden'),
      isEnum = $.isEnum,
      SymbolRegistry = shared('symbol-registry'),
      AllSymbols = shared('symbols'),
      useNative = typeof $Symbol == 'function',
      ObjectProto = Object.prototype;
  var setSymbolDesc = DESCRIPTORS && $fails(function() {
    return _create(setDesc({}, 'a', {get: function() {
        return setDesc(this, 'a', {value: 7}).a;
      }})).a != 7;
  }) ? function(it, key, D) {
    var protoDesc = getDesc(ObjectProto, key);
    if (protoDesc)
      delete ObjectProto[key];
    setDesc(it, key, D);
    if (protoDesc && it !== ObjectProto)
      setDesc(ObjectProto, key, protoDesc);
  } : setDesc;
  var wrap = function(tag) {
    var sym = AllSymbols[tag] = _create($Symbol.prototype);
    sym._k = tag;
    DESCRIPTORS && setter && setSymbolDesc(ObjectProto, tag, {
      configurable: true,
      set: function(value) {
        if (has(this, HIDDEN) && has(this[HIDDEN], tag))
          this[HIDDEN][tag] = false;
        setSymbolDesc(this, tag, createDesc(1, value));
      }
    });
    return sym;
  };
  var isSymbol = function(it) {
    return typeof it == 'symbol';
  };
  var $defineProperty = function defineProperty(it, key, D) {
    if (D && has(AllSymbols, key)) {
      if (!D.enumerable) {
        if (!has(it, HIDDEN))
          setDesc(it, HIDDEN, createDesc(1, {}));
        it[HIDDEN][key] = true;
      } else {
        if (has(it, HIDDEN) && it[HIDDEN][key])
          it[HIDDEN][key] = false;
        D = _create(D, {enumerable: createDesc(0, false)});
      }
      return setSymbolDesc(it, key, D);
    }
    return setDesc(it, key, D);
  };
  var $defineProperties = function defineProperties(it, P) {
    anObject(it);
    var keys = enumKeys(P = toIObject(P)),
        i = 0,
        l = keys.length,
        key;
    while (l > i)
      $defineProperty(it, key = keys[i++], P[key]);
    return it;
  };
  var $create = function create(it, P) {
    return P === undefined ? _create(it) : $defineProperties(_create(it), P);
  };
  var $propertyIsEnumerable = function propertyIsEnumerable(key) {
    var E = isEnum.call(this, key);
    return E || !has(this, key) || !has(AllSymbols, key) || has(this, HIDDEN) && this[HIDDEN][key] ? E : true;
  };
  var $getOwnPropertyDescriptor = function getOwnPropertyDescriptor(it, key) {
    var D = getDesc(it = toIObject(it), key);
    if (D && has(AllSymbols, key) && !(has(it, HIDDEN) && it[HIDDEN][key]))
      D.enumerable = true;
    return D;
  };
  var $getOwnPropertyNames = function getOwnPropertyNames(it) {
    var names = getNames(toIObject(it)),
        result = [],
        i = 0,
        key;
    while (names.length > i)
      if (!has(AllSymbols, key = names[i++]) && key != HIDDEN)
        result.push(key);
    return result;
  };
  var $getOwnPropertySymbols = function getOwnPropertySymbols(it) {
    var names = getNames(toIObject(it)),
        result = [],
        i = 0,
        key;
    while (names.length > i)
      if (has(AllSymbols, key = names[i++]))
        result.push(AllSymbols[key]);
    return result;
  };
  var $stringify = function stringify(it) {
    if (it === undefined || isSymbol(it))
      return;
    var args = [it],
        i = 1,
        $$ = arguments,
        replacer,
        $replacer;
    while ($$.length > i)
      args.push($$[i++]);
    replacer = args[1];
    if (typeof replacer == 'function')
      $replacer = replacer;
    if ($replacer || !isArray(replacer))
      replacer = function(key, value) {
        if ($replacer)
          value = $replacer.call(this, key, value);
        if (!isSymbol(value))
          return value;
      };
    args[1] = replacer;
    return _stringify.apply($JSON, args);
  };
  var buggyJSON = $fails(function() {
    var S = $Symbol();
    return _stringify([S]) != '[null]' || _stringify({a: S}) != '{}' || _stringify(Object(S)) != '{}';
  });
  if (!useNative) {
    $Symbol = function Symbol() {
      if (isSymbol(this))
        throw TypeError('Symbol is not a constructor');
      return wrap(uid(arguments.length > 0 ? arguments[0] : undefined));
    };
    $redef($Symbol.prototype, 'toString', function toString() {
      return this._k;
    });
    isSymbol = function(it) {
      return it instanceof $Symbol;
    };
    $.create = $create;
    $.isEnum = $propertyIsEnumerable;
    $.getDesc = $getOwnPropertyDescriptor;
    $.setDesc = $defineProperty;
    $.setDescs = $defineProperties;
    $.getNames = $names.get = $getOwnPropertyNames;
    $.getSymbols = $getOwnPropertySymbols;
    if (DESCRIPTORS && !req('39')) {
      $redef(ObjectProto, 'propertyIsEnumerable', $propertyIsEnumerable, true);
    }
  }
  var symbolStatics = {
    'for': function(key) {
      return has(SymbolRegistry, key += '') ? SymbolRegistry[key] : SymbolRegistry[key] = $Symbol(key);
    },
    keyFor: function keyFor(key) {
      return keyOf(SymbolRegistry, key);
    },
    useSetter: function() {
      setter = true;
    },
    useSimple: function() {
      setter = false;
    }
  };
  $.each.call(('hasInstance,isConcatSpreadable,iterator,match,replace,search,' + 'species,split,toPrimitive,toStringTag,unscopables').split(','), function(it) {
    var sym = wks(it);
    symbolStatics[it] = useNative ? sym : wrap(sym);
  });
  setter = true;
  $def($def.G + $def.W, {Symbol: $Symbol});
  $def($def.S, 'Symbol', symbolStatics);
  $def($def.S + $def.F * !useNative, 'Object', {
    create: $create,
    defineProperty: $defineProperty,
    defineProperties: $defineProperties,
    getOwnPropertyDescriptor: $getOwnPropertyDescriptor,
    getOwnPropertyNames: $getOwnPropertyNames,
    getOwnPropertySymbols: $getOwnPropertySymbols
  });
  $JSON && $def($def.S + $def.F * (!useNative || buggyJSON), 'JSON', {stringify: $stringify});
  setToStringTag($Symbol, 'Symbol');
  setToStringTag(Math, 'Math', true);
  setToStringTag(global.JSON, 'JSON', true);
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("3a", ["2c", "3b", "6"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  req('2c');
  req('3b');
  module.exports = req('6').Symbol;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("3c", ["3a"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = req('3a');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("f", ["3c"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {
    "default": req('3c'),
    __esModule: true
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("3d", ["30", "3e"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $def = req('30');
  $def($def.S, 'Object', {setPrototypeOf: req('3e').set});
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("3f", ["3d", "6"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  req('3d');
  module.exports = req('6').Object.setPrototypeOf;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("40", ["3f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {
    "default": req('3f'),
    __esModule: true
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("41", ["28"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $ = req('28');
  module.exports = function create(P, D) {
    return $.create(P, D);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("42", ["41"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {
    "default": req('41'),
    __esModule: true
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("c", ["42", "40"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  "use strict";
  var _Object$create = req('42')["default"];
  var _Object$setPrototypeOf = req('40')["default"];
  exports["default"] = function(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
    }
    subClass.prototype = _Object$create(superClass && superClass.prototype, {constructor: {
        value: subClass,
        enumerable: false,
        writable: true,
        configurable: true
      }});
    if (superClass)
      _Object$setPrototypeOf ? _Object$setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
  };
  exports.__esModule = true;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("b", ["10"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  "use strict";
  var _Object$getOwnPropertyDescriptor = req('10')["default"];
  exports["default"] = function get(_x, _x2, _x3) {
    var _again = true;
    _function: while (_again) {
      var object = _x,
          property = _x2,
          receiver = _x3;
      _again = false;
      if (object === null)
        object = Function.prototype;
      var desc = _Object$getOwnPropertyDescriptor(object, property);
      if (desc === undefined) {
        var parent = Object.getPrototypeOf(object);
        if (parent === null) {
          return undefined;
        } else {
          _x = parent;
          _x2 = property;
          _x3 = receiver;
          _again = true;
          desc = parent = undefined;
          continue _function;
        }
      } else if ("value" in desc) {
        return desc.value;
      } else {
        var getter = desc.get;
        if (getter === undefined) {
          return undefined;
        }
        return getter.call(receiver);
      }
    }
  };
  exports.__esModule = true;
  global.define = __define;
  return module.exports;
});

$__System.register('43', ['14', '15', '16', 'b', 'c', 'd', 'e', 'f', '1d'], function (_export) {
    var _getIterator, _Object$keys, AudioModule, _get, _inherits, _createClass, _classCallCheck, _Symbol, Gain, soloCount, soloEvent, trkDestroy, trkContents, trkEndpoint, trkCommand, trkSoloed, trkMuted, trkLastGain, Track, busTracks, busInput, busOutput, busChain, busTrkCount, busCommand, Bus;

    return {
        setters: [function (_) {
            _getIterator = _['default'];
        }, function (_2) {
            _Object$keys = _2['default'];
        }, function (_3) {
            AudioModule = _3.AudioModule;
        }, function (_b) {
            _get = _b['default'];
        }, function (_c) {
            _inherits = _c['default'];
        }, function (_d) {
            _createClass = _d['default'];
        }, function (_e) {
            _classCallCheck = _e['default'];
        }, function (_f) {
            _Symbol = _f['default'];
        }, function (_d2) {
            Gain = _d2.Gain;
        }],
        execute: function () {
            /**
             * Contains modules for large-scale organization of the signal path
             * @module audio.mixer
             */

            /**
             * Event fired when a track is soloed. 
             * @event trackSoloedStateChange
             * @for audio.mixer
             */
            'use strict';

            soloCount = 0;
            soloEvent = new Event('trackSoloedStateChange');

            /**
             * The track object facilitates grouping together AudioModules, starting their
             * playback, and muting/soloing. 
             * @namespace audio.mixer
             * @class Track
             * @extends audio.core.AudioModule
             * @constructor 
             * @param {function} constructFn - 
             *      Track constructs with a function that returns a generic object containing
             *      'startabkes' and 'endpoint' properties. Startables should be an object that contains
             *      references to any module within the constructFn that needs a .start() / .stop()
             *      call. Endpoint should be a reference to a single output from the innards of the
             *      constructFn.
             *
             *      () => {
             *          ...
             *          return {
             *              startables: {
             *                  0: {AudioModule}
             *                  ...
             *              }
             *              endpoint: {AudioModule}
             *          }
             *      };
             */
            trkDestroy = _Symbol();
            trkContents = _Symbol();
            trkEndpoint = _Symbol();
            trkCommand = _Symbol();
            trkSoloed = _Symbol();
            trkMuted = _Symbol();
            trkLastGain = _Symbol();

            Track = (function (_AudioModule) {
                _inherits(Track, _AudioModule);

                function Track(constructFn) {
                    var _this = this;

                    _classCallCheck(this, Track);

                    _get(Object.getPrototypeOf(Track.prototype), 'constructor', this).call(this);

                    if (typeof constructFn !== 'function') {
                        throw new Error('audioMixer.Track constructor requires an argument that is a function');
                    } else {
                        this[trkContents] = constructFn();
                        if (!this[trkContents].startables && !this[trkContents].endpoint) {
                            throw new Error('constructFn passed to audioMixer.Track must' + "return an object with 'startables' and 'endpoint' properties");
                        }
                    }

                    var gain = Gain();
                    this[trkContents].endpoint.link(gain);

                    /**
                     * AudioParam that can be used to control output gain
                     * @property {AudioParam} gain
                     */
                    this.gain = gain.gain;

                    this[trkDestroy] = function () {
                        if (_this[trkContents].endpoint.sever) _this[trkContents].endpoint.sever();else _this[trkContents].endpoint.disconnect();
                        _this[trkContents] = null;
                    };
                    this[trkCommand] = function (cmd) {
                        var _iteratorNormalCompletion = true;
                        var _didIteratorError = false;
                        var _iteratorError = undefined;

                        try {
                            for (var _iterator = _getIterator(_this[trkContents].startables), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                                var obj = _step.value;

                                if (obj[cmd]) obj[cmd]();
                            }
                        } catch (err) {
                            _didIteratorError = true;
                            _iteratorError = err;
                        } finally {
                            try {
                                if (!_iteratorNormalCompletion && _iterator['return']) {
                                    _iterator['return']();
                                }
                            } finally {
                                if (_didIteratorError) {
                                    throw _iteratorError;
                                }
                            }
                        }
                    };

                    this[trkSoloed] = false;

                    document.addEventListener('trackSoloedStateChange', function () {
                        if (soloCount && _this.solo) _this.mute = false;else if (soloCount && !_this.solo) _this.mute = true;else if (!soloCount) _this.mute = false;
                    });

                    this[trkMuted] = false;
                    this[trkLastGain] = 0;

                    /**
                     * signal out
                     * @property {AudioNode} _link_alias_out
                     * @extends audio.core.AudioModule._link_alias_out
                     */
                    this._link_alias_out = gain;
                }

                /**
                 * Bus provides facilities for grouping tracks, as well as an effects chain.
                 * @namespace audio.mixer
                 * @class Bus
                 * @constructor
                 */

                /**
                 * Start track playback
                 * @method start
                 */

                _createClass(Track, [{
                    key: 'start',
                    value: function start() {
                        var _arr = ['start', 'execute'];

                        for (var _i = 0; _i < _arr.length; _i++) {
                            var cmd = _arr[_i];
                            this[trkCommand](cmd);
                        }
                    }

                    /**
                     * Pause track playback (if applicable)
                     * @method pause
                     */
                }, {
                    key: 'pause',
                    value: function pause() {
                        return this[trkCommand]('pause');
                    }

                    /**
                     * Stop track playback
                     * @method stop
                     */
                }, {
                    key: 'stop',
                    value: function stop() {
                        var _arr2 = ['stop', 'shirk'];

                        for (var _i2 = 0; _i2 < _arr2.length; _i2++) {
                            var cmd = _arr2[_i2];
                            this[trkCommand](cmd);
                        }
                    }

                    /**
                     * Indicates if this track is soloed. Settable.
                     * @property {boolean} solo
                     */
                }, {
                    key: 'solo',
                    get: function get() {
                        return this[trkSoloed];
                    },
                    set: function set(v) {
                        if (this[trkSoloed] && !v) soloCount--;else if (v) soloCount++;
                        this[trkSoloed] = v;
                        document.dispatchEvent(soloEvent);
                    }

                    /**
                     * Indicates if this track is muted. Settable.
                     * @property {boolean} mute
                     */
                }, {
                    key: 'mute',
                    get: function get() {
                        return this[trkMuted];
                    },
                    set: function set(v) {
                        this[trkMuted] = !!v;
                        if (this[trkMuted] && this[trkLastGain] === 0) {
                            this[trkLastGain] = this.gain.value;
                            this.gain.value = 0;
                        } else if (!this[trkMuted] && this[trkContents].endpoint.gain.value === 0) {
                            this.gain.value = this[trkLastGain];
                            this[trkLastGain] = 0;
                        }
                    }
                }]);

                return Track;
            })(AudioModule);

            _export('Track', Track);

            busTracks = _Symbol();
            busInput = _Symbol();
            busOutput = _Symbol();
            busChain = _Symbol();
            busTrkCount = _Symbol();
            busCommand = _Symbol();

            Bus = (function (_AudioModule2) {
                _inherits(Bus, _AudioModule2);

                function Bus() {
                    var _this2 = this;

                    _classCallCheck(this, Bus);

                    _get(Object.getPrototypeOf(Bus.prototype), 'constructor', this).call(this);

                    this[busTracks] = {};

                    this[busInput] = Gain();
                    this[busOutput] = Gain();

                    this[busInput].link(this[busOutput]);

                    this[busChain] = {};

                    this[busTrkCount] = 0;

                    this[busCommand] = function (cmd) {
                        var _iteratorNormalCompletion2 = true;
                        var _didIteratorError2 = false;
                        var _iteratorError2 = undefined;

                        try {
                            for (var _iterator2 = _getIterator(_Object$keys(_this2[busTracks])), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                                var trk = _step2.value;

                                _this2[busTracks][trk][cmd]();
                            }
                        } catch (err) {
                            _didIteratorError2 = true;
                            _iteratorError2 = err;
                        } finally {
                            try {
                                if (!_iteratorNormalCompletion2 && _iterator2['return']) {
                                    _iterator2['return']();
                                }
                            } finally {
                                if (_didIteratorError2) {
                                    throw _iteratorError2;
                                }
                            }
                        }
                    };

                    /**
                     * signal out
                     * @property {AudioNode} _link_alias_out
                     */
                    this._link_alias_out = this[busOutput];
                }

                /**
                 * Adds an effect to the bus effect chain.
                 * @method addEffect
                 * @param {AudioModule} module - effect to add
                 * @param {number} index - location of new effect in effects chain, 
                 *      @default the current end of the effects chain.
                 * @return {number} - the index of the module in the effects chain
                 */

                _createClass(Bus, [{
                    key: 'addEffect',
                    value: function addEffect(module, index) {
                        var busKeys = _Object$keys(this[busChain]).map(function (v) {
                            return Number(v);
                        }).sort(function (a, b) {
                            return a - b;
                        });

                        var busChainMax = busKeys.length > 0 ? busKeys.reduce(function (prev, curr) {
                            return prev > curr ? prev : curr;
                        }) : 0;

                        var idx = typeof index !== "number" ? busChainMax + 1 : index < 0 ? 0 : index;

                        this[busChain][idx] = module;

                        var currIdxs = _Object$keys(this[busChain]).map(function (v) {
                            return Number(v);
                        }).sort(function (a, b) {
                            return a - b;
                        });

                        var curr = currIdxs.indexOf(idx);

                        var nodeInFront = typeof currIdxs[curr - 1] !== 'undefined' ? this[busChain][currIdxs[curr - 1]] : this[busInput];

                        var nodeBehind = typeof currIdxs[curr + 1] !== 'undefined' ? this[busChain][currIdxs[curr + 1]] : this[busOutput];

                        nodeInFront.sever();
                        nodeInFront.link(module).link(nodeBehind);

                        return idx;
                    }

                    /**
                     * Removes effect from chain
                     * @method removeEffect
                     * @param {AudioModule | Number} index - AudioModule to remove, or index# of 
                     *      AudioModule to remove
                     */
                }, {
                    key: 'removeEffect',
                    value: function removeEffect(index) {
                        var idx = undefined;

                        var busKeys = _Object$keys(this[busChain]).map(function (v) {
                            return Number(v);
                        }).sort(function (a, b) {
                            return a - b;
                        });

                        if (index instanceof AudioModule) {
                            var _iteratorNormalCompletion3 = true;
                            var _didIteratorError3 = false;
                            var _iteratorError3 = undefined;

                            try {
                                for (var _iterator3 = _getIterator(busKeys), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                                    var prop = _step3.value;

                                    if (this[busChain][prop] === index) idx = prop;
                                }
                            } catch (err) {
                                _didIteratorError3 = true;
                                _iteratorError3 = err;
                            } finally {
                                try {
                                    if (!_iteratorNormalCompletion3 && _iterator3['return']) {
                                        _iterator3['return']();
                                    }
                                } finally {
                                    if (_didIteratorError3) {
                                        throw _iteratorError3;
                                    }
                                }
                            }
                        } else if (typeof index === 'number') {
                            idx = idx < 0 ? 0 : index;
                        }

                        var nodeInFront = typeof this[busChain][idx - 1] !== 'undefined' ? this[busChain][idx - 1] : this[busInput];

                        var nodeBehind = typeof this[busChain][idx + 1] !== 'undefined' ? this[busChain][idx + 1] : this[busOutput];

                        if (this[busChain][idx] !== 'undefined') {
                            this[busChain][idx].sever();
                            delete this[busChain][idx];

                            nodeInFront.link(nodeBehind);
                        } else {
                            throw new Error('audioModule ' + index + ' not found in effects chain');
                        }
                    }

                    /**
                     * Remove all effects from chain
                     * @method removeAllEffects
                     */
                }, {
                    key: 'removeAllEffects',
                    value: function removeAllEffects() {
                        var _iteratorNormalCompletion4 = true;
                        var _didIteratorError4 = false;
                        var _iteratorError4 = undefined;

                        try {
                            for (var _iterator4 = _getIterator(_Object$keys(this[busChain])), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
                                var eff = _step4.value;

                                this.removeEffect(this[busChain][eff]);
                            }
                        } catch (err) {
                            _didIteratorError4 = true;
                            _iteratorError4 = err;
                        } finally {
                            try {
                                if (!_iteratorNormalCompletion4 && _iterator4['return']) {
                                    _iterator4['return']();
                                }
                            } finally {
                                if (_didIteratorError4) {
                                    throw _iteratorError4;
                                }
                            }
                        }
                    }

                    /**
                     * Add tracks to bus
                     * @method addTrack
                     * @param {Track...} tracks - tracks to add
                     */
                }, {
                    key: 'addTrack',
                    value: function addTrack() {
                        for (var i = 0; i < arguments.length; i++) {
                            var trk = arguments[i];
                            if (trk instanceof Track || trk instanceof Bus) {
                                this[busTracks][this[busTrkCount]++] = trk;
                                trk.link(this[busInput]);
                            } // else err!
                        }
                    }

                    /**
                     * Remove track from bus
                     * @method removeTrack
                     * @param {Track} track - track to remove 
                     */
                    // is completely dereferencing the track after removing it
                    // from the bus a good idea?
                    // make this accept a variable number of args
                }, {
                    key: 'removeTrack',
                    value: function removeTrack(track) {
                        var _iteratorNormalCompletion5 = true;
                        var _didIteratorError5 = false;
                        var _iteratorError5 = undefined;

                        try {
                            for (var _iterator5 = _getIterator(_Object$keys(this[busTracks])), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
                                var trk = _step5.value;

                                if (track === this[busTracks][trk]) {
                                    delete this[busTracks][trk];
                                    track[trkDestroy]();
                                    track = null;
                                }
                            }
                        } catch (err) {
                            _didIteratorError5 = true;
                            _iteratorError5 = err;
                        } finally {
                            try {
                                if (!_iteratorNormalCompletion5 && _iterator5['return']) {
                                    _iterator5['return']();
                                }
                            } finally {
                                if (_didIteratorError5) {
                                    throw _iteratorError5;
                                }
                            }
                        }
                    }

                    /**
                     * Start playback in all tracks
                     * @method start
                     */
                }, {
                    key: 'start',
                    value: function start() {
                        this[busCommand]('start');
                    }

                    /**
                     * Stop all track playback
                     * @method stop
                     */
                }, {
                    key: 'stop',
                    value: function stop() {
                        this[busCommand]('stop');
                    }
                }]);

                return Bus;
            })(AudioModule);

            _export('Bus', Bus);
        }
    };
});
$__System.registerDynamic("44", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var TAFFY,
      exports,
      T;
  (function() {
    var f,
        q,
        p,
        t,
        d,
        b,
        n,
        m,
        r,
        e,
        c,
        u,
        w,
        v,
        h,
        g,
        j,
        o,
        i,
        l,
        a,
        s,
        k;
    if (!TAFFY) {
      d = "2.7";
      b = 1;
      n = "000000";
      m = 1000;
      r = {};
      e = function(x) {
        if (TAFFY.isArray(x) || TAFFY.isObject(x)) {
          return x;
        } else {
          return JSON.parse(x);
        }
      };
      i = function(y, x) {
        return l(y, function(z) {
          return x.indexOf(z) >= 0;
        });
      };
      l = function(A, z, y) {
        var x = [];
        if (A == null) {
          return x;
        }
        if (Array.prototype.filter && A.filter === Array.prototype.filter) {
          return A.filter(z, y);
        }
        c(A, function(D, B, C) {
          if (z.call(y, D, B, C)) {
            x[x.length] = D;
          }
        });
        return x;
      };
      k = function(x) {
        return Object.prototype.toString.call(x) === "[object RegExp]";
      };
      s = function(z) {
        var x = T.isArray(z) ? [] : T.isObject(z) ? {} : null;
        if (z === null) {
          return z;
        }
        for (var y in z) {
          x[y] = k(z[y]) ? z[y].toString() : T.isArray(z[y]) || T.isObject(z[y]) ? s(z[y]) : z[y];
        }
        return x;
      };
      a = function(y) {
        var x = JSON.stringify(y);
        if (x.match(/regex/) === null) {
          return x;
        }
        return JSON.stringify(s(y));
      };
      c = function(B, A, C) {
        var E,
            D,
            z,
            F;
        if (B && ((T.isArray(B) && B.length === 1) || (!T.isArray(B)))) {
          A((T.isArray(B)) ? B[0] : B, 0);
        } else {
          for (E, D, z = 0, B = (T.isArray(B)) ? B : [B], F = B.length; z < F; z++) {
            D = B[z];
            if (!T.isUndefined(D) || (C || false)) {
              E = A(D, z);
              if (E === T.EXIT) {
                break;
              }
            }
          }
        }
      };
      u = function(C, z) {
        var y = 0,
            B,
            A;
        for (A in C) {
          if (C.hasOwnProperty(A)) {
            B = z(C[A], A, y++);
            if (B === T.EXIT) {
              break;
            }
          }
        }
      };
      r.extend = function(x, y) {
        r[x] = function() {
          return y.apply(this, arguments);
        };
      };
      w = function(y) {
        var x;
        if (T.isString(y) && /[t][0-9]*[r][0-9]*/i.test(y)) {
          return true;
        }
        if (T.isObject(y) && y.___id && y.___s) {
          return true;
        }
        if (T.isArray(y)) {
          x = true;
          c(y, function(z) {
            if (!w(z)) {
              x = false;
              return TAFFY.EXIT;
            }
          });
          return x;
        }
        return false;
      };
      h = function(z, y) {
        var x = true;
        c(y, function(A) {
          switch (T.typeOf(A)) {
            case "function":
              if (!A.apply(z)) {
                x = false;
                return TAFFY.EXIT;
              }
              break;
            case "array":
              x = (A.length === 1) ? (h(z, A[0])) : (A.length === 2) ? (h(z, A[0]) || h(z, A[1])) : (A.length === 3) ? (h(z, A[0]) || h(z, A[1]) || h(z, A[2])) : (A.length === 4) ? (h(z, A[0]) || h(z, A[1]) || h(z, A[2]) || h(z, A[3])) : false;
              if (A.length > 4) {
                c(A, function(B) {
                  if (h(z, B)) {
                    x = true;
                  }
                });
              }
              break;
          }
        });
        return x;
      };
      v = function(y) {
        var x = [];
        if (T.isString(y) && /[t][0-9]*[r][0-9]*/i.test(y)) {
          y = {___id: y};
        }
        if (T.isArray(y)) {
          c(y, function(z) {
            x.push(v(z));
          });
          y = function() {
            var A = this,
                z = false;
            c(x, function(B) {
              if (h(A, B)) {
                z = true;
              }
            });
            return z;
          };
          return y;
        }
        if (T.isObject(y)) {
          if (T.isObject(y) && y.___id && y.___s) {
            y = {___id: y.___id};
          }
          u(y, function(z, A) {
            if (!T.isObject(z)) {
              z = {is: z};
            }
            u(z, function(B, C) {
              var E = [],
                  D;
              D = (C === "hasAll") ? function(F, G) {
                G(F);
              } : c;
              D(B, function(G) {
                var F = true,
                    H = false,
                    I;
                I = function() {
                  var N = this[A],
                      M = "==",
                      O = "!=",
                      Q = "===",
                      R = "<",
                      L = ">",
                      S = "<=",
                      P = ">=",
                      K = "!==",
                      J;
                  if (typeof N === "undefined") {
                    return false;
                  }
                  if ((C.indexOf("!") === 0) && C !== O && C !== K) {
                    F = false;
                    C = C.substring(1, C.length);
                  }
                  J = ((C === "regex") ? (G.test(N)) : (C === "lt" || C === R) ? (N < G) : (C === "gt" || C === L) ? (N > G) : (C === "lte" || C === S) ? (N <= G) : (C === "gte" || C === P) ? (N >= G) : (C === "left") ? (N.indexOf(G) === 0) : (C === "leftnocase") ? (N.toLowerCase().indexOf(G.toLowerCase()) === 0) : (C === "right") ? (N.substring((N.length - G.length)) === G) : (C === "rightnocase") ? (N.toLowerCase().substring((N.length - G.length)) === G.toLowerCase()) : (C === "like") ? (N.indexOf(G) >= 0) : (C === "likenocase") ? (N.toLowerCase().indexOf(G.toLowerCase()) >= 0) : (C === Q || C === "is") ? (N === G) : (C === M) ? (N == G) : (C === K) ? (N !== G) : (C === O) ? (N != G) : (C === "isnocase") ? (N.toLowerCase ? N.toLowerCase() === G.toLowerCase() : N === G) : (C === "has") ? (T.has(N, G)) : (C === "hasall") ? (T.hasAll(N, G)) : (C === "contains") ? (TAFFY.isArray(N) && N.indexOf(G) > -1) : (C.indexOf("is") === -1 && !TAFFY.isNull(N) && !TAFFY.isUndefined(N) && !TAFFY.isObject(G) && !TAFFY.isArray(G)) ? (G === N[C]) : (T[C] && T.isFunction(T[C]) && C.indexOf("is") === 0) ? T[C](N) === G : (T[C] && T.isFunction(T[C])) ? T[C](N, G) : (false));
                  J = (J && !F) ? false : (!J && !F) ? true : J;
                  return J;
                };
                E.push(I);
              });
              if (E.length === 1) {
                x.push(E[0]);
              } else {
                x.push(function() {
                  var G = this,
                      F = false;
                  c(E, function(H) {
                    if (H.apply(G)) {
                      F = true;
                    }
                  });
                  return F;
                });
              }
            });
          });
          y = function() {
            var A = this,
                z = true;
            z = (x.length === 1 && !x[0].apply(A)) ? false : (x.length === 2 && (!x[0].apply(A) || !x[1].apply(A))) ? false : (x.length === 3 && (!x[0].apply(A) || !x[1].apply(A) || !x[2].apply(A))) ? false : (x.length === 4 && (!x[0].apply(A) || !x[1].apply(A) || !x[2].apply(A) || !x[3].apply(A))) ? false : true;
            if (x.length > 4) {
              c(x, function(B) {
                if (!h(A, B)) {
                  z = false;
                }
              });
            }
            return z;
          };
          return y;
        }
        if (T.isFunction(y)) {
          return y;
        }
      };
      j = function(x, y) {
        var z = function(B, A) {
          var C = 0;
          T.each(y, function(F) {
            var H,
                E,
                D,
                I,
                G;
            H = F.split(" ");
            E = H[0];
            D = (H.length === 1) ? "logical" : H[1];
            if (D === "logical") {
              I = g(B[E]);
              G = g(A[E]);
              T.each((I.length <= G.length) ? I : G, function(J, K) {
                if (I[K] < G[K]) {
                  C = -1;
                  return TAFFY.EXIT;
                } else {
                  if (I[K] > G[K]) {
                    C = 1;
                    return TAFFY.EXIT;
                  }
                }
              });
            } else {
              if (D === "logicaldesc") {
                I = g(B[E]);
                G = g(A[E]);
                T.each((I.length <= G.length) ? I : G, function(J, K) {
                  if (I[K] > G[K]) {
                    C = -1;
                    return TAFFY.EXIT;
                  } else {
                    if (I[K] < G[K]) {
                      C = 1;
                      return TAFFY.EXIT;
                    }
                  }
                });
              } else {
                if (D === "asec" && B[E] < A[E]) {
                  C = -1;
                  return T.EXIT;
                } else {
                  if (D === "asec" && B[E] > A[E]) {
                    C = 1;
                    return T.EXIT;
                  } else {
                    if (D === "desc" && B[E] > A[E]) {
                      C = -1;
                      return T.EXIT;
                    } else {
                      if (D === "desc" && B[E] < A[E]) {
                        C = 1;
                        return T.EXIT;
                      }
                    }
                  }
                }
              }
            }
            if (C === 0 && D === "logical" && I.length < G.length) {
              C = -1;
            } else {
              if (C === 0 && D === "logical" && I.length > G.length) {
                C = 1;
              } else {
                if (C === 0 && D === "logicaldesc" && I.length > G.length) {
                  C = -1;
                } else {
                  if (C === 0 && D === "logicaldesc" && I.length < G.length) {
                    C = 1;
                  }
                }
              }
            }
            if (C !== 0) {
              return T.EXIT;
            }
          });
          return C;
        };
        return (x && x.push) ? x.sort(z) : x;
      };
      (function() {
        var x = {},
            y = 0;
        g = function(z) {
          if (y > m) {
            x = {};
            y = 0;
          }
          return x["_" + z] || (function() {
            var D = String(z),
                C = [],
                G = "_",
                B = "",
                A,
                E,
                F;
            for (A = 0, E = D.length; A < E; A++) {
              F = D.charCodeAt(A);
              if ((F >= 48 && F <= 57) || F === 46) {
                if (B !== "n") {
                  B = "n";
                  C.push(G.toLowerCase());
                  G = "";
                }
                G = G + D.charAt(A);
              } else {
                if (B !== "s") {
                  B = "s";
                  C.push(parseFloat(G));
                  G = "";
                }
                G = G + D.charAt(A);
              }
            }
            C.push((B === "n") ? parseFloat(G) : G.toLowerCase());
            C.shift();
            x["_" + z] = C;
            y++;
            return C;
          }());
        };
      }());
      o = function() {
        this.context({results: this.getDBI().query(this.context())});
      };
      r.extend("filter", function() {
        var y = TAFFY.mergeObj(this.context(), {run: null}),
            x = [];
        c(y.q, function(z) {
          x.push(z);
        });
        y.q = x;
        c(arguments, function(z) {
          y.q.push(v(z));
          y.filterRaw.push(z);
        });
        return this.getroot(y);
      });
      r.extend("order", function(z) {
        z = z.split(",");
        var y = [],
            A;
        c(z, function(x) {
          y.push(x.replace(/^\s*/, "").replace(/\s*$/, ""));
        });
        A = TAFFY.mergeObj(this.context(), {sort: null});
        A.order = y;
        return this.getroot(A);
      });
      r.extend("limit", function(z) {
        var y = TAFFY.mergeObj(this.context(), {}),
            x;
        y.limit = z;
        if (y.run && y.sort) {
          x = [];
          c(y.results, function(B, A) {
            if ((A + 1) > z) {
              return TAFFY.EXIT;
            }
            x.push(B);
          });
          y.results = x;
        }
        return this.getroot(y);
      });
      r.extend("start", function(z) {
        var y = TAFFY.mergeObj(this.context(), {}),
            x;
        y.start = z;
        if (y.run && y.sort && !y.limit) {
          x = [];
          c(y.results, function(B, A) {
            if ((A + 1) > z) {
              x.push(B);
            }
          });
          y.results = x;
        } else {
          y = TAFFY.mergeObj(this.context(), {
            run: null,
            start: z
          });
        }
        return this.getroot(y);
      });
      r.extend("update", function(A, z, x) {
        var B = true,
            D = {},
            y = arguments,
            C;
        if (TAFFY.isString(A) && (arguments.length === 2 || arguments.length === 3)) {
          D[A] = z;
          if (arguments.length === 3) {
            B = x;
          }
        } else {
          D = A;
          if (y.length === 2) {
            B = z;
          }
        }
        C = this;
        o.call(this);
        c(this.context().results, function(E) {
          var F = D;
          if (TAFFY.isFunction(F)) {
            F = F.apply(TAFFY.mergeObj(E, {}));
          } else {
            if (T.isFunction(F)) {
              F = F(TAFFY.mergeObj(E, {}));
            }
          }
          if (TAFFY.isObject(F)) {
            C.getDBI().update(E.___id, F, B);
          }
        });
        if (this.context().results.length) {
          this.context({run: null});
        }
        return this;
      });
      r.extend("remove", function(x) {
        var y = this,
            z = 0;
        o.call(this);
        c(this.context().results, function(A) {
          y.getDBI().remove(A.___id);
          z++;
        });
        if (this.context().results.length) {
          this.context({run: null});
          y.getDBI().removeCommit(x);
        }
        return z;
      });
      r.extend("count", function() {
        o.call(this);
        return this.context().results.length;
      });
      r.extend("callback", function(z, x) {
        if (z) {
          var y = this;
          setTimeout(function() {
            o.call(y);
            z.call(y.getroot(y.context()));
          }, x || 0);
        }
        return null;
      });
      r.extend("get", function() {
        o.call(this);
        return this.context().results;
      });
      r.extend("stringify", function() {
        return JSON.stringify(this.get());
      });
      r.extend("first", function() {
        o.call(this);
        return this.context().results[0] || false;
      });
      r.extend("last", function() {
        o.call(this);
        return this.context().results[this.context().results.length - 1] || false;
      });
      r.extend("sum", function() {
        var y = 0,
            x = this;
        o.call(x);
        c(arguments, function(z) {
          c(x.context().results, function(A) {
            y = y + (A[z] || 0);
          });
        });
        return y;
      });
      r.extend("min", function(y) {
        var x = null;
        o.call(this);
        c(this.context().results, function(z) {
          if (x === null || z[y] < x) {
            x = z[y];
          }
        });
        return x;
      });
      (function() {
        var x = (function() {
          var A,
              y,
              z;
          A = function(E, G, D) {
            var C,
                F,
                H,
                B;
            if (D.length === 2) {
              C = E[D[0]];
              H = "===";
              F = G[D[1]];
            } else {
              C = E[D[0]];
              H = D[1];
              F = G[D[2]];
            }
            switch (H) {
              case "===":
                return C === F;
              case "!==":
                return C !== F;
              case "<":
                return C < F;
              case ">":
                return C > F;
              case "<=":
                return C <= F;
              case ">=":
                return C >= F;
              case "==":
                return C == F;
              case "!=":
                return C != F;
              default:
                throw String(H) + " is not supported";
            }
          };
          y = function(C, F) {
            var B = {},
                D,
                E;
            for (D in C) {
              if (C.hasOwnProperty(D)) {
                B[D] = C[D];
              }
            }
            for (D in F) {
              if (F.hasOwnProperty(D) && D !== "___id" && D !== "___s") {
                E = !TAFFY.isUndefined(B[D]) ? "right_" : "";
                B[E + String(D)] = F[D];
              }
            }
            return B;
          };
          z = function(F) {
            var B,
                D,
                C = arguments,
                E = C.length,
                G = [];
            if (typeof F.filter !== "function") {
              if (F.TAFFY) {
                B = F();
              } else {
                throw "TAFFY DB or result not supplied";
              }
            } else {
              B = F;
            }
            this.context({results: this.getDBI().query(this.context())});
            TAFFY.each(this.context().results, function(H) {
              B.each(function(K) {
                var I,
                    J = true;
                CONDITION: for (D = 1; D < E; D++) {
                  I = C[D];
                  if (typeof I === "function") {
                    J = I(H, K);
                  } else {
                    if (typeof I === "object" && I.length) {
                      J = A(H, K, I);
                    } else {
                      J = false;
                    }
                  }
                  if (!J) {
                    break CONDITION;
                  }
                }
                if (J) {
                  G.push(y(H, K));
                }
              });
            });
            return TAFFY(G)();
          };
          return z;
        }());
        r.extend("join", x);
      }());
      r.extend("max", function(y) {
        var x = null;
        o.call(this);
        c(this.context().results, function(z) {
          if (x === null || z[y] > x) {
            x = z[y];
          }
        });
        return x;
      });
      r.extend("select", function() {
        var y = [],
            x = arguments;
        o.call(this);
        if (arguments.length === 1) {
          c(this.context().results, function(z) {
            y.push(z[x[0]]);
          });
        } else {
          c(this.context().results, function(z) {
            var A = [];
            c(x, function(B) {
              A.push(z[B]);
            });
            y.push(A);
          });
        }
        return y;
      });
      r.extend("distinct", function() {
        var y = [],
            x = arguments;
        o.call(this);
        if (arguments.length === 1) {
          c(this.context().results, function(A) {
            var z = A[x[0]],
                B = false;
            c(y, function(C) {
              if (z === C) {
                B = true;
                return TAFFY.EXIT;
              }
            });
            if (!B) {
              y.push(z);
            }
          });
        } else {
          c(this.context().results, function(z) {
            var B = [],
                A = false;
            c(x, function(C) {
              B.push(z[C]);
            });
            c(y, function(D) {
              var C = true;
              c(x, function(F, E) {
                if (B[E] !== D[E]) {
                  C = false;
                  return TAFFY.EXIT;
                }
              });
              if (C) {
                A = true;
                return TAFFY.EXIT;
              }
            });
            if (!A) {
              y.push(B);
            }
          });
        }
        return y;
      });
      r.extend("supplant", function(y, x) {
        var z = [];
        o.call(this);
        c(this.context().results, function(A) {
          z.push(y.replace(/\{([^\{\}]*)\}/g, function(C, B) {
            var D = A[B];
            return typeof D === "string" || typeof D === "number" ? D : C;
          }));
        });
        return (!x) ? z.join("") : z;
      });
      r.extend("each", function(x) {
        o.call(this);
        c(this.context().results, x);
        return this;
      });
      r.extend("map", function(x) {
        var y = [];
        o.call(this);
        c(this.context().results, function(z) {
          y.push(x(z));
        });
        return y;
      });
      T = function(F) {
        var C = [],
            G = {},
            D = 1,
            z = {
              template: false,
              onInsert: false,
              onUpdate: false,
              onRemove: false,
              onDBChange: false,
              storageName: false,
              forcePropertyCase: null,
              cacheSize: 100,
              name: ""
            },
            B = new Date(),
            A = 0,
            y = 0,
            I = {},
            E,
            x,
            H;
        x = function(L) {
          var K = [],
              J = false;
          if (L.length === 0) {
            return C;
          }
          c(L, function(M) {
            if (T.isString(M) && /[t][0-9]*[r][0-9]*/i.test(M) && C[G[M]]) {
              K.push(C[G[M]]);
              J = true;
            }
            if (T.isObject(M) && M.___id && M.___s && C[G[M.___id]]) {
              K.push(C[G[M.___id]]);
              J = true;
            }
            if (T.isArray(M)) {
              c(M, function(N) {
                c(x(N), function(O) {
                  K.push(O);
                });
              });
            }
          });
          if (J && K.length > 1) {
            K = [];
          }
          return K;
        };
        E = {
          dm: function(J) {
            if (J) {
              B = J;
              I = {};
              A = 0;
              y = 0;
            }
            if (z.onDBChange) {
              setTimeout(function() {
                z.onDBChange.call(C);
              }, 0);
            }
            if (z.storageName) {
              setTimeout(function() {
                localStorage.setItem("taffy_" + z.storageName, JSON.stringify(C));
              });
            }
            return B;
          },
          insert: function(M, N) {
            var L = [],
                K = [],
                J = e(M);
            c(J, function(P, Q) {
              var O,
                  R;
              if (T.isArray(P) && Q === 0) {
                c(P, function(S) {
                  L.push((z.forcePropertyCase === "lower") ? S.toLowerCase() : (z.forcePropertyCase === "upper") ? S.toUpperCase() : S);
                });
                return true;
              } else {
                if (T.isArray(P)) {
                  O = {};
                  c(P, function(U, S) {
                    O[L[S]] = U;
                  });
                  P = O;
                } else {
                  if (T.isObject(P) && z.forcePropertyCase) {
                    R = {};
                    u(P, function(U, S) {
                      R[(z.forcePropertyCase === "lower") ? S.toLowerCase() : (z.forcePropertyCase === "upper") ? S.toUpperCase() : S] = P[S];
                    });
                    P = R;
                  }
                }
              }
              D++;
              P.___id = "T" + String(n + b).slice(-6) + "R" + String(n + D).slice(-6);
              P.___s = true;
              K.push(P.___id);
              if (z.template) {
                P = T.mergeObj(z.template, P);
              }
              C.push(P);
              G[P.___id] = C.length - 1;
              if (z.onInsert && (N || TAFFY.isUndefined(N))) {
                z.onInsert.call(P);
              }
              E.dm(new Date());
            });
            return H(K);
          },
          sort: function(J) {
            C = j(C, J.split(","));
            G = {};
            c(C, function(L, K) {
              G[L.___id] = K;
            });
            E.dm(new Date());
            return true;
          },
          update: function(Q, M, L) {
            var P = {},
                O,
                N,
                J,
                K;
            if (z.forcePropertyCase) {
              u(M, function(R, S) {
                P[(z.forcePropertyCase === "lower") ? S.toLowerCase() : (z.forcePropertyCase === "upper") ? S.toUpperCase() : S] = R;
              });
              M = P;
            }
            O = C[G[Q]];
            N = T.mergeObj(O, M);
            J = {};
            K = false;
            u(N, function(R, S) {
              if (TAFFY.isUndefined(O[S]) || O[S] !== R) {
                J[S] = R;
                K = true;
              }
            });
            if (K) {
              if (z.onUpdate && (L || TAFFY.isUndefined(L))) {
                z.onUpdate.call(N, C[G[Q]], J);
              }
              C[G[Q]] = N;
              E.dm(new Date());
            }
          },
          remove: function(J) {
            C[G[J]].___s = false;
          },
          removeCommit: function(K) {
            var J;
            for (J = C.length - 1; J > -1; J--) {
              if (!C[J].___s) {
                if (z.onRemove && (K || TAFFY.isUndefined(K))) {
                  z.onRemove.call(C[J]);
                }
                G[C[J].___id] = undefined;
                C.splice(J, 1);
              }
            }
            G = {};
            c(C, function(M, L) {
              G[M.___id] = L;
            });
            E.dm(new Date());
          },
          query: function(L) {
            var O,
                P,
                K,
                N,
                M,
                J;
            if (z.cacheSize) {
              P = "";
              c(L.filterRaw, function(Q) {
                if (T.isFunction(Q)) {
                  P = "nocache";
                  return TAFFY.EXIT;
                }
              });
              if (P === "") {
                P = a(T.mergeObj(L, {
                  q: false,
                  run: false,
                  sort: false
                }));
              }
            }
            if (!L.results || !L.run || (L.run && E.dm() > L.run)) {
              K = [];
              if (z.cacheSize && I[P]) {
                I[P].i = A++;
                return I[P].results;
              } else {
                if (L.q.length === 0 && L.index.length === 0) {
                  c(C, function(Q) {
                    K.push(Q);
                  });
                  O = K;
                } else {
                  N = x(L.index);
                  c(N, function(Q) {
                    if (L.q.length === 0 || h(Q, L.q)) {
                      K.push(Q);
                    }
                  });
                  O = K;
                }
              }
            } else {
              O = L.results;
            }
            if (L.order.length > 0 && (!L.run || !L.sort)) {
              O = j(O, L.order);
            }
            if (O.length && ((L.limit && L.limit < O.length) || L.start)) {
              M = [];
              c(O, function(R, Q) {
                if (!L.start || (L.start && (Q + 1) >= L.start)) {
                  if (L.limit) {
                    J = (L.start) ? (Q + 1) - L.start : Q;
                    if (J < L.limit) {
                      M.push(R);
                    } else {
                      if (J > L.limit) {
                        return TAFFY.EXIT;
                      }
                    }
                  } else {
                    M.push(R);
                  }
                }
              });
              O = M;
            }
            if (z.cacheSize && P !== "nocache") {
              y++;
              setTimeout(function() {
                var Q,
                    R;
                if (y >= z.cacheSize * 2) {
                  y = 0;
                  Q = A - z.cacheSize;
                  R = {};
                  u(function(U, S) {
                    if (U.i >= Q) {
                      R[S] = U;
                    }
                  });
                  I = R;
                }
              }, 0);
              I[P] = {
                i: A++,
                results: O
              };
            }
            return O;
          }
        };
        H = function() {
          var K,
              J;
          K = TAFFY.mergeObj(TAFFY.mergeObj(r, {insert: undefined}), {
            getDBI: function() {
              return E;
            },
            getroot: function(L) {
              return H.call(L);
            },
            context: function(L) {
              if (L) {
                J = TAFFY.mergeObj(J, L.hasOwnProperty("results") ? TAFFY.mergeObj(L, {
                  run: new Date(),
                  sort: new Date()
                }) : L);
              }
              return J;
            },
            extend: undefined
          });
          J = (this && this.q) ? this : {
            limit: false,
            start: false,
            q: [],
            filterRaw: [],
            index: [],
            order: [],
            results: false,
            run: null,
            sort: null,
            settings: z
          };
          c(arguments, function(L) {
            if (w(L)) {
              J.index.push(L);
            } else {
              J.q.push(v(L));
            }
            J.filterRaw.push(L);
          });
          return K;
        };
        b++;
        if (F) {
          E.insert(F);
        }
        H.insert = E.insert;
        H.merge = function(M, L, N) {
          var K = {},
              J = [],
              O = {};
          N = N || false;
          L = L || "id";
          c(M, function(Q) {
            var P;
            K[L] = Q[L];
            J.push(Q[L]);
            P = H(K).first();
            if (P) {
              E.update(P.___id, Q, N);
            } else {
              E.insert(Q, N);
            }
          });
          O[L] = J;
          return H(O);
        };
        H.TAFFY = true;
        H.sort = E.sort;
        H.settings = function(J) {
          if (J) {
            z = TAFFY.mergeObj(z, J);
            if (J.template) {
              H().update(J.template);
            }
          }
          return z;
        };
        H.store = function(L) {
          var K = false,
              J;
          if (localStorage) {
            if (L) {
              J = localStorage.getItem("taffy_" + L);
              if (J && J.length > 0) {
                H.insert(J);
                K = true;
              }
              if (C.length > 0) {
                setTimeout(function() {
                  localStorage.setItem("taffy_" + z.storageName, JSON.stringify(C));
                });
              }
            }
            H.settings({storageName: L});
          }
          return H;
        };
        return H;
      };
      TAFFY = T;
      T.each = c;
      T.eachin = u;
      T.extend = r.extend;
      TAFFY.EXIT = "TAFFYEXIT";
      TAFFY.mergeObj = function(z, x) {
        var y = {};
        u(z, function(A, B) {
          y[B] = z[B];
        });
        u(x, function(A, B) {
          y[B] = x[B];
        });
        return y;
      };
      TAFFY.has = function(z, y) {
        var x = false,
            A;
        if ((z.TAFFY)) {
          x = z(y);
          if (x.length > 0) {
            return true;
          } else {
            return false;
          }
        } else {
          switch (T.typeOf(z)) {
            case "object":
              if (T.isObject(y)) {
                u(y, function(B, C) {
                  if (x === true && !T.isUndefined(z[C]) && z.hasOwnProperty(C)) {
                    x = T.has(z[C], y[C]);
                  } else {
                    x = false;
                    return TAFFY.EXIT;
                  }
                });
              } else {
                if (T.isArray(y)) {
                  c(y, function(B, C) {
                    x = T.has(z, y[C]);
                    if (x) {
                      return TAFFY.EXIT;
                    }
                  });
                } else {
                  if (T.isString(y)) {
                    if (!TAFFY.isUndefined(z[y])) {
                      return true;
                    } else {
                      return false;
                    }
                  }
                }
              }
              return x;
            case "array":
              if (T.isObject(y)) {
                c(z, function(B, C) {
                  x = T.has(z[C], y);
                  if (x === true) {
                    return TAFFY.EXIT;
                  }
                });
              } else {
                if (T.isArray(y)) {
                  c(y, function(C, B) {
                    c(z, function(E, D) {
                      x = T.has(z[D], y[B]);
                      if (x === true) {
                        return TAFFY.EXIT;
                      }
                    });
                    if (x === true) {
                      return TAFFY.EXIT;
                    }
                  });
                } else {
                  if (T.isString(y) || T.isNumber(y)) {
                    x = false;
                    for (A = 0; A < z.length; A++) {
                      x = T.has(z[A], y);
                      if (x) {
                        return true;
                      }
                    }
                  }
                }
              }
              return x;
            case "string":
              if (T.isString(y) && y === z) {
                return true;
              }
              break;
            default:
              if (T.typeOf(z) === T.typeOf(y) && z === y) {
                return true;
              }
              break;
          }
        }
        return false;
      };
      TAFFY.hasAll = function(A, z) {
        var y = TAFFY,
            x;
        if (y.isArray(z)) {
          x = true;
          c(z, function(B) {
            x = y.has(A, B);
            if (x === false) {
              return TAFFY.EXIT;
            }
          });
          return x;
        } else {
          return y.has(A, z);
        }
      };
      TAFFY.typeOf = function(x) {
        var y = typeof x;
        if (y === "object") {
          if (x) {
            if (typeof x.length === "number" && !(x.propertyIsEnumerable("length"))) {
              y = "array";
            }
          } else {
            y = "null";
          }
        }
        return y;
      };
      TAFFY.getObjectKeys = function(x) {
        var y = [];
        u(x, function(A, z) {
          y.push(z);
        });
        y.sort();
        return y;
      };
      TAFFY.isSameArray = function(y, x) {
        return (TAFFY.isArray(y) && TAFFY.isArray(x) && y.join(",") === x.join(",")) ? true : false;
      };
      TAFFY.isSameObject = function(A, y) {
        var x = TAFFY,
            z = true;
        if (x.isObject(A) && x.isObject(y)) {
          if (x.isSameArray(x.getObjectKeys(A), x.getObjectKeys(y))) {
            u(A, function(B, C) {
              if (!((x.isObject(A[C]) && x.isObject(y[C]) && x.isSameObject(A[C], y[C])) || (x.isArray(A[C]) && x.isArray(y[C]) && x.isSameArray(A[C], y[C])) || (A[C] === y[C]))) {
                z = false;
                return TAFFY.EXIT;
              }
            });
          } else {
            z = false;
          }
        } else {
          z = false;
        }
        return z;
      };
      f = ["String", "Number", "Object", "Array", "Boolean", "Null", "Function", "Undefined"];
      q = function(x) {
        return function(y) {
          return TAFFY.typeOf(y) === x.toLowerCase() ? true : false;
        };
      };
      for (p = 0; p < f.length; p++) {
        t = f[p];
        TAFFY["is" + t] = q(t);
      }
    }
  }());
  if (typeof(exports) === "object") {
    exports.taffy = TAFFY;
  }
  ;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("45", ["37", "46", "6"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var anObject = req('37'),
      get = req('46');
  module.exports = req('6').getIterator = function(it) {
    var iterFn = get(it);
    if (typeof iterFn != 'function')
      throw TypeError(it + ' is not iterable!');
    return anObject(iterFn.call(it));
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("47", ["48", "49", "45"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  req('48');
  req('49');
  module.exports = req('45');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("14", ["47"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {
    "default": req('47'),
    __esModule: true
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("4a", ["36"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var ITERATOR = req('36')('iterator'),
      SAFE_CLOSING = false;
  try {
    var riter = [7][ITERATOR]();
    riter['return'] = function() {
      SAFE_CLOSING = true;
    };
    Array.from(riter, function() {
      throw 2;
    });
  } catch (e) {}
  module.exports = function(exec, skipClosing) {
    if (!skipClosing && !SAFE_CLOSING)
      return false;
    var safe = false;
    try {
      var arr = [7],
          iter = arr[ITERATOR]();
      iter.next = function() {
        safe = true;
      };
      arr[ITERATOR] = function() {
        return iter;
      };
      exec(arr);
    } catch (e) {}
    return safe;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("4b", ["6", "28", "2f", "36"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var core = req('6'),
      $ = req('28'),
      DESCRIPTORS = req('2f'),
      SPECIES = req('36')('species');
  module.exports = function(KEY) {
    var C = core[KEY];
    if (DESCRIPTORS && C && !C[SPECIES])
      $.setDesc(C, SPECIES, {
        configurable: true,
        get: function() {
          return this;
        }
      });
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("4c", ["31"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $redef = req('31');
  module.exports = function(target, src) {
    for (var key in src)
      $redef(target, key, src[key]);
    return target;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("4d", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var process = module.exports = {};
  var queue = [];
  var draining = false;
  var currentQueue;
  var queueIndex = -1;
  function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
      queue = currentQueue.concat(queue);
    } else {
      queueIndex = -1;
    }
    if (queue.length) {
      drainQueue();
    }
  }
  function drainQueue() {
    if (draining) {
      return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;
    var len = queue.length;
    while (len) {
      currentQueue = queue;
      queue = [];
      while (++queueIndex < len) {
        if (currentQueue) {
          currentQueue[queueIndex].run();
        }
      }
      queueIndex = -1;
      len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
  }
  process.nextTick = function(fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
      for (var i = 1; i < arguments.length; i++) {
        args[i - 1] = arguments[i];
      }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
      setTimeout(drainQueue, 0);
    }
  };
  function Item(fun, array) {
    this.fun = fun;
    this.array = array;
  }
  Item.prototype.run = function() {
    this.fun.apply(null, this.array);
  };
  process.title = 'browser';
  process.browser = true;
  process.env = {};
  process.argv = [];
  process.version = '';
  process.versions = {};
  function noop() {}
  process.on = noop;
  process.addListener = noop;
  process.once = noop;
  process.off = noop;
  process.removeListener = noop;
  process.removeAllListeners = noop;
  process.emit = noop;
  process.binding = function(name) {
    throw new Error('process.binding is not supported');
  };
  process.cwd = function() {
    return '/';
  };
  process.chdir = function(dir) {
    throw new Error('process.chdir is not supported');
  };
  process.umask = function() {
    return 0;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("4e", ["4d"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = req('4d');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("4f", ["4e"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = $__System._nodeRequire ? process : req('4e');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("50", ["4f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = req('4f');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("51", ["3", "2d"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var isObject = req('3'),
      document = req('2d').document,
      is = isObject(document) && isObject(document.createElement);
  module.exports = function(it) {
    return is ? document.createElement(it) : {};
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("52", ["2d"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = req('2d').document && document.documentElement;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("53", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = function(fn, args, that) {
    var un = that === undefined;
    switch (args.length) {
      case 0:
        return un ? fn() : fn.call(that);
      case 1:
        return un ? fn(args[0]) : fn.call(that, args[0]);
      case 2:
        return un ? fn(args[0], args[1]) : fn.call(that, args[0], args[1]);
      case 3:
        return un ? fn(args[0], args[1], args[2]) : fn.call(that, args[0], args[1], args[2]);
      case 4:
        return un ? fn(args[0], args[1], args[2], args[3]) : fn.call(that, args[0], args[1], args[2], args[3]);
    }
    return fn.apply(that, args);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("54", ["55", "53", "52", "51", "2d", "26", "50"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var ctx = req('55'),
        invoke = req('53'),
        html = req('52'),
        cel = req('51'),
        global = req('2d'),
        process = global.process,
        setTask = global.setImmediate,
        clearTask = global.clearImmediate,
        MessageChannel = global.MessageChannel,
        counter = 0,
        queue = {},
        ONREADYSTATECHANGE = 'onreadystatechange',
        defer,
        channel,
        port;
    var run = function() {
      var id = +this;
      if (queue.hasOwnProperty(id)) {
        var fn = queue[id];
        delete queue[id];
        fn();
      }
    };
    var listner = function(event) {
      run.call(event.data);
    };
    if (!setTask || !clearTask) {
      setTask = function setImmediate(fn) {
        var args = [],
            i = 1;
        while (arguments.length > i)
          args.push(arguments[i++]);
        queue[++counter] = function() {
          invoke(typeof fn == 'function' ? fn : Function(fn), args);
        };
        defer(counter);
        return counter;
      };
      clearTask = function clearImmediate(id) {
        delete queue[id];
      };
      if (req('26')(process) == 'process') {
        defer = function(id) {
          process.nextTick(ctx(run, id, 1));
        };
      } else if (MessageChannel) {
        channel = new MessageChannel;
        port = channel.port2;
        channel.port1.onmessage = listner;
        defer = ctx(port.postMessage, port, 1);
      } else if (global.addEventListener && typeof postMessage == 'function' && !global.importScripts) {
        defer = function(id) {
          global.postMessage(id + '', '*');
        };
        global.addEventListener('message', listner, false);
      } else if (ONREADYSTATECHANGE in cel('script')) {
        defer = function(id) {
          html.appendChild(cel('script'))[ONREADYSTATECHANGE] = function() {
            html.removeChild(this);
            run.call(id);
          };
        };
      } else {
        defer = function(id) {
          setTimeout(ctx(run, id, 1), 0);
        };
      }
    }
    module.exports = {
      set: setTask,
      clear: clearTask
    };
  })(req('50'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("56", ["2d", "54", "26", "50"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    var global = req('2d'),
        macrotask = req('54').set,
        Observer = global.MutationObserver || global.WebKitMutationObserver,
        process = global.process,
        isNode = req('26')(process) == 'process',
        head,
        last,
        notify;
    var flush = function() {
      var parent,
          domain;
      if (isNode && (parent = process.domain)) {
        process.domain = null;
        parent.exit();
      }
      while (head) {
        domain = head.domain;
        if (domain)
          domain.enter();
        head.fn.call();
        if (domain)
          domain.exit();
        head = head.next;
      }
      last = undefined;
      if (parent)
        parent.enter();
    };
    if (isNode) {
      notify = function() {
        process.nextTick(flush);
      };
    } else if (Observer) {
      var toggle = 1,
          node = document.createTextNode('');
      new Observer(flush).observe(node, {characterData: true});
      notify = function() {
        node.data = toggle = -toggle;
      };
    } else {
      notify = function() {
        macrotask.call(global, flush);
      };
    }
    module.exports = function asap(fn) {
      var task = {
        fn: fn,
        next: undefined,
        domain: isNode && process.domain
      };
      if (last)
        last.next = task;
      if (!head) {
        head = task;
        notify();
      }
      last = task;
    };
  })(req('50'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("57", ["37", "58", "36"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var anObject = req('37'),
      aFunction = req('58'),
      SPECIES = req('36')('species');
  module.exports = function(O, D) {
    var C = anObject(O).constructor,
        S;
    return C === undefined || (S = anObject(C)[SPECIES]) == undefined ? D : aFunction(S);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("59", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = Object.is || function is(x, y) {
    return x === y ? x !== 0 || 1 / x === 1 / y : x != x && y != y;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("3e", ["28", "3", "37", "55"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var getDesc = req('28').getDesc,
      isObject = req('3'),
      anObject = req('37');
  var check = function(O, proto) {
    anObject(O);
    if (!isObject(proto) && proto !== null)
      throw TypeError(proto + ": can't set as prototype!");
  };
  module.exports = {
    set: Object.setPrototypeOf || ('__proto__' in {} ? function(test, buggy, set) {
      try {
        set = req('55')(Function.call, getDesc(Object.prototype, '__proto__').set, 2);
        set(test, []);
        buggy = !(test instanceof Array);
      } catch (e) {
        buggy = true;
      }
      return function setPrototypeOf(O, proto) {
        check(O, proto);
        if (buggy)
          O.__proto__ = proto;
        else
          set(O, proto);
        return O;
      };
    }({}, false) : undefined),
    check: check
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("46", ["5a", "36", "5b", "6"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var classof = req('5a'),
      ITERATOR = req('36')('iterator'),
      Iterators = req('5b');
  module.exports = req('6').getIteratorMethod = function(it) {
    if (it != undefined)
      return it[ITERATOR] || it['@@iterator'] || Iterators[classof(it)];
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("5c", ["5d"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var toInteger = req('5d'),
      min = Math.min;
  module.exports = function(it) {
    return it > 0 ? min(toInteger(it), 0x1fffffffffffff) : 0;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("5e", ["5b", "36"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var Iterators = req('5b'),
      ITERATOR = req('36')('iterator'),
      ArrayProto = Array.prototype;
  module.exports = function(it) {
    return (Iterators.Array || ArrayProto[ITERATOR]) === it;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("5f", ["37"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var anObject = req('37');
  module.exports = function(iterator, fn, value, entries) {
    try {
      return entries ? fn(anObject(value)[0], value[1]) : fn(value);
    } catch (e) {
      var ret = iterator['return'];
      if (ret !== undefined)
        anObject(ret.call(iterator));
      throw e;
    }
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("60", ["55", "5f", "5e", "37", "5c", "46"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var ctx = req('55'),
      call = req('5f'),
      isArrayIter = req('5e'),
      anObject = req('37'),
      toLength = req('5c'),
      getIterFn = req('46');
  module.exports = function(iterable, entries, fn, that) {
    var iterFn = getIterFn(iterable),
        f = ctx(fn, that, entries ? 2 : 1),
        index = 0,
        length,
        step,
        iterator;
    if (typeof iterFn != 'function')
      throw TypeError(iterable + ' is not iterable!');
    if (isArrayIter(iterFn))
      for (length = toLength(iterable.length); length > index; index++) {
        entries ? f(anObject(step = iterable[index])[0], step[1]) : f(iterable[index]);
      }
    else
      for (iterator = iterFn.call(iterable); !(step = iterator.next()).done; ) {
        call(iterator, f, step.value, entries);
      }
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("61", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = function(it, Constructor, name) {
    if (!(it instanceof Constructor))
      throw TypeError(name + ": use the 'new' operator!");
    return it;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("37", ["3"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var isObject = req('3');
  module.exports = function(it) {
    if (!isObject(it))
      throw TypeError(it + ' is not an object!');
    return it;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("3", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = function(it) {
    return typeof it === 'object' ? it !== null : typeof it === 'function';
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("5a", ["26", "36"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var cof = req('26'),
      TAG = req('36')('toStringTag'),
      ARG = cof(function() {
        return arguments;
      }()) == 'Arguments';
  module.exports = function(it) {
    var O,
        T,
        B;
    return it === undefined ? 'Undefined' : it === null ? 'Null' : typeof(T = (O = Object(it))[TAG]) == 'string' ? T : ARG ? cof(O) : (B = cof(O)) == 'Object' && typeof O.callee == 'function' ? 'Arguments' : B;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("58", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = function(it) {
    if (typeof it != 'function')
      throw TypeError(it + ' is not a function!');
    return it;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("55", ["58"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var aFunction = req('58');
  module.exports = function(fn, that, length) {
    aFunction(fn);
    if (that === undefined)
      return fn;
    switch (length) {
      case 1:
        return function(a) {
          return fn.call(that, a);
        };
      case 2:
        return function(a, b) {
          return fn.call(that, a, b);
        };
      case 3:
        return function(a, b, c) {
          return fn.call(that, a, b, c);
        };
    }
    return function() {
      return fn.apply(that, arguments);
    };
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("62", ["28", "39", "2d", "55", "5a", "30", "3", "37", "58", "61", "60", "3e", "59", "36", "57", "35", "56", "2f", "4c", "34", "4b", "6", "4a", "50"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var $ = req('28'),
        LIBRARY = req('39'),
        global = req('2d'),
        ctx = req('55'),
        classof = req('5a'),
        $def = req('30'),
        isObject = req('3'),
        anObject = req('37'),
        aFunction = req('58'),
        strictNew = req('61'),
        forOf = req('60'),
        setProto = req('3e').set,
        same = req('59'),
        SPECIES = req('36')('species'),
        speciesConstructor = req('57'),
        RECORD = req('35')('record'),
        asap = req('56'),
        PROMISE = 'Promise',
        process = global.process,
        isNode = classof(process) == 'process',
        P = global[PROMISE],
        Wrapper;
    var testResolve = function(sub) {
      var test = new P(function() {});
      if (sub)
        test.constructor = Object;
      return P.resolve(test) === test;
    };
    var useNative = function() {
      var works = false;
      function P2(x) {
        var self = new P(x);
        setProto(self, P2.prototype);
        return self;
      }
      try {
        works = P && P.resolve && testResolve();
        setProto(P2, P);
        P2.prototype = $.create(P.prototype, {constructor: {value: P2}});
        if (!(P2.resolve(5).then(function() {}) instanceof P2)) {
          works = false;
        }
        if (works && req('2f')) {
          var thenableThenGotten = false;
          P.resolve($.setDesc({}, 'then', {get: function() {
              thenableThenGotten = true;
            }}));
          works = thenableThenGotten;
        }
      } catch (e) {
        works = false;
      }
      return works;
    }();
    var isPromise = function(it) {
      return isObject(it) && (useNative ? classof(it) == 'Promise' : RECORD in it);
    };
    var sameConstructor = function(a, b) {
      if (LIBRARY && a === P && b === Wrapper)
        return true;
      return same(a, b);
    };
    var getConstructor = function(C) {
      var S = anObject(C)[SPECIES];
      return S != undefined ? S : C;
    };
    var isThenable = function(it) {
      var then;
      return isObject(it) && typeof(then = it.then) == 'function' ? then : false;
    };
    var notify = function(record, isReject) {
      if (record.n)
        return;
      record.n = true;
      var chain = record.c;
      asap(function() {
        var value = record.v,
            ok = record.s == 1,
            i = 0;
        var run = function(react) {
          var cb = ok ? react.ok : react.fail,
              ret,
              then;
          try {
            if (cb) {
              if (!ok)
                record.h = true;
              ret = cb === true ? value : cb(value);
              if (ret === react.P) {
                react.rej(TypeError('Promise-chain cycle'));
              } else if (then = isThenable(ret)) {
                then.call(ret, react.res, react.rej);
              } else
                react.res(ret);
            } else
              react.rej(value);
          } catch (err) {
            react.rej(err);
          }
        };
        while (chain.length > i)
          run(chain[i++]);
        chain.length = 0;
        record.n = false;
        if (isReject)
          setTimeout(function() {
            var promise = record.p,
                handler,
                console;
            if (isUnhandled(promise)) {
              if (isNode) {
                process.emit('unhandledRejection', value, promise);
              } else if (handler = global.onunhandledrejection) {
                handler({
                  promise: promise,
                  reason: value
                });
              } else if ((console = global.console) && console.error) {
                console.error('Unhandled promise rejection', value);
              }
            }
            record.a = undefined;
          }, 1);
      });
    };
    var isUnhandled = function(promise) {
      var record = promise[RECORD],
          chain = record.a || record.c,
          i = 0,
          react;
      if (record.h)
        return false;
      while (chain.length > i) {
        react = chain[i++];
        if (react.fail || !isUnhandled(react.P))
          return false;
      }
      return true;
    };
    var $reject = function(value) {
      var record = this;
      if (record.d)
        return;
      record.d = true;
      record = record.r || record;
      record.v = value;
      record.s = 2;
      record.a = record.c.slice();
      notify(record, true);
    };
    var $resolve = function(value) {
      var record = this,
          then;
      if (record.d)
        return;
      record.d = true;
      record = record.r || record;
      try {
        if (then = isThenable(value)) {
          asap(function() {
            var wrapper = {
              r: record,
              d: false
            };
            try {
              then.call(value, ctx($resolve, wrapper, 1), ctx($reject, wrapper, 1));
            } catch (e) {
              $reject.call(wrapper, e);
            }
          });
        } else {
          record.v = value;
          record.s = 1;
          notify(record, false);
        }
      } catch (e) {
        $reject.call({
          r: record,
          d: false
        }, e);
      }
    };
    if (!useNative) {
      P = function Promise(executor) {
        aFunction(executor);
        var record = {
          p: strictNew(this, P, PROMISE),
          c: [],
          a: undefined,
          s: 0,
          d: false,
          v: undefined,
          h: false,
          n: false
        };
        this[RECORD] = record;
        try {
          executor(ctx($resolve, record, 1), ctx($reject, record, 1));
        } catch (err) {
          $reject.call(record, err);
        }
      };
      req('4c')(P.prototype, {
        then: function then(onFulfilled, onRejected) {
          var react = {
            ok: typeof onFulfilled == 'function' ? onFulfilled : true,
            fail: typeof onRejected == 'function' ? onRejected : false
          };
          var promise = react.P = new (speciesConstructor(this, P))(function(res, rej) {
            react.res = res;
            react.rej = rej;
          });
          aFunction(react.res);
          aFunction(react.rej);
          var record = this[RECORD];
          record.c.push(react);
          if (record.a)
            record.a.push(react);
          if (record.s)
            notify(record, false);
          return promise;
        },
        'catch': function(onRejected) {
          return this.then(undefined, onRejected);
        }
      });
    }
    $def($def.G + $def.W + $def.F * !useNative, {Promise: P});
    req('34')(P, PROMISE);
    req('4b')(PROMISE);
    Wrapper = req('6')[PROMISE];
    $def($def.S + $def.F * !useNative, PROMISE, {reject: function reject(r) {
        return new this(function(res, rej) {
          rej(r);
        });
      }});
    $def($def.S + $def.F * (!useNative || testResolve(true)), PROMISE, {resolve: function resolve(x) {
        return isPromise(x) && sameConstructor(x.constructor, this) ? x : new this(function(res) {
          res(x);
        });
      }});
    $def($def.S + $def.F * !(useNative && req('4a')(function(iter) {
      P.all(iter)['catch'](function() {});
    })), PROMISE, {
      all: function all(iterable) {
        var C = getConstructor(this),
            values = [];
        return new C(function(res, rej) {
          forOf(iterable, false, values.push, values);
          var remaining = values.length,
              results = Array(remaining);
          if (remaining)
            $.each.call(values, function(promise, index) {
              C.resolve(promise).then(function(value) {
                results[index] = value;
                --remaining || res(results);
              }, rej);
            });
          else
            res(results);
        });
      },
      race: function race(iterable) {
        var C = getConstructor(this);
        return new C(function(res, rej) {
          forOf(iterable, false, function(promise) {
            C.resolve(promise).then(res, rej);
          });
        });
      }
    });
  })(req('50'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("63", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = function(done, value) {
    return {
      value: value,
      done: !!done
    };
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("64", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = function() {};
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("65", ["64", "63", "5b", "2a", "66"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var addToUnscopables = req('64'),
      step = req('63'),
      Iterators = req('5b'),
      toIObject = req('2a');
  module.exports = req('66')(Array, 'Array', function(iterated, kind) {
    this._t = toIObject(iterated);
    this._i = 0;
    this._k = kind;
  }, function() {
    var O = this._t,
        kind = this._k,
        index = this._i++;
    if (!O || index >= O.length) {
      this._t = undefined;
      return step(1);
    }
    if (kind == 'keys')
      return step(0, index);
    if (kind == 'values')
      return step(0, O[index]);
    return step(0, [index, O[index]]);
  }, 'values');
  Iterators.Arguments = Iterators.Array;
  addToUnscopables('keys');
  addToUnscopables('values');
  addToUnscopables('entries');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("48", ["65", "5b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  req('65');
  var Iterators = req('5b');
  Iterators.NodeList = Iterators.HTMLCollection = Iterators.Array;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("34", ["28", "2e", "36"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var def = req('28').setDesc,
      has = req('2e'),
      TAG = req('36')('toStringTag');
  module.exports = function(it, tag, stat) {
    if (it && !has(it = stat ? it : it.prototype, TAG))
      def(it, TAG, {
        configurable: true,
        value: tag
      });
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("67", ["28", "38", "34", "68", "36"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var $ = req('28'),
      descriptor = req('38'),
      setToStringTag = req('34'),
      IteratorPrototype = {};
  req('68')(IteratorPrototype, req('36')('iterator'), function() {
    return this;
  });
  module.exports = function(Constructor, NAME, next) {
    Constructor.prototype = $.create(IteratorPrototype, {next: descriptor(1, next)});
    setToStringTag(Constructor, NAME + ' Iterator');
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("5b", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {};
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("35", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var id = 0,
      px = Math.random();
  module.exports = function(key) {
    return 'Symbol('.concat(key === undefined ? '' : key, ')_', (++id + px).toString(36));
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("33", ["2d"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var global = req('2d'),
      SHARED = '__core-js_shared__',
      store = global[SHARED] || (global[SHARED] = {});
  module.exports = function(key) {
    return store[key] || (store[key] = {});
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("36", ["33", "35", "2d"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var store = req('33')('wks'),
      uid = req('35'),
      Symbol = req('2d').Symbol;
  module.exports = function(name) {
    return store[name] || (store[name] = Symbol && Symbol[name] || (Symbol || uid)('Symbol.' + name));
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("2e", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var hasOwnProperty = {}.hasOwnProperty;
  module.exports = function(it, key) {
    return hasOwnProperty.call(it, key);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("2f", ["32"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = !req('32')(function() {
    return Object.defineProperty({}, 'a', {get: function() {
        return 7;
      }}).a != 7;
  });
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("38", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = function(bitmap, value) {
    return {
      enumerable: !(bitmap & 1),
      configurable: !(bitmap & 2),
      writable: !(bitmap & 4),
      value: value
    };
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("68", ["28", "38", "2f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $ = req('28'),
      createDesc = req('38');
  module.exports = req('2f') ? function(object, key, value) {
    return $.setDesc(object, key, createDesc(1, value));
  } : function(object, key, value) {
    object[key] = value;
    return object;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("31", ["68"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = req('68');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("39", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = true;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("66", ["39", "30", "31", "68", "2e", "36", "5b", "67", "34", "28"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var LIBRARY = req('39'),
      $def = req('30'),
      $redef = req('31'),
      hide = req('68'),
      has = req('2e'),
      SYMBOL_ITERATOR = req('36')('iterator'),
      Iterators = req('5b'),
      $iterCreate = req('67'),
      setToStringTag = req('34'),
      getProto = req('28').getProto,
      BUGGY = !([].keys && 'next' in [].keys()),
      FF_ITERATOR = '@@iterator',
      KEYS = 'keys',
      VALUES = 'values';
  var returnThis = function() {
    return this;
  };
  module.exports = function(Base, NAME, Constructor, next, DEFAULT, IS_SET, FORCE) {
    $iterCreate(Constructor, NAME, next);
    var getMethod = function(kind) {
      if (!BUGGY && kind in proto)
        return proto[kind];
      switch (kind) {
        case KEYS:
          return function keys() {
            return new Constructor(this, kind);
          };
        case VALUES:
          return function values() {
            return new Constructor(this, kind);
          };
      }
      return function entries() {
        return new Constructor(this, kind);
      };
    };
    var TAG = NAME + ' Iterator',
        proto = Base.prototype,
        _native = proto[SYMBOL_ITERATOR] || proto[FF_ITERATOR] || DEFAULT && proto[DEFAULT],
        _default = _native || getMethod(DEFAULT),
        methods,
        key;
    if (_native) {
      var IteratorPrototype = getProto(_default.call(new Base));
      setToStringTag(IteratorPrototype, TAG, true);
      if (!LIBRARY && has(proto, FF_ITERATOR))
        hide(IteratorPrototype, SYMBOL_ITERATOR, returnThis);
    }
    if ((!LIBRARY || FORCE) && (BUGGY || !(SYMBOL_ITERATOR in proto))) {
      hide(proto, SYMBOL_ITERATOR, _default);
    }
    Iterators[NAME] = _default;
    Iterators[TAG] = returnThis;
    if (DEFAULT) {
      methods = {
        values: DEFAULT == VALUES ? _default : getMethod(VALUES),
        keys: IS_SET ? _default : getMethod(KEYS),
        entries: DEFAULT != VALUES ? _default : getMethod('entries')
      };
      if (FORCE)
        for (key in methods) {
          if (!(key in proto))
            $redef(proto, key, methods[key]);
        }
      else
        $def($def.P + $def.F * BUGGY, NAME, methods);
    }
    return methods;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("5d", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var ceil = Math.ceil,
      floor = Math.floor;
  module.exports = function(it) {
    return isNaN(it = +it) ? 0 : (it > 0 ? floor : ceil)(it);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("69", ["5d", "6a"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var toInteger = req('5d'),
      defined = req('6a');
  module.exports = function(TO_STRING) {
    return function(that, pos) {
      var s = String(defined(that)),
          i = toInteger(pos),
          l = s.length,
          a,
          b;
      if (i < 0 || i >= l)
        return TO_STRING ? '' : undefined;
      a = s.charCodeAt(i);
      return a < 0xd800 || a > 0xdbff || i + 1 === l || (b = s.charCodeAt(i + 1)) < 0xdc00 || b > 0xdfff ? TO_STRING ? s.charAt(i) : a : TO_STRING ? s.slice(i, i + 2) : (a - 0xd800 << 10) + (b - 0xdc00) + 0x10000;
    };
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("49", ["69", "66"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var $at = req('69')(true);
  req('66')(String, 'String', function(iterated) {
    this._t = String(iterated);
    this._i = 0;
  }, function() {
    var O = this._t,
        index = this._i,
        point;
    if (index >= O.length)
      return {
        value: undefined,
        done: true
      };
    point = $at(O, index);
    this._i += point.length;
    return {
      value: point,
      done: false
    };
  });
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("3b", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  "format cjs";
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("6b", ["3b", "49", "48", "62", "6"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  req('3b');
  req('49');
  req('48');
  req('62');
  module.exports = req('6').Promise;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("20", ["6b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {
    "default": req('6b'),
    __esModule: true
  };
  global.define = __define;
  return module.exports;
});

$__System.register('17', ['14', '15', '16', '20', '44', 'd', 'e'], function (_export) {
    var _getIterator, _Object$keys, AudioModule, _Promise, TAFFY, _createClass, _classCallCheck, units;

    /**
     * @method taffyFactory
     * @for audio.util
     * @param {String} path_to_json - path to json file, probably generated by rudytool,
     *                                that provides annotations for an audio file.
     * @return {Promise} - Promise that provides access to Taffy db when request finishes.
     */

    function taffyFactory(path_to_json) {
        return new _Promise(function (resolve, reject) {
            try {
                var req = new XMLHttpRequest();
                req.open("GET", path_to_json, true);
                req.responseType = "json";
                req.onload = function () {
                    var db = TAFFY.taffy(req.response);
                    resolve(db);
                };
                req.send();
            } catch (e) {
                reject(e);
            }
        });
    }

    /** 
     * parseSpriteIntervals is used when adding sprite functionality to modules
     * that play audio files. As input, it takes a string from a .TextGridIntervals
     * file, currently generated with praat, that is a simple text file with a list of
     * start and end times in seconds, formatted like: 
     *
     *      !!This file is automatically generated
     *      {start in seconds}{\s}{end}{\n}
     *      ...
     * 
     * This file should be generated by an external executable; in older versions of the
     * api, this was accomplished with a praat script. 
     *
     * @method parseSpriteIntervals
     * @deprecated Use 'util.taffyFactory' instead!
     * @for audio.util
     * @param {String} spriteIntervals - from .TextGridIntervals file
     * @return {Object} - Enumerated object in the form: 
     *      
     *      {0: {start: {number}, end: {number}},
     *       1: ...
     *
     *      }
     */

    function parseSpriteIntervals(spriteIntervals) {
        var sprites = {};

        function SpriteInterval(start, end) {
            this.start = start;
            this.end = end;
        }

        var arr = spriteIntervals.match(/((\d|\.)+\s)/g);
        for (var i = 0; i < arr.length / 2; i++) {
            sprites[i] = new SpriteInterval(Number(arr[i * 2]), Number(arr[i * 2 + 1]));
        }

        return sprites;
    }

    /**
     * Appends an AudioModule.link function to a AudioNode for easier 
     * incorporation into the scene graph.
     * @method wrapNode
     * @for audio.core
     * @param {AudioNode} node - The AudioNode on which to append a .link function
     * @return {AudioNode} - the node passed into it
     */

    function wrapNode(node) {
        var dummy = new AudioModule();

        node.link = dummy.link.bind(node);
        node.sever = dummy.sever.bind(node);

        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
            for (var _iterator = _getIterator(_Object$keys(dummy)), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                var prop = _step.value;

                node[prop] = dummy[prop];
            }
        } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
        } finally {
            try {
                if (!_iteratorNormalCompletion && _iterator['return']) {
                    _iterator['return']();
                }
            } finally {
                if (_didIteratorError) {
                    throw _iteratorError;
                }
            }
        }

        return node;
    }

    /**
     * Currently contains handy functions for converting between frequency units.
     * @namespace audio.util
     * @class units
     */
    return {
        setters: [function (_2) {
            _getIterator = _2['default'];
        }, function (_3) {
            _Object$keys = _3['default'];
        }, function (_4) {
            AudioModule = _4.AudioModule;
        }, function (_) {
            _Promise = _['default'];
        }, function (_5) {
            TAFFY = _5['default'];
        }, function (_d) {
            _createClass = _d['default'];
        }, function (_e) {
            _classCallCheck = _e['default'];
        }],
        execute: function () {
            /**
             * @module audio.util
             */

            'use strict';

            _export('taffyFactory', taffyFactory);

            _export('parseSpriteIntervals', parseSpriteIntervals);

            _export('wrapNode', wrapNode);

            console.log(TAFFY);
            units = (function () {
                function units() {
                    _classCallCheck(this, units);
                }

                _createClass(units, null, [{
                    key: 'hz2Mel',

                    /**
                     * convert from hz to mels
                     * @method hz2Mel
                     * @param {number} hz - frequency in hz
                     * @return {number} - frequency in mels
                     */
                    value: function hz2Mel(hz) {
                        return 1127 * Math.log(1 + hz / 700);
                    }

                    /**
                     * convert from mel to hz
                     * @method mel2hz
                     * @param {number} mel - frequency in mels
                     * @return {number} - frequency in hz
                     */
                }, {
                    key: 'mel2Hz',
                    value: function mel2Hz(mel) {
                        return 700 * Math.pow(Math.E, mel / 1127) - 1;
                    }

                    /**
                     * From a base frequency in hz, return new hz value detuned by some
                     * number of cents
                     * @method detuneCents
                     * @param {number} basehz - frequency to detune from
                     * @param {number} cents - number of cents to detune by
                     */
                }, {
                    key: 'detuneCents',
                    value: function detuneCents(basehz, cents) {
                        return basehz * Math.pow(2, cents / 1200);
                    }
                }]);

                return units;
            })();

            _export('units', units);
        }
    };
});
$__System.register('1e', ['16', '17', '18'], function (_export) {
    /**
     * Includes functions, usually called in an AudioModule's constructor,
     * that append commonly required methods onto it.
     * @module moduleExtensions
     */

    /**
     * startStopThese proviides .start and .stop functions that, when called,
     * in turn call .start and .stop on any nodes provided to it.
     * @method startStopThese
     * @for moduleExtensions
     * @static
     * @param {Object} scope - the scope on which to append .start and .stop methods
     * @param {Object...} nodes - the nodes on which to call .start and .stop
     */
    'use strict';

    var ctx, audioUtil, TWEEN;

    /**
     * Given two WAAPI GainNodes, appends a function onto the provided scope
     * that, when passed a number from 0 to 100 inclusive, adjusts the gain value
     * of each node, maintaining an inverse linear relationship between the two,
     * facilitating simple crossfades. i.e.: 
     *      
     *      at .crossFade(0), nodeA gain = 100%, nodeB gain = 0%
     *      at .crossFade(50), nodeA gain = 50%, nodeB gain = 50%
     *      at .crossFade(100), nodeA gain = 0%, nodeB gain = 100%
     *
     * The appended function can also accept a time in milliseconds as its second 
     * argument over which to envelope the gain values.
     *
     * @method linearCrossfade
     * @for moduleExtensions
     * @static
     * @param {Object} scope - the scope on which to append a crossfade function
     * @param {GainNode} nodeA - first node to mix
     * @param {GainNode} nodeB - second node to mix
     * @param {String} alias - the name of the crossfade function appended
     *      to the provided scope. Defaults to "crossfade".
     */

    _export('startStopThese', startStopThese);

    /**
     * Given an AudioParam, appends a function onto the provided scope that
     * can set/envelope the value of that AudioParam.
     * @method setValue
     * @for moduleExtensions
     * @static
     * @param {Object} scope - the object on which to append the setValue function 
     * @param {AudioParam} audioParam - the audioParam to adjust
     * @param {String} alias - the name of the setValue function appended
     *      onto the provided scope. Defaults to "setValue".
     * @param {boolean} irregular - if truthy, instead of using WAAPI
     *      .linearRampToValueAtTime, will use a TWEEN.Tween with random 
     *      interpolation and easing functons.
     */

    _export('linearCrossfade', linearCrossfade);

    _export('setValue', setValue);

    function startStopThese(scope, nodes) {
        var n, idx;
        if (Array.isArray(nodes)) {
            n = nodes;
            idx = 0;
        } else {
            n = arguments;
            idx = 1;
        }

        scope.start = function () {
            for (var i = idx; i < n.length; i++) {
                n[i].start(0, 0);
            }
        };
        scope.stop = function () {
            for (var i = idx; i < n.length; i++) {
                n[i].stop();
            }
        };
    }

    function linearCrossfade(scope, nodeA, nodeB, alias) {
        var name = alias ? alias : 'crossfade';
        scope[name] = function (percent_nodeB, time) {
            var w = percent_nodeB / 100,
                d = 1 - w,
                t = ctx.currentTime + (time ? time / 1000 : 0);

            nodeA.gain.linearRampToValueAtTime(d, t);
            nodeB.gain.linearRampToValueAtTime(w, t);
        };
    }

    function setValue(scope, audioParam, alias, irregular) {
        var name = alias ? alias : "setValue";
        if (!irregular) {
            scope[name] = function (val, time) {
                var t = time ? time : 0;
                audioParam.linearRampToValueAtTime(val, t);
                // TODO: include non-irregular tweening
                // for use with arbitrary values.
            };
        } else {
                (function () {
                    // TODO: is constructing a TWEEN.Tween here causing that
                    // <= 2 weirdness with util.tween.stopTweens?
                    var params = { value: audioParam.value },
                        gliss = new TWEEN.Tween(params);
                    var updateValue = function updateValue() {
                        audioParam.value = params.value;
                    };

                    var glissing = false;

                    scope[name] = function (val, time) {
                        if (time > 0) {
                            if (!glissing) {
                                glissing = true;
                                gliss.to({ value: val }, time).easing(audioUtil.tween.getRandomEasingFn()).interpolation(audioUtil.tween.getRandomInterpolationFn()).onUpdate(updateValue).onComplete(function () {
                                    glissing = false;
                                    audioUtil.tween.stopTweens();
                                }).start();
                                audioUtil.tween.startTweens();
                            } else {
                                gliss.stop();
                                gliss.to({ value: val }, time).easing(audioUtil.tween.getRandomEasingFn()).interpolation(audioUtil.tween.getRandomInterpolationFn()).start();
                            }
                        } else {
                            audioParam.value = val;
                        }
                    };
                })();
            }
    }

    return {
        setters: [function (_) {
            ctx = _.ctx;
        }, function (_3) {
            audioUtil = _3;
        }, function (_2) {
            TWEEN = _2['default'];
        }],
        execute: function () {}
    };
});
$__System.register('16', ['d', 'e'], function (_export) {
    var _createClass, _classCallCheck, ctx, out, AudioModule;

    return {
        setters: [function (_d) {
            _createClass = _d['default'];
        }, function (_e) {
            _classCallCheck = _e['default'];
        }],
        execute: function () {
            /**
             * Defines core functionality for audio components
             * @module audio.core 
             */

            /**
             * The shared AudioContext
             * @property {AudioContext} ctx
             * @for audio.core
             */
            'use strict';

            ctx = new (window.AudioContext || window.webkitAudioContext)();

            _export('ctx', ctx);

            /**
             * Gain node that serves as an endpoint for the audio scene graph; this 
             * facilitates the easy adjustment of global amplitude, e.g., for a mute button.
             * @property {GainNode} out
             */
            out = ctx.createGain();

            _export('out', out);

            out.gain.value = 1;
            out.connect(ctx.destination);

            /**
             * AudioModule is the core class from which all audio-making components
             * incorporated into the scene graph should inherit from. To create an Audiomodule,
             * you would extend this class, and somewhere in the constructor, override
             * _link_alias_in with the input(s) of the internal signal chain of the module, and
             * _link_alias_out with the output(s). These properties can be overriden with other
             * AudioModules, or native Web Audio API AudioNodes. Additionally, AudioModule
             * can be used as a mixin on native WAAPI AudioNodes.
             * (see: {{#crossLink "audio.core:wrapNode"}}{{/crossLink}})
             *
             * @namespace audio.core
             * @class AudioModule
             * @constructor
             */

            AudioModule = (function () {
                function AudioModule() {
                    _classCallCheck(this, AudioModule);

                    /**
                     * Override with input(s) of module's internal signal chain
                     * @property {AudioModule | AudioNode | Object[]} _link_alias_in
                     * @default null
                     */
                    this._link_alias_in = null;

                    /**
                     * Override with output(s) of module's internal signal chain
                     * @property {AudioModule | AudioNode | Object[]} _link_alias_out
                     * @default null
                     */
                    this._link_alias_out = null;
                }

                /**
                 * Link connects any two objects that inhherit from AudioModule
                 * @method link
                 * @param {AudioModule | AudioNode} target - module to connect to
                 * @param {number} output - optional unless this._link_alias_out is an array,
                 *      in which case output is the index within the array of the output
                 *      module/node to link
                 * @param {number} input - optional unless the _link_alias_in of the target
                 *      is an array, in which case input is the index within that array of
                 *      the input module/node to link to
                 * @return {AudioModule | AudioNode} - the 'target' module
                 * @chainable
                 */

                _createClass(AudioModule, [{
                    key: 'link',
                    value: function link(target, output, input) {

                        var checkLink = function checkLink(isOut, address, alias) {
                            var location = isOut ? 'output' : 'input';

                            var throwLinkError = function throwLinkError(text) {
                                throw new Error("Invalid link parameters: " + text);
                            };

                            if (typeof address !== 'number') {
                                if (typeof address !== 'number') {
                                    throwLinkError("If an AudioModule has multiple " + location + " aliases, the " + location + " must be explicitly addressed.");
                                } else if (typeof alias[address] === 'undefined') {
                                    throwLinkError("undefined " + location + " alias.");
                                }
                            }
                        };

                        var out_addr = output,
                            in_addr = input;

                        if (typeof target !== 'undefined' || arguments[3]) {
                            var out_node = this._link_alias_out ? this._link_alias_out : this,
                                in_node = arguments[3] ? null : target._link_alias_in ? target._link_alias_in : target;

                            // parse array
                            if (Array.isArray(out_node)) {
                                checkLink(true, output, out_node);
                                out_node = out_node[output];
                                out_addr = 0;
                            }
                            if (Array.isArray(in_node)) {
                                checkLink(false, input, in_node);
                                in_node = in_node[input];
                                in_addr = 0;
                            }

                            if (arguments[3]) {
                                if (!out_node.disconnect) {
                                    out_node.link(null, null, null, true);
                                } else {
                                    out_node.disconnect();
                                }
                            } else if (!in_node.connect) {
                                out_node.link(in_node._link_alias_in, out_addr, in_addr);
                            } else if (!out_node.connect) {
                                // need to look one loop ahead to make sure .link exists.
                                // is not, call connect
                                if (out_node._link_alias_out.link) out_node._link_alias_out.link(in_node, out_addr, in_addr);else out_node._link_alias_out.connect(in_node, out_addr, in_addr);
                            } else {
                                out_node.connect(in_node, out_addr, in_addr);
                            }

                            return target;
                        } else {
                            throwLinkException("Input node is not defined");
                        }
                    }

                    /**
                     * Disconnect this AudioModule from whatever it is linked to.
                     *
                     * TODO: incorporate addressing as in .link
                     *
                     * @method sever
                     */
                }, {
                    key: 'sever',
                    value: function sever() {
                        this.link(null, null, null, true);
                    }
                }]);

                return AudioModule;
            })();

            _export('AudioModule', AudioModule);
        }
    };
});
$__System.register("6c", ["d", "e", "6d"], function (_export) {
    var _createClass, _classCallCheck, renderLoop, Effect;

    /**
     * Does what is says on the label.
     * @module visualCore
     */

    /**
     * Creates a WebGL context, compiles shaders.
     * @method webGlSetup
     * @for visualCore
     * @param {canvas} canvas
     * @param {string} shaders
     *      both vertex and fragment, annotated and formatted like
     *
     *          "@@ {optional label}{\n}
     *          "{body of vertex shader}
     *          "END
     *          "@@ {optional label}{\n}
     *          "{body of fragment shader}
     *          "END
     * @param {boolean} includeFullscreenVertices - 
     *      Facilitates viewport-filling, fragment-shader driven
     *      effects. Setting this truthy will make the vertices
     *
     *                  -1.0, -1.0,
     *                   1.0, -1.0,
     *                  -1.0,  1.0,
     *                  -1.0,  1.0,
     *                   1.0, -1.0,
     *                   1.0,  1.0
     *
     *      available under the attribute 'a_position'
     *      in your shader.
     * @param {boolean} DEBUG - if set to true, will print shader and program logs
     *      to the console if something goes wrong during the compilation and linking
     *      of privided shaders.
     * @return {Object} In the form: {gl: the context, program: the shader program}
     */

    function webglSetup(canvas, shaders, includeFullscreenVertices, DEBUG) {
        var r = {};

        var showShaderLog = function showShaderLog(glShader) {
            if (!gl.getShaderParameter(glShader, gl.COMPILE_STATUS)) console.log(gl.getShaderInfoLog(glShader));
        };
        var showProgramLog = function showProgramLog(glProgram) {
            if (!gl.getProgramParameter(glProgram, gl.LINK_STATUS)) console.log(gl.getProgramInfoLog(glProgram));
        };

        var gl = (function () {
            try {
                return canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
            } catch (err) {
                // good place to put fallback trigg
                return false;
            }
        })();

        if (gl) {

            gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
            gl.clearColor(0.0, 0.0, 0.0, 0.0);

            window.addEventListener("resize", function () {
                gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
            });

            // parse shader text
            var matches = shaders.match(/\n(\d|[a-zA-Z])(\s|.)*?(?=END|^@@.*?$)/gm),
                vert_src = matches[0],
                frag_src = matches[1],
                vert_shader = gl.createShader(gl.VERTEX_SHADER),
                frag_shader = gl.createShader(gl.FRAGMENT_SHADER);

            gl.shaderSource(vert_shader, vert_src);
            gl.shaderSource(frag_shader, frag_src);
            gl.compileShader(vert_shader);

            if (DEBUG) showShaderLog(vert_shader);

            gl.compileShader(frag_shader);

            if (DEBUG) getShaderLog(frag_shader);

            var prgm = gl.createProgram();
            gl.attachShader(prgm, vert_shader);
            gl.attachShader(prgm, frag_shader);
            gl.linkProgram(prgm);

            if (DEBUG) getProgramLog(prgm);

            gl.useProgram(prgm);

            r.program = prgm;

            if (includeFullscreenVertices) {
                var buffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]), gl.STATIC_DRAW);

                var a_position = gl.getAttribLocation(prgm, 'a_position');
                gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(a_position);

                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            }

            r.gl = gl;
            return r;
        }
    }

    /**
     * A handy class to define (usually animated) visual happenings
     * When extending this class, implementations should override predefined 
     * properties so they can be called by this.operate
     * @namespace visualCore
     * @class Effect
     * @constructor
     */
    return {
        setters: [function (_d) {
            _createClass = _d["default"];
        }, function (_e) {
            _classCallCheck = _e["default"];
        }, function (_d2) {
            renderLoop = _d2;
        }],
        execute: function () {
            "use strict";

            _export("webglSetup", webglSetup);

            Effect = (function () {
                function Effect() {
                    _classCallCheck(this, Effect);

                    /**
                     * @property {function} preInit 
                     * @default null
                     */
                    this.preInit = null;

                    /**
                     * @property {function} init
                     * @default null
                     */
                    this.init = null;

                    /**
                     * @property {function} animate 
                     * @default null
                     */
                    this.animate = null;

                    /**
                     * @property {function} preTeardown
                     * @default null
                     */
                    this.preTeardown = null;

                    /**
                     * @property {function} teardown
                     * @default null
                     */
                    this.teardown = null;
                }

                /**
                 *   Coordinates the initialization or teardown of this effect
                 *   @method operate 
                 *      @param {boolean} stage
                 *          If true, executes the initialization sequence, calling preInit, init, 
                 *          and then pushing animate into the renderLoop. If false, executes the 
                 *          teardown sequence, calling preTeardown, removing animate from the
                 *          renderloop, and then calling teardown.
                 *
                 *      @param {Object[]} hookObjArr
                 *          Provided an array of objects in the form {address: {number}, fn: {function}},
                 *          will call any functions provided before each stage function depending on its address, 
                 *          e.g.:
                 *
                 *              fn address 0 ()
                 *              preInit()
                 *              fn address 1 ()
                 *              init()
                 *              fn address 2 ()
                 *              push animate to the renderloop
                 *              fn address 3 () 
                 */

                _createClass(Effect, [{
                    key: "operate",
                    value: function operate(stage, hookObjArr) {
                        var ops = [],
                            hooks = [],
                            r_op = undefined;

                        if (Array.isArray(hookObjArr)) {
                            hookObjArr.forEach(function (hookObj) {
                                if (hookObj.address <= 3) {
                                    hooks[hookObj.address] = hookObj.fn;
                                } else {
                                    throw "Invalid Effect.operate hook param: " + "hook address must be less than or equal to 3";
                                }
                            });
                        }

                        if (stage) {
                            ops = ['preInit', 'init', 'animate'];
                            r_op = 'add';
                        } else {
                            ops = ['preTeardown', 'animate', 'teardown'];
                            r_op = 'remove';
                        }

                        for (var i = 0; i < 4; i++) {
                            if (typeof hooks[i] === 'function') hooks[i]();

                            var fn_name = ops[i];

                            if (this[fn_name]) {
                                if (fn_name === 'animate') renderLoop[r_op](this[fn_name]);else this[fnName]();
                            }
                        }
                    }
                }]);

                return Effect;
            })();

            _export("Effect", Effect);
        }
    };
});
$__System.registerDynamic("18", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  void 0 === Date.now && (Date.now = function() {
    return (new Date).valueOf();
  });
  var TWEEN = TWEEN || function() {
    var n = [];
    return {
      REVISION: "14",
      getAll: function() {
        return n;
      },
      removeAll: function() {
        n = [];
      },
      add: function(t) {
        n.push(t);
      },
      remove: function(t) {
        var r = n.indexOf(t);
        -1 !== r && n.splice(r, 1);
      },
      update: function(t) {
        if (0 === n.length)
          return !1;
        var r = 0;
        for (t = void 0 !== t ? t : "undefined" != typeof window && void 0 !== window.performance && void 0 !== window.performance.now ? window.performance.now() : Date.now(); r < n.length; )
          n[r].update(t) ? r++ : n.splice(r, 1);
        return !0;
      }
    };
  }();
  TWEEN.Tween = function(n) {
    var t = n,
        r = {},
        i = {},
        u = {},
        o = 1e3,
        e = 0,
        a = !1,
        f = !1,
        c = !1,
        s = 0,
        h = null,
        l = TWEEN.Easing.Linear.None,
        p = TWEEN.Interpolation.Linear,
        E = [],
        d = null,
        v = !1,
        I = null,
        w = null,
        M = null;
    for (var O in n)
      r[O] = parseFloat(n[O], 10);
    this.to = function(n, t) {
      return void 0 !== t && (o = t), i = n, this;
    }, this.start = function(n) {
      TWEEN.add(this), f = !0, v = !1, h = void 0 !== n ? n : "undefined" != typeof window && void 0 !== window.performance && void 0 !== window.performance.now ? window.performance.now() : Date.now(), h += s;
      for (var o in i) {
        if (i[o] instanceof Array) {
          if (0 === i[o].length)
            continue;
          i[o] = [t[o]].concat(i[o]);
        }
        r[o] = t[o], r[o] instanceof Array == !1 && (r[o] *= 1), u[o] = r[o] || 0;
      }
      return this;
    }, this.stop = function() {
      return f ? (TWEEN.remove(this), f = !1, null !== M && M.call(t), this.stopChainedTweens(), this) : this;
    }, this.stopChainedTweens = function() {
      for (var n = 0,
          t = E.length; t > n; n++)
        E[n].stop();
    }, this.delay = function(n) {
      return s = n, this;
    }, this.repeat = function(n) {
      return e = n, this;
    }, this.yoyo = function(n) {
      return a = n, this;
    }, this.easing = function(n) {
      return l = n, this;
    }, this.interpolation = function(n) {
      return p = n, this;
    }, this.chain = function() {
      return E = arguments, this;
    }, this.onStart = function(n) {
      return d = n, this;
    }, this.onUpdate = function(n) {
      return I = n, this;
    }, this.onComplete = function(n) {
      return w = n, this;
    }, this.onStop = function(n) {
      return M = n, this;
    }, this.update = function(n) {
      var f;
      if (h > n)
        return !0;
      v === !1 && (null !== d && d.call(t), v = !0);
      var M = (n - h) / o;
      M = M > 1 ? 1 : M;
      var O = l(M);
      for (f in i) {
        var m = r[f] || 0,
            N = i[f];
        N instanceof Array ? t[f] = p(N, O) : ("string" == typeof N && (N = m + parseFloat(N, 10)), "number" == typeof N && (t[f] = m + (N - m) * O));
      }
      if (null !== I && I.call(t, O), 1 == M) {
        if (e > 0) {
          isFinite(e) && e--;
          for (f in u) {
            if ("string" == typeof i[f] && (u[f] = u[f] + parseFloat(i[f], 10)), a) {
              var T = u[f];
              u[f] = i[f], i[f] = T;
            }
            r[f] = u[f];
          }
          return a && (c = !c), h = n + s, !0;
        }
        null !== w && w.call(t);
        for (var g = 0,
            W = E.length; W > g; g++)
          E[g].start(n);
        return !1;
      }
      return !0;
    };
  }, TWEEN.Easing = {
    Linear: {None: function(n) {
        return n;
      }},
    Quadratic: {
      In: function(n) {
        return n * n;
      },
      Out: function(n) {
        return n * (2 - n);
      },
      InOut: function(n) {
        return (n *= 2) < 1 ? .5 * n * n : -.5 * (--n * (n - 2) - 1);
      }
    },
    Cubic: {
      In: function(n) {
        return n * n * n;
      },
      Out: function(n) {
        return --n * n * n + 1;
      },
      InOut: function(n) {
        return (n *= 2) < 1 ? .5 * n * n * n : .5 * ((n -= 2) * n * n + 2);
      }
    },
    Quartic: {
      In: function(n) {
        return n * n * n * n;
      },
      Out: function(n) {
        return 1 - --n * n * n * n;
      },
      InOut: function(n) {
        return (n *= 2) < 1 ? .5 * n * n * n * n : -.5 * ((n -= 2) * n * n * n - 2);
      }
    },
    Quintic: {
      In: function(n) {
        return n * n * n * n * n;
      },
      Out: function(n) {
        return --n * n * n * n * n + 1;
      },
      InOut: function(n) {
        return (n *= 2) < 1 ? .5 * n * n * n * n * n : .5 * ((n -= 2) * n * n * n * n + 2);
      }
    },
    Sinusoidal: {
      In: function(n) {
        return 1 - Math.cos(n * Math.PI / 2);
      },
      Out: function(n) {
        return Math.sin(n * Math.PI / 2);
      },
      InOut: function(n) {
        return .5 * (1 - Math.cos(Math.PI * n));
      }
    },
    Exponential: {
      In: function(n) {
        return 0 === n ? 0 : Math.pow(1024, n - 1);
      },
      Out: function(n) {
        return 1 === n ? 1 : 1 - Math.pow(2, -10 * n);
      },
      InOut: function(n) {
        return 0 === n ? 0 : 1 === n ? 1 : (n *= 2) < 1 ? .5 * Math.pow(1024, n - 1) : .5 * (-Math.pow(2, -10 * (n - 1)) + 2);
      }
    },
    Circular: {
      In: function(n) {
        return 1 - Math.sqrt(1 - n * n);
      },
      Out: function(n) {
        return Math.sqrt(1 - --n * n);
      },
      InOut: function(n) {
        return (n *= 2) < 1 ? -.5 * (Math.sqrt(1 - n * n) - 1) : .5 * (Math.sqrt(1 - (n -= 2) * n) + 1);
      }
    },
    Elastic: {
      In: function(n) {
        var t,
            r = .1,
            i = .4;
        return 0 === n ? 0 : 1 === n ? 1 : (!r || 1 > r ? (r = 1, t = i / 4) : t = i * Math.asin(1 / r) / (2 * Math.PI), -(r * Math.pow(2, 10 * (n -= 1)) * Math.sin(2 * (n - t) * Math.PI / i)));
      },
      Out: function(n) {
        var t,
            r = .1,
            i = .4;
        return 0 === n ? 0 : 1 === n ? 1 : (!r || 1 > r ? (r = 1, t = i / 4) : t = i * Math.asin(1 / r) / (2 * Math.PI), r * Math.pow(2, -10 * n) * Math.sin(2 * (n - t) * Math.PI / i) + 1);
      },
      InOut: function(n) {
        var t,
            r = .1,
            i = .4;
        return 0 === n ? 0 : 1 === n ? 1 : (!r || 1 > r ? (r = 1, t = i / 4) : t = i * Math.asin(1 / r) / (2 * Math.PI), (n *= 2) < 1 ? -.5 * r * Math.pow(2, 10 * (n -= 1)) * Math.sin(2 * (n - t) * Math.PI / i) : r * Math.pow(2, -10 * (n -= 1)) * Math.sin(2 * (n - t) * Math.PI / i) * .5 + 1);
      }
    },
    Back: {
      In: function(n) {
        var t = 1.70158;
        return n * n * ((t + 1) * n - t);
      },
      Out: function(n) {
        var t = 1.70158;
        return --n * n * ((t + 1) * n + t) + 1;
      },
      InOut: function(n) {
        var t = 2.5949095;
        return (n *= 2) < 1 ? .5 * n * n * ((t + 1) * n - t) : .5 * ((n -= 2) * n * ((t + 1) * n + t) + 2);
      }
    },
    Bounce: {
      In: function(n) {
        return 1 - TWEEN.Easing.Bounce.Out(1 - n);
      },
      Out: function(n) {
        return 1 / 2.75 > n ? 7.5625 * n * n : 2 / 2.75 > n ? 7.5625 * (n -= 1.5 / 2.75) * n + .75 : 2.5 / 2.75 > n ? 7.5625 * (n -= 2.25 / 2.75) * n + .9375 : 7.5625 * (n -= 2.625 / 2.75) * n + .984375;
      },
      InOut: function(n) {
        return .5 > n ? .5 * TWEEN.Easing.Bounce.In(2 * n) : .5 * TWEEN.Easing.Bounce.Out(2 * n - 1) + .5;
      }
    }
  }, TWEEN.Interpolation = {
    Linear: function(n, t) {
      var r = n.length - 1,
          i = r * t,
          u = Math.floor(i),
          o = TWEEN.Interpolation.Utils.Linear;
      return 0 > t ? o(n[0], n[1], i) : t > 1 ? o(n[r], n[r - 1], r - i) : o(n[u], n[u + 1 > r ? r : u + 1], i - u);
    },
    Bezier: function(n, t) {
      var r,
          i = 0,
          u = n.length - 1,
          o = Math.pow,
          e = TWEEN.Interpolation.Utils.Bernstein;
      for (r = 0; u >= r; r++)
        i += o(1 - t, u - r) * o(t, r) * n[r] * e(u, r);
      return i;
    },
    CatmullRom: function(n, t) {
      var r = n.length - 1,
          i = r * t,
          u = Math.floor(i),
          o = TWEEN.Interpolation.Utils.CatmullRom;
      return n[0] === n[r] ? (0 > t && (u = Math.floor(i = r * (1 + t))), o(n[(u - 1 + r) % r], n[u], n[(u + 1) % r], n[(u + 2) % r], i - u)) : 0 > t ? n[0] - (o(n[0], n[0], n[1], n[1], -i) - n[0]) : t > 1 ? n[r] - (o(n[r], n[r], n[r - 1], n[r - 1], i - r) - n[r]) : o(n[u ? u - 1 : 0], n[u], n[u + 1 > r ? r : u + 1], n[u + 2 > r ? r : u + 2], i - u);
    },
    Utils: {
      Linear: function(n, t, r) {
        return (t - n) * r + n;
      },
      Bernstein: function(n, t) {
        var r = TWEEN.Interpolation.Utils.Factorial;
        return r(n) / r(t) / r(n - t);
      },
      Factorial: function() {
        var n = [1];
        return function(t) {
          var r,
              i = 1;
          if (n[t])
            return n[t];
          for (r = t; r > 1; r--)
            i *= r;
          return n[t] = i;
        };
      }(),
      CatmullRom: function(n, t, r, i, u) {
        var o = .5 * (r - n),
            e = .5 * (i - t),
            a = u * u,
            f = u * a;
        return (2 * t - 2 * r + o + e) * f + (-3 * t + 3 * r - 2 * o - e) * a + o * u + t;
      }
    }
  }, "undefined" != typeof module && module.exports && (module.exports = TWEEN);
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("6e", ["6a"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var defined = req('6a');
  module.exports = function(it) {
    return Object(defined(it));
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("6f", ["6e", "4"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var toObject = req('6e');
  req('4')('keys', function($keys) {
    return function keys(it) {
      return $keys(toObject(it));
    };
  });
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("70", ["6f", "6"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  req('6f');
  module.exports = req('6').Object.keys;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("15", ["70"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {
    "default": req('70'),
    __esModule: true
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("32", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = function(exec) {
    try {
      return !!exec();
    } catch (e) {
      return true;
    }
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("6", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var core = module.exports = {version: '1.2.5'};
  if (typeof __e == 'number')
    __e = core;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("2d", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var global = module.exports = typeof window != 'undefined' && window.Math == Math ? window : typeof self != 'undefined' && self.Math == Math ? self : Function('return this')();
  if (typeof __g == 'number')
    __g = global;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("30", ["2d", "6"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var global = req('2d'),
      core = req('6'),
      PROTOTYPE = 'prototype';
  var ctx = function(fn, that) {
    return function() {
      return fn.apply(that, arguments);
    };
  };
  var $def = function(type, name, source) {
    var key,
        own,
        out,
        exp,
        isGlobal = type & $def.G,
        isProto = type & $def.P,
        target = isGlobal ? global : type & $def.S ? global[name] : (global[name] || {})[PROTOTYPE],
        exports = isGlobal ? core : core[name] || (core[name] = {});
    if (isGlobal)
      source = name;
    for (key in source) {
      own = !(type & $def.F) && target && key in target;
      if (own && key in exports)
        continue;
      out = own ? target[key] : source[key];
      if (isGlobal && typeof target[key] != 'function')
        exp = source[key];
      else if (type & $def.B && own)
        exp = ctx(out, global);
      else if (type & $def.W && target[key] == out)
        !function(C) {
          exp = function(param) {
            return this instanceof C ? new C(param) : C(param);
          };
          exp[PROTOTYPE] = C[PROTOTYPE];
        }(out);
      else
        exp = isProto && typeof out == 'function' ? ctx(Function.call, out) : out;
      exports[key] = exp;
      if (isProto)
        (exports[PROTOTYPE] || (exports[PROTOTYPE] = {}))[key] = out;
    }
  };
  $def.F = 1;
  $def.G = 2;
  $def.S = 4;
  $def.P = 8;
  $def.B = 16;
  $def.W = 32;
  module.exports = $def;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("4", ["30", "6", "32"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $def = req('30'),
      core = req('6'),
      fails = req('32');
  module.exports = function(KEY, exec) {
    var $def = req('30'),
        fn = (core.Object || {})[KEY] || Object[KEY],
        exp = {};
    exp[KEY] = exec(fn);
    $def($def.S + $def.F * fails(function() {
      fn(1);
    }), 'Object', exp);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("6a", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = function(it) {
    if (it == undefined)
      throw TypeError("Can't call method on  " + it);
    return it;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("26", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var toString = {}.toString;
  module.exports = function(it) {
    return toString.call(it).slice(8, -1);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("71", ["26"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var cof = req('26');
  module.exports = Object('z').propertyIsEnumerable(0) ? Object : function(it) {
    return cof(it) == 'String' ? it.split('') : Object(it);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("2a", ["71", "6a"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var IObject = req('71'),
      defined = req('6a');
  module.exports = function(it) {
    return IObject(defined(it));
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("72", ["2a", "4"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var toIObject = req('2a');
  req('4')('getOwnPropertyDescriptor', function($getOwnPropertyDescriptor) {
    return function getOwnPropertyDescriptor(it, key) {
      return $getOwnPropertyDescriptor(toIObject(it), key);
    };
  });
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("73", ["28", "72"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $ = req('28');
  req('72');
  module.exports = function getOwnPropertyDescriptor(it, key) {
    return $.getDesc(it, key);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("10", ["73"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {
    "default": req('73'),
    __esModule: true
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("e", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  "use strict";
  exports["default"] = function(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  };
  exports.__esModule = true;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("28", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $Object = Object;
  module.exports = {
    create: $Object.create,
    getProto: $Object.getPrototypeOf,
    isEnum: {}.propertyIsEnumerable,
    getDesc: $Object.getOwnPropertyDescriptor,
    setDesc: $Object.defineProperty,
    setDescs: $Object.defineProperties,
    getKeys: $Object.keys,
    getNames: $Object.getOwnPropertyNames,
    getSymbols: $Object.getOwnPropertySymbols,
    each: [].forEach
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("74", ["28"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $ = req('28');
  module.exports = function defineProperty(it, key, desc) {
    return $.setDesc(it, key, desc);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("75", ["74"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {
    "default": req('74'),
    __esModule: true
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("d", ["75"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  "use strict";
  var _Object$defineProperty = req('75')["default"];
  exports["default"] = (function() {
    function defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor)
          descriptor.writable = true;
        _Object$defineProperty(target, descriptor.key, descriptor);
      }
    }
    return function(Constructor, protoProps, staticProps) {
      if (protoProps)
        defineProperties(Constructor.prototype, protoProps);
      if (staticProps)
        defineProperties(Constructor, staticProps);
      return Constructor;
    };
  })();
  exports.__esModule = true;
  global.define = __define;
  return module.exports;
});

$__System.register('a', ['10', '15', '18', '75', 'd', 'e', '6d'], function (_export) {
    var _Object$getOwnPropertyDescriptor, _Object$keys, TWEEN, _Object$defineProperty, _createClass, _classCallCheck, renderLoop, time, easing_keys, interpolation_keys, tween;

    /**
     * .call on an object to define a static 'length' prop
     * TODO: make dynamic.
     * @method objectLength
     * @for util
     * @static
     */

    function objectLength() {
        var len = 0;
        for (var p in this) {
            if (this.hasOwnProperty(p)) len++;
        }
        Object.defineProperty(this, "length", {
            value: len,
            writable: false,
            enumerable: false
        });
    }

    /**
     * A crude Object.watch that works with objects with configurable
     * properties with defined assessors. 
     * @method watchProperty
     * @for util
     * @static
     * @param {Object} obj - the object that contains the properties to watch
     * @param {String | String[]} props - the name or names of the properties to watch
     * @param {function} callback - function to execute when properties setter is invoked
     */

    function watchProperty(obj, props, callback) {
        var p = [];

        if (Array.isArray(props)) p = props;else p.push(props);

        p.forEach(function wrap(val, idx, arr, over) {
            var targ = over ? over : obj,
                descriptor = _Object$getOwnPropertyDescriptor(targ, val),
                newProp = { configurable: true };

            if (descriptor) {
                (function () {
                    if ("get" in descriptor) newProp.get = descriptor.get;

                    var set = descriptor.set.bind(obj);
                    newProp.set = function (val) {
                        set(val);
                        callback(val);
                    };

                    _Object$defineProperty(obj, val, newProp);
                })();
            } else if (typeof Object.getPrototypeOf(targ) === 'object') {
                // this is bad.
                wrap(val, null, null, Object.getPrototypeOf(targ));
            } else {
                //failed!
                throw new Error("util.watchProperty error! Property name " + v + " not found in prototype chain!");
            }
        });
    }

    /**
     * Given an object, returns a new enumerated object where
     * all of the keys are replaced with the output of an incrementing 
     * counter, 0-indexed.
     * @method enumerate
     * @for util
     * @static
     * @param {Object} obj - the object to enumerate
     * @return {Object} - the enumerated object
     */

    function enumerate(obj) {
        var r = {},
            i = 0;

        for (var prop in obj) {
            if (obj.hasOwnProperty(prop)) r[i++] = obj[prop];
        }

        return r;
    }

    /**
     * Given two 32-bit integers, determines if y's bits exist in x.
     * @method hasBit
     * @for util
     * @static
     * @param {Integer} x - the set of bits to search
     * @param {Integer} y - the bits to search for
     * @return {boolean} 
     */

    function hasBit(x, y) {
        return (x & y) === y;
    }

    /**
     * Given a number n, return a new random number
     * within a range n +/- percentage f
     * @method smudgeNumber
     * @for util
     * @static
     * @param {number} n - base number to smudge
     * @param {number} f - percentage (0 - 100) to smudge by
     * @return {number}
     */

    function smudgeNumber(n, f) {
        var s = n * f * 0.01;
        if (Math.random() < 0.05) s *= -1;
        return Math.random() * s + n;
    }

    /**
     * Picks a random item from an array or object.
     * @method getRndItem
     * @for util
     * @static
     * @param {Array | Object} set - the set to choose from
     * @return {Any} - random item from set
     */

    function getRndItem(set) {
        if (Array.isArray(set)) {
            var idx = Math.random() * set.length | 0;
            return set[idx];
        } else {
            var keys = _Object$keys(set);
            return set[getRndItem(keys)];
        }
    }

    /**
     * Pops, in blocks, items out of an array until it is empty. N.B:
     * this optimization is only worth it when working with very large arrays
     * approaching 100,000 items in size. For most situations, simply 
     * creating a new array is sufficient.
     * @method emptyArray
     * @for util
     * @static
     * @param {Array} r - the array to empty
     */

    function emptyArray(r) {
        while (r.length > 0) {
            r.pop();r.pop();r.pop();r.pop();r.pop();r.pop();r.pop();
            r.pop();r.pop();r.pop();r.pop();r.pop();r.pop();r.pop();
            r.pop();r.pop();r.pop();r.pop();r.pop();r.pop();r.pop();
            r.pop();r.pop();r.pop();r.pop();r.pop();r.pop();r.pop();
            r.pop();r.pop();r.pop();r.pop();r.pop();r.pop();r.pop();
        }
    }

    /**
     * Given an array, returns a new array with the same members, 
     * but with their order randomized.
     * @method shuffleArray
     * @for util
     * @static
     * @param {Array} arr - the array to shuffle
     * @return {Array} - shuffled array
     */

    function shuffleArray(arr) {
        var cp = arr.slice(0),
            r = [];

        while (cp.length > 0) {
            var idx = Math.random() * cp.length | 0;
            r.push(cp[idx]);
            cp.splice(idx, 1);
        }

        return r;
    }

    /**
     * An implementation of java's hashCode from some guy on stack overflow:
     * http://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript-jquery
     * @method hashCode
     * @for util
     * @static
     * @param {String} s - a string to hash
     * @return {number} - 32-bit integer hash
     */

    function hashCode(s) {
        return s.split("").reduce(function (a, b) {
            a = (a << 5) - a + b.charCodeAt(0);
            return a & a;
        }, 0);
    }

    /**
     * Log with variable base
     * @method log
     * @for util
     * @static
     * @param {number} n - exponent
     * @param {number} base - base
     * @return {number}
     */

    function log(n, base) {
        return Math.log(n) / Math.log(base);
    }

    /**
     * Contains functions for converting between differents units of time
     * @namespace util
     * @class time
     */
    return {
        setters: [function (_) {
            _Object$getOwnPropertyDescriptor = _['default'];
        }, function (_3) {
            _Object$keys = _3['default'];
        }, function (_4) {
            TWEEN = _4['default'];
        }, function (_2) {
            _Object$defineProperty = _2['default'];
        }, function (_d) {
            _createClass = _d['default'];
        }, function (_e) {
            _classCallCheck = _e['default'];
        }, function (_d2) {
            renderLoop = _d2;
        }],
        execute: function () {
            /**
             * Some handy functions
             * @module util
             */

            'use strict';

            _export('objectLength', objectLength);

            _export('watchProperty', watchProperty);

            _export('enumerate', enumerate);

            _export('hasBit', hasBit);

            _export('smudgeNumber', smudgeNumber);

            _export('getRndItem', getRndItem);

            _export('emptyArray', emptyArray);

            _export('shuffleArray', shuffleArray);

            _export('hashCode', hashCode);

            _export('log', log);

            time = (function () {
                function time() {
                    _classCallCheck(this, time);
                }

                _createClass(time, null, [{
                    key: 'msec2sec',

                    /**
                     * Convert milliseconds to seconds
                     * @method msec2sec
                     * @static
                     * @param {number} msec
                     * @return {number}
                     */
                    value: function msec2sec(msec) {
                        return msec / 1000;
                    }
                }]);

                return time;
            })();

            _export('time', time);

            easing_keys = _Object$keys(TWEEN.Easing);

            interpolation_keys = function interpolation_keys() {
                var list = _Object$keys(TWEEN.Interpolation),
                    idx = list.indexOf('Utils');
                list.splice(idx, 1);
                return list;
            };

            /**
             * Contains methods hat help manage TWEENs
             * @namespace util
             * @class tween
             */

            tween = (function () {
                function tween() {
                    _classCallCheck(this, tween);
                }

                _createClass(tween, null, [{
                    key: 'startTweens',

                    /**
                     * Start updating tweens. Should be called after constructing 
                     * and configuring a tween.
                     * @method startTweens
                     * @static 
                     */
                    value: function startTweens() {
                        if (!renderLoop.has(TWEEN.update)) renderLoop.add(TWEEN.update);
                    }

                    /**
                     * Stop updating TWEENs. Should be called in the .onComplete
                     * method of every tween.
                     * @method stopTweens
                     * @static
                     */
                }, {
                    key: 'stopTweens',
                    value: function stopTweens() {
                        // look at this
                        if (TWEEN.getAll().length <= 2 && typeof renderLoop.has(TWEEN.update) === 'number') {
                            renderLoop.remove(TWEEN.update);
                        }
                    }

                    /**
                     * Retrieve a random easing function from what is available
                     * in TWEEN.Easing
                     * @method getRandomEasingFn
                     * @static
                     * @return {Object} - TWEEN easing fn
                     */
                }, {
                    key: 'getRandomEasingFn',
                    value: function getRandomEasingFn() {
                        var type = TWEEN.Easing[util.getRndItem(easing_keys)],
                            keys = _Object$keys(type);
                        return type[util.getRndItem(keys)];
                    }

                    /**
                     * Retrieve a random interpolation functiion from what is 
                     * available in TWEEN.interpolaton
                     * @method getRandomInterpolationFn
                     * @static
                     * @return {Object} - TWEEN interpolation fn
                     */
                }, {
                    key: 'getRandomInterpolationFn',
                    value: function getRandomInterpolationFn() {
                        return TWEEN.Interpolation[util.getRndItem(interpolation_keys)];
                    }
                }]);

                return tween;
            })();

            _export('tween', tween);
        }
    };
});
$__System.register('6d', [], function (_export) {
    /**
     * Contains utilities for managing visual-rate updates.
     * renderLoop calls createAnimationFrame to start the loop,
     * and maintains a private queue of functions that is executed
     * on each frame.
     * @module renderLoop
     */

    /**
     * The function queue.
     * @property {array} queue
     * @for renderLoop
     * @private
     * @static
     */
    'use strict';

    var queue, id, rendering;

    /**
     * Stops the render loop by calling cancelAnimationFrame
     * @method stop
     * @for renderLoop
     * @static
     */

    _export('start', start);

    /**
     * Add a function to the rendering queue.
     * @method add
     *@for renderLoop
     * @static
     * @param {function} fn - the function to queue
     */

    _export('stop', stop);

    /**
     * Remove a function from the rendering queue.
     * @method remove
     * @for renderLoop
     * @static
     * @param {function} fn - a reference to the function to remove
     */

    _export('add', add);

    /** 
     * Check whether or not a function is in the queue, or if the queue has any 
     * functions in it. If provided a reference to a function, will return its index 
     * in the queue if it exists, or false if not. If called with no arguments, returns
     * the length of the queue.
     * @method has
     * @for renderLoop
     * @static
     * @param {void | function} fn - optional reference to function
     * @return {number | boolean} - index of function, length of queue, or false.
     */

    _export('remove', remove);

    _export('has', has);

    /**
     * Starts the render loop by calling requestAnimationFrame
     * @method start
     * @for renderLoop
     * @static
     */

    function start() {
        _export('rendering', rendering = true);
        queue.forEach(function (fn) {
            fn();
        });
        id = window.requestAnimationFrame(start);
    }

    function stop() {
        _export('rendering', rendering = false);
        window.cancelAnimationFrame(id);
    }

    function add(fn) {
        queue.push(fn);
        if (!rendering) start();
    }

    function remove(fn) {
        var idx = queue.indexOf(fn);
        if (idx !== -1) queue.splice(idx, 1);
        if (queue.length === 0) stop();
    }

    function has(fn) {
        if (typeof fn === 'function') {
            var idx = queue.indexOf(fn);
            return idx !== -1 ? idx : false;
        } else {
            return queue.length > 0;
        }
    }

    return {
        setters: [],
        execute: function () {
            queue = [];
            id = undefined;

            /**
             * Indicates whether or not the render loop is running.
             * @property {boolean} rendering 
             * @for renderLoop
             * @static
             */
            rendering = false;

            _export('rendering', rendering);
        }
    };
});
$__System.register("76", ["8", "9", "11", "12", "13", "16", "17", "19", "21", "22", "23", "24", "43", "6d", "a", "6c", "1e", "1d", "1b", "1f", "1c", "1a"], function (_export) {
    /**
     * Here as a convenience, although generally,
     * importing single modules is preferable.
     * @module rudy
     */
    "use strict";

    var asdr, envelopeCore, Generator, ParameterizedAction, Clock, audioCore, audioUtil, Instrument, Osc, Noise, Convolution, Bandpass, mixer, renderLoop, util, visualCore, moduleExtensions, nodes, MediaElementPlayer, SamplePlayer, SchroederReverb, SpritePlayer, audio, instrument, rhythm;
    return {
        setters: [function (_13) {
            asdr = _13;
        }, function (_12) {
            envelopeCore = _12;
        }, function (_11) {
            Generator = _11["default"];
        }, function (_9) {
            ParameterizedAction = _9["default"];
        }, function (_10) {
            Clock = _10["default"];
        }, function (_) {
            audioCore = _;
        }, function (_3) {
            audioUtil = _3;
        }, function (_8) {
            Instrument = _8["default"];
        }, function (_7) {
            Osc = _7.Osc;
        }, function (_6) {
            Noise = _6.Noise;
        }, function (_5) {
            Convolution = _5.Convolution;
        }, function (_4) {
            Bandpass = _4.Bandpass;
        }, function (_2) {
            mixer = _2;
        }, function (_d) {
            renderLoop = _d;
        }, function (_a) {
            util = _a;
        }, function (_c) {
            visualCore = _c;
        }, function (_e) {
            moduleExtensions = _e;
        }, function (_d2) {
            nodes = _d2;
        }, function (_b) {
            MediaElementPlayer = _b.MediaElementPlayer;
        }, function (_f) {
            SamplePlayer = _f.SamplePlayer;
        }, function (_c2) {
            SchroederReverb = _c2.SchroederReverb;
        }, function (_a2) {
            SpritePlayer = _a2.SpritePlayer;
        }],
        execute: function () {
            _export("renderLoop", renderLoop);

            _export("util", util);

            _export("visualCore", visualCore);

            audio = {
                audioCore: audioCore,
                moduleExtensions: moduleExtensions,
                mixer: mixer,
                nodes: nodes,
                util: audioUtil,
                modules: {
                    Bandpass: Bandpass,
                    Convolution: Convolution,
                    MediaElementPlayer: MediaElementPlayer,
                    Noise: Noise,
                    Osc: Osc,
                    SamplePlayer: SamplePlayer,
                    SchroederReverb: SchroederReverb,
                    SpritePlayer: SpritePlayer
                }
            };

            _export("audio", audio);

            instrument = {
                Instrument: Instrument,
                ParameterizedAction: ParameterizedAction
            };

            _export("instrument", instrument);

            rhythm = {
                Clock: Clock,
                Generator: Generator,
                envelope: {
                    core: envelopeCore,
                    asdr: asdr
                }
            };

            _export("rhythm", rhythm);
        }
    };
});
$__System.register("1", ["76"], function (_export) {
    /*import * as featureDetection from "./featureDetection";
    import audio_scene_init from "./audioScene";
    
    // init visual scene
    
    
    if (featureDetection.webaudio) {
        audio_scene_init();
    }*/
    "use strict";

    var rudy;
    return {
        setters: [function (_) {
            rudy = _;
        }],
        execute: function () {
            console.log(rudy);
        }
    };
});
})
(function(factory) {
  factory();
});
//# sourceMappingURL=main.js.map