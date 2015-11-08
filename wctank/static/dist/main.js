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

(function(__global) {
  var loader = $__System;
  var indexOf = Array.prototype.indexOf || function(item) {
    for (var i = 0, l = this.length; i < l; i++)
      if (this[i] === item)
        return i;
    return -1;
  }

  var commentRegEx = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg;
  var cjsRequirePre = "(?:^|[^$_a-zA-Z\\xA0-\\uFFFF.])";
  var cjsRequirePost = "\\s*\\(\\s*(\"([^\"]+)\"|'([^']+)')\\s*\\)";
  var fnBracketRegEx = /\(([^\)]*)\)/;
  var wsRegEx = /^\s+|\s+$/g;
  
  var requireRegExs = {};

  function getCJSDeps(source, requireIndex) {

    // remove comments
    source = source.replace(commentRegEx, '');

    // determine the require alias
    var params = source.match(fnBracketRegEx);
    var requireAlias = (params[1].split(',')[requireIndex] || 'require').replace(wsRegEx, '');

    // find or generate the regex for this requireAlias
    var requireRegEx = requireRegExs[requireAlias] || (requireRegExs[requireAlias] = new RegExp(cjsRequirePre + requireAlias + cjsRequirePost, 'g'));

    requireRegEx.lastIndex = 0;

    var deps = [];

    var match;
    while (match = requireRegEx.exec(source))
      deps.push(match[2] || match[3]);

    return deps;
  }

  /*
    AMD-compatible require
    To copy RequireJS, set window.require = window.requirejs = loader.amdRequire
  */
  function require(names, callback, errback, referer) {
    // in amd, first arg can be a config object... we just ignore
    if (typeof names == 'object' && !(names instanceof Array))
      return require.apply(null, Array.prototype.splice.call(arguments, 1, arguments.length - 1));

    // amd require
    if (typeof names == 'string' && typeof callback == 'function')
      names = [names];
    if (names instanceof Array) {
      var dynamicRequires = [];
      for (var i = 0; i < names.length; i++)
        dynamicRequires.push(loader['import'](names[i], referer));
      Promise.all(dynamicRequires).then(function(modules) {
        if (callback)
          callback.apply(null, modules);
      }, errback);
    }

    // commonjs require
    else if (typeof names == 'string') {
      var module = loader.get(names);
      return module.__useDefault ? module['default'] : module;
    }

    else
      throw new TypeError('Invalid require');
  }

  function define(name, deps, factory) {
    if (typeof name != 'string') {
      factory = deps;
      deps = name;
      name = null;
    }
    if (!(deps instanceof Array)) {
      factory = deps;
      deps = ['require', 'exports', 'module'].splice(0, factory.length);
    }

    if (typeof factory != 'function')
      factory = (function(factory) {
        return function() { return factory; }
      })(factory);

    // in IE8, a trailing comma becomes a trailing undefined entry
    if (deps[deps.length - 1] === undefined)
      deps.pop();

    // remove system dependencies
    var requireIndex, exportsIndex, moduleIndex;
    
    if ((requireIndex = indexOf.call(deps, 'require')) != -1) {
      
      deps.splice(requireIndex, 1);

      // only trace cjs requires for non-named
      // named defines assume the trace has already been done
      if (!name)
        deps = deps.concat(getCJSDeps(factory.toString(), requireIndex));
    }

    if ((exportsIndex = indexOf.call(deps, 'exports')) != -1)
      deps.splice(exportsIndex, 1);
    
    if ((moduleIndex = indexOf.call(deps, 'module')) != -1)
      deps.splice(moduleIndex, 1);

    var define = {
      name: name,
      deps: deps,
      execute: function(req, exports, module) {

        var depValues = [];
        for (var i = 0; i < deps.length; i++)
          depValues.push(req(deps[i]));

        module.uri = module.id;

        module.config = function() {};

        // add back in system dependencies
        if (moduleIndex != -1)
          depValues.splice(moduleIndex, 0, module);
        
        if (exportsIndex != -1)
          depValues.splice(exportsIndex, 0, exports);
        
        if (requireIndex != -1) 
          depValues.splice(requireIndex, 0, function(names, callback, errback) {
            if (typeof names == 'string' && typeof callback != 'function')
              return req(names);
            return require.call(loader, names, callback, errback, module.id);
          });

        var output = factory.apply(exportsIndex == -1 ? __global : exports, depValues);

        if (typeof output == 'undefined' && module)
          output = module.exports;

        if (typeof output != 'undefined')
          return output;
      }
    };

    // anonymous define
    if (!name) {
      // already defined anonymously -> throw
      if (lastModule.anonDefine)
        throw new TypeError('Multiple defines for anonymous module');
      lastModule.anonDefine = define;
    }
    // named define
    else {
      // if we don't have any other defines,
      // then let this be an anonymous define
      // this is just to support single modules of the form:
      // define('jquery')
      // still loading anonymously
      // because it is done widely enough to be useful
      if (!lastModule.anonDefine && !lastModule.isBundle) {
        lastModule.anonDefine = define;
      }
      // otherwise its a bundle only
      else {
        // if there is an anonDefine already (we thought it could have had a single named define)
        // then we define it now
        // this is to avoid defining named defines when they are actually anonymous
        if (lastModule.anonDefine && lastModule.anonDefine.name)
          loader.registerDynamic(lastModule.anonDefine.name, lastModule.anonDefine.deps, false, lastModule.anonDefine.execute);

        lastModule.anonDefine = null;
      }

      // note this is now a bundle
      lastModule.isBundle = true;

      // define the module through the register registry
      loader.registerDynamic(name, define.deps, false, define.execute);
    }
  }
  define.amd = {};

  // adds define as a global (potentially just temporarily)
  function createDefine(loader) {
    lastModule.anonDefine = null;
    lastModule.isBundle = false;

    // ensure no NodeJS environment detection
    var oldModule = __global.module;
    var oldExports = __global.exports;
    var oldDefine = __global.define;

    __global.module = undefined;
    __global.exports = undefined;
    __global.define = define;

    return function() {
      __global.define = oldDefine;
      __global.module = oldModule;
      __global.exports = oldExports;
    };
  }

  var lastModule = {
    isBundle: false,
    anonDefine: null
  };

  loader.set('@@amd-helpers', loader.newModule({
    createDefine: createDefine,
    require: require,
    define: define,
    lastModule: lastModule
  }));
  loader.amdDefine = define;
  loader.amdRequire = require;
})(typeof self != 'undefined' ? self : global);

"bundle";
(function() {
var _removeDefine = $__System.get("@@amd-helpers").createDefine();
define("2", [], function() {
  return "<svg xmlns=\"http://www.w3.org/2000/svg\" version=\"1.1\">\n<defs>\n\n<filter id=\"print-analog\">\n    <feColorMatrix in=\"SourceGraphic\" type=\"saturate\" values=\"4.6\"></feColorMatrix>\n    <feComponentTransfer>\n        <feFuncA type=\"discrete\" tableValues=\"0.93\"></feFuncA>\n    </feComponentTransfer>\n    <feOffset dx=\"2\" dy=\"1\" result=\"offset\"></feOffset>\n    \n    <!-- EDGE DETECTION -->\n        <feColorMatrix in=\"SourceGraphic\" type=\"saturate\" values=\"0\"></feColorMatrix>\n        <feGaussianBlur id=\"pa-denoise\" stdDeviation=\"1.16\"></feGaussianBlur>\n        <feConvolveMatrix   \n            kernelMatrix=\"-1 -1 -1 \n                          -1 8 -1 \n                          -1 -1 -1\"\n            preserveAlpha=\"true\">\n        </feConvolveMatrix>\n        <feComponentTransfer result=\"flip\">\n            <feFuncR type=\"linear\" slope=\"-30\" intercept=\"1\" tableValues=\"0 1\"></feFuncR>\n            <feFuncG type=\"linear\" slope=\"-30\" intercept=\"1\" tableValues=\"0 1\"></feFuncG>\n            <feFuncB type=\"linear\" slope=\"-30\" intercept=\"1\" tableValues=\"0 1\"></feFuncB>\n        </feComponentTransfer> \n        <feMorphology operator=\"erode\" radius=\"0.001\" result=\"thick\"></feMorphology>\n    <!-- /EDGE DETECTION -->\n    \n    <feBlend id=\"pa-bypass\" in=\"offset\" in2=\"flip\" mode=\"multiply\" result=\"out\"></feBlend>\n    <feComponentTransfer>\n        <feFuncA type=\"discrete\" tableValues=\"0.75\"></feFuncA>\n    </feComponentTransfer> \n\n</filter>\n\n<filter id=\"animated-blur\">\n    <feGaussianBlur id=\"animated-blur-feGaussianBlur\" stdDeviation=\"0\">\n        <animate id=\"animated-blur-animate-node\" attributeName=\"stdDeviation\" \n            values=\"\" calcMode=\"linear\" dur=\"1000ms\" repeatCount=\"indefinite\">\n        </animate>\n    </feGaussianBlur> \n</filter>\n\n</defs>\n</svg>\n";
});

_removeDefine();
})();
$__System.register("3", ["4", "5", "6", "7", "8"], function (_export) {
    var goTo, hasBit, _classCallCheck, _getIterator, _Object$keys, flags, bit, TableuxData, sets;

    function registerEffect(name) {
        flags[name] = bit;
        bit = bit >>> 1;
    }

    function pushData(tableuxDataArray) {
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
            for (var _iterator = _getIterator(tableuxDataArray), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                var tdt = _step.value;
                var _iteratorNormalCompletion2 = true;
                var _didIteratorError2 = false;
                var _iteratorError2 = undefined;

                try {
                    for (var _iterator2 = _getIterator(_Object$keys(flags)), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                        var _name = _step2.value;

                        if (hasBit(tdt.flag, flags[_name])) {
                            if (!Array.isArray(sets[_name])) sets[_name] = [];
                            sets[_name].push(tdt);
                        }
                    }
                } catch (err) {
                    _didIteratorError2 = true;
                    _iteratorError2 = err;
                } finally {
                    try {
                        if (!_iteratorNormalCompletion2 && _iterator2["return"]) {
                            _iterator2["return"]();
                        }
                    } finally {
                        if (_didIteratorError2) {
                            throw _iteratorError2;
                        }
                    }
                }
            }
        } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
        } finally {
            try {
                if (!_iteratorNormalCompletion && _iterator["return"]) {
                    _iterator["return"]();
                }
            } finally {
                if (_didIteratorError) {
                    throw _iteratorError;
                }
            }
        }
    }

    function select(effect) {
        var set = sets[effect.name];
        var idx = Math.random() * set.length | 0;
        goTo(set[idx].loc, set[idx].zoom);
        if (set[idx].callbacks) {
            var _iteratorNormalCompletion3 = true;
            var _didIteratorError3 = false;
            var _iteratorError3 = undefined;

            try {
                for (var _iterator3 = _getIterator(set[idx].callbacks), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                    var cb = _step3.value;

                    cb(effect);
                }
            } catch (err) {
                _didIteratorError3 = true;
                _iteratorError3 = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion3 && _iterator3["return"]) {
                        _iterator3["return"]();
                    }
                } finally {
                    if (_didIteratorError3) {
                        throw _iteratorError3;
                    }
                }
            }
        }
    }

    return {
        setters: [function (_4) {
            goTo = _4.goTo;
        }, function (_5) {
            hasBit = _5.hasBit;
        }, function (_) {
            _classCallCheck = _["default"];
        }, function (_2) {
            _getIterator = _2["default"];
        }, function (_3) {
            _Object$keys = _3["default"];
        }],
        execute: function () {
            /**
             * @module tableux
             * choose a map center and zoom level depending on what filter is passed to select
             */

            "use strict";

            _export("registerEffect", registerEffect);

            _export("pushData", pushData);

            _export("select", select);

            flags = {};

            _export("flags", flags);

            flags.ALL = 0xFFFFFFFF;

            bit = 0x40000000;

            TableuxData = function TableuxData(lat, lng, zoom, flag, callbacks) {
                _classCallCheck(this, TableuxData);

                this.loc = new google.maps.LatLng(lat, lng);
                this.zoom = zoom;
                this.flag = flag;
                this.callbacks = callbacks;
            };

            _export("TableuxData", TableuxData);

            sets = {};
        }
    };
});
$__System.registerDynamic("9", ["a", "b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var isObject = req('a');
  req('b')('freeze', function($freeze) {
    return function freeze(it) {
      return $freeze && isObject(it) ? $freeze(it) : it;
    };
  });
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("c", ["9", "d"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  req('9');
  module.exports = req('d').Object.freeze;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("e", ["c"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {
    "default": req('c'),
    __esModule: true
  };
  global.define = __define;
  return module.exports;
});

$__System.register('f', ['5', '6', '10', '11', '12', '13', '14', '15', 'e'], function (_export) {
    var util, _classCallCheck, core, _get, _inherits, _createClass, _Symbol, _Object$getOwnPropertyDescriptor, _Object$freeze, compEnvParentAssessors, ComponentEnvelope, sustainVs, sustainCookedVs, sustainCooked, sustainPriorBakeParams, sustainAmplitude, sustainDummy, Sustain, genA, genS, genD, genR, genEnv, genAS, genDR, genChanged, genPriorDuration, genSet, genUpdateEnvs, Generator, presets;

    function clipValueSequence(env) {
        env.valueSequence.forEach(function (v) {
            if (v.value > 1) v.value = 1;else if (v.value < 0) v.value = 0;
        });
    }

    // a collection of useful param objs to construct envelopeAsdr.Generators with
    return {
        setters: [function (_8) {
            util = _8;
        }, function (_4) {
            _classCallCheck = _4['default'];
        }, function (_7) {
            core = _7;
        }, function (_) {
            _get = _['default'];
        }, function (_2) {
            _inherits = _2['default'];
        }, function (_3) {
            _createClass = _3['default'];
        }, function (_5) {
            _Symbol = _5['default'];
        }, function (_6) {
            _Object$getOwnPropertyDescriptor = _6['default'];
        }, function (_e) {
            _Object$freeze = _e['default'];
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
$__System.register('16', ['5', '6', '7', '8', '10', '13', '14', '17', '18'], function (_export) {
    var util, _classCallCheck, _getIterator, _Object$keys, envelopeCore, _createClass, _Symbol, ParameterizedAction, Clock, Rval, flr, floatingLoopReinitializer, genClock, genTarget, genSequence, genCbks, genLoop, genWasLooping, genLoopCount, genLocked, genRangeError, genPropError, genTypeError, genIsFunction, genQueue, genPriorTime, genAddCancelable, genTriggerCancelables, genClockFunctions, genReinitId, genConfig, Generator;

    return {
        setters: [function (_6) {
            util = _6;
        }, function (_2) {
            _classCallCheck = _2['default'];
        }, function (_3) {
            _getIterator = _3['default'];
        }, function (_4) {
            _Object$keys = _4['default'];
        }, function (_7) {
            envelopeCore = _7;
        }, function (_) {
            _createClass = _['default'];
        }, function (_5) {
            _Symbol = _5['default'];
        }, function (_8) {
            ParameterizedAction = _8['default'];
        }, function (_9) {
            Clock = _9['default'];
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

            _export('Generator', Generator);
        }
    };
});
$__System.register('18', ['5', '6', '7', '8', '13', '14'], function (_export) {
    var util, _classCallCheck, _getIterator, _Object$keys, _createClass, _Symbol, clkQueue, clkSmudge, clkBpm, clkLast, clkNext, clkLen, clkIsOn, clkCycles, clkId, clkWasPaused, clkBeatStart, clkBeatRemaining, clkMachine, clkParamException, Clock;

    return {
        setters: [function (_6) {
            util = _6;
        }, function (_2) {
            _classCallCheck = _2['default'];
        }, function (_4) {
            _getIterator = _4['default'];
        }, function (_5) {
            _Object$keys = _5['default'];
        }, function (_) {
            _createClass = _['default'];
        }, function (_3) {
            _Symbol = _3['default'];
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

            _export('Clock', Clock);
        }
    };
});
$__System.register('10', ['5', '6', '11', '12', '13', '14', '19', '1a', '1b'], function (_export) {
    var util, _classCallCheck, _get, _inherits, _createClass, _Symbol, audioCore, audioUtil, TWEEN, envelopeValueThrowException, envelopeValueValidateTimeRange, envelopeValueValue, envelopeValueTime, EnvelopeValue, envDuration, envInterpolationType, envInterpolationArgs, envValueSequence, envCheckEnvelopeValue, Envelope, AbsoluteEnvelopeValue, absEnvValueSequence, AbsoluteEnvelope, interpolation, cancelableTarg, cancelableFresh, cancelableSpoil, Cancelable, audioFatalFns, audioFatal;

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
        setters: [function (_6) {
            util = _6;
        }, function (_2) {
            _classCallCheck = _2['default'];
        }, function (_3) {
            _get = _3['default'];
        }, function (_4) {
            _inherits = _4['default'];
        }, function (_) {
            _createClass = _['default'];
        }, function (_5) {
            _Symbol = _5['default'];
        }, function (_7) {
            audioCore = _7;
        }, function (_a) {
            audioUtil = _a;
        }, function (_b) {
            TWEEN = _b['default'];
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
$__System.register('17', ['6', '10', '13', '14'], function (_export) {
  var _classCallCheck, apply, AbsoluteEnvelope, _createClass, _Symbol, paTarget, paEnv, paType, paError, ParameterizedAction;

  return {
    setters: [function (_2) {
      _classCallCheck = _2['default'];
    }, function (_4) {
      apply = _4.apply;
      AbsoluteEnvelope = _4.AbsoluteEnvelope;
    }, function (_) {
      _createClass = _['default'];
    }, function (_3) {
      _Symbol = _3['default'];
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
$__System.register('1c', ['6', '11', '12', '19'], function (_export) {
  var _classCallCheck, _get, _inherits, AudioModule, Instrument;

  return {
    setters: [function (_3) {
      _classCallCheck = _3['default'];
    }, function (_) {
      _get = _['default'];
    }, function (_2) {
      _inherits = _2['default'];
    }, function (_4) {
      AudioModule = _4.AudioModule;
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
$__System.register("1d", ["5", "6", "11", "12", "13", "14", "19", "1e", "1a"], function (_export) {
    var util, _classCallCheck, _get, _inherits, _createClass, _Symbol, ctx, MediaElementPlayer, parseSpriteIntervals, envelopeSprite, spriteList, ptoid, SpritePlayer;

    return {
        setters: [function (_7) {
            util = _7;
        }, function (_4) {
            _classCallCheck = _4["default"];
        }, function (_) {
            _get = _["default"];
        }, function (_2) {
            _inherits = _2["default"];
        }, function (_3) {
            _createClass = _3["default"];
        }, function (_5) {
            _Symbol = _5["default"];
        }, function (_6) {
            ctx = _6.ctx;
        }, function (_e) {
            MediaElementPlayer = _e.MediaElementPlayer;
        }, function (_a) {
            parseSpriteIntervals = _a.parseSpriteIntervals;
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
$__System.register('1f', ['6', '11', '12', '13', '14', '19', '20', '21'], function (_export) {
    var _classCallCheck, _get, _inherits, _createClass, _Symbol, AudioModule, ctx, audioNodes, moduleExtensions, AllPass, FeedbackCombFilter, schroederComb1, schroederComb2, schroederComb3, schroederComb4, schroederFeedbackCoeffMultiplier, schroederPAR_A_GAIN, schroederPAR_B_GAIN, schroederPAR_C_GAIN, schroederPAR_D_GAIN, SchroederReverb;

    return {
        setters: [function (_3) {
            _classCallCheck = _3['default'];
        }, function (_) {
            _get = _['default'];
        }, function (_2) {
            _inherits = _2['default'];
        }, function (_4) {
            _createClass = _4['default'];
        }, function (_5) {
            _Symbol = _5['default'];
        }, function (_7) {
            AudioModule = _7.AudioModule;
            ctx = _7.ctx;
        }, function (_6) {
            audioNodes = _6;
        }, function (_8) {
            moduleExtensions = _8;
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
$__System.register('22', ['5', '6', '7', '8', '11', '12', '13', '14', '19', '23', '1a'], function (_export) {
    var util, _classCallCheck, _getIterator, _Object$keys, _get, _inherits, _createClass, _Symbol, AudioModule, ctx, _Promise, parseSpriteIntervals, taffyFactory, sampleBuffer, gainNode, breakpoints, livingNodes, sampleDb, readyFn, SamplePlayer;

    return {
        setters: [function (_10) {
            util = _10;
        }, function (_4) {
            _classCallCheck = _4['default'];
        }, function (_7) {
            _getIterator = _7['default'];
        }, function (_8) {
            _Object$keys = _8['default'];
        }, function (_) {
            _get = _['default'];
        }, function (_2) {
            _inherits = _2['default'];
        }, function (_3) {
            _createClass = _3['default'];
        }, function (_5) {
            _Symbol = _5['default'];
        }, function (_9) {
            AudioModule = _9.AudioModule;
            ctx = _9.ctx;
        }, function (_6) {
            _Promise = _6['default'];
        }, function (_a) {
            parseSpriteIntervals = _a.parseSpriteIntervals;
            taffyFactory = _a.taffyFactory;
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
$__System.register('24', ['6', '11', '12', '19', '21'], function (_export) {
  var _classCallCheck, _get, _inherits, AudioModule, ctx, moduleExtensions, Osc;

  return {
    setters: [function (_3) {
      _classCallCheck = _3['default'];
    }, function (_) {
      _get = _['default'];
    }, function (_2) {
      _inherits = _2['default'];
    }, function (_4) {
      AudioModule = _4.AudioModule;
      ctx = _4.ctx;
    }, function (_5) {
      moduleExtensions = _5;
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
$__System.register('25', ['6', '11', '12', '13', '14', '19', '20', '21'], function (_export) {
  var _classCallCheck, _get, _inherits, _createClass, _Symbol, AudioModule, ctx, audioNodes, moduleExtensions, buffer, srDivisor, calcBuffer, Noise;

  return {
    setters: [function (_4) {
      _classCallCheck = _4['default'];
    }, function (_) {
      _get = _['default'];
    }, function (_2) {
      _inherits = _2['default'];
    }, function (_3) {
      _createClass = _3['default'];
    }, function (_5) {
      _Symbol = _5['default'];
    }, function (_6) {
      AudioModule = _6.AudioModule;
      ctx = _6.ctx;
    }, function (_7) {
      audioNodes = _7;
    }, function (_8) {
      moduleExtensions = _8;
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
$__System.register('1e', ['6', '11', '12', '13', '14', '19'], function (_export) {
    var _classCallCheck, _get, _inherits, _createClass, _Symbol, AudioModule, ctx, mediaElementPlayerPath, mediaElement, canPlay, canPlayFn, canPlayHasFired, loadFile, isPlaying, disableRangeReq, MediaElementPlayer;

    return {
        setters: [function (_4) {
            _classCallCheck = _4['default'];
        }, function (_) {
            _get = _['default'];
        }, function (_2) {
            _inherits = _2['default'];
        }, function (_3) {
            _createClass = _3['default'];
        }, function (_5) {
            _Symbol = _5['default'];
        }, function (_6) {
            AudioModule = _6.AudioModule;
            ctx = _6.ctx;
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
$__System.register('26', ['6', '11', '12', '19', '20', '21'], function (_export) {
  var _classCallCheck, _get, _inherits, AudioModule, ctx, audioNodes, moduleExtensions, Convolution;

  return {
    setters: [function (_3) {
      _classCallCheck = _3['default'];
    }, function (_) {
      _get = _['default'];
    }, function (_2) {
      _inherits = _2['default'];
    }, function (_5) {
      AudioModule = _5.AudioModule;
      ctx = _5.ctx;
    }, function (_4) {
      audioNodes = _4;
    }, function (_6) {
      moduleExtensions = _6;
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
$__System.register('27', ['5', '6', '11', '12', '13', '14', '19', '21', '1b'], function (_export) {
    var util, _classCallCheck, _get, _inherits, _createClass, _Symbol, AudioModule, ctx, moduleExtensions, TWEEN, params, updateFrequency, updateQ, updateGain, Bandpass;

    return {
        setters: [function (_8) {
            util = _8;
        }, function (_4) {
            _classCallCheck = _4['default'];
        }, function (_) {
            _get = _['default'];
        }, function (_2) {
            _inherits = _2['default'];
        }, function (_3) {
            _createClass = _3['default'];
        }, function (_5) {
            _Symbol = _5['default'];
        }, function (_6) {
            AudioModule = _6.AudioModule;
            ctx = _6.ctx;
        }, function (_7) {
            moduleExtensions = _7;
        }, function (_b) {
            TWEEN = _b['default'];
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
$__System.register('20', ['19', '1a'], function (_export) {
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
    }, function (_a) {
      wrapNode = _a.wrapNode;
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
$__System.register('28', ['6', '7', '8', '11', '12', '13', '14', '19', '20'], function (_export) {
    var _classCallCheck, _getIterator, _Object$keys, _get, _inherits, _createClass, _Symbol, AudioModule, Gain, soloCount, soloEvent, trkDestroy, trkContents, trkEndpoint, trkCommand, trkSoloed, trkMuted, trkLastGain, Track, busTracks, busInput, busOutput, busChain, busTrkCount, busCommand, Bus;

    return {
        setters: [function (_4) {
            _classCallCheck = _4['default'];
        }, function (_6) {
            _getIterator = _6['default'];
        }, function (_7) {
            _Object$keys = _7['default'];
        }, function (_) {
            _get = _['default'];
        }, function (_2) {
            _inherits = _2['default'];
        }, function (_3) {
            _createClass = _3['default'];
        }, function (_5) {
            _Symbol = _5['default'];
        }, function (_8) {
            AudioModule = _8.AudioModule;
        }, function (_9) {
            Gain = _9.Gain;
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
$__System.registerDynamic("29", [], true, function(req, exports, module) {
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

$__System.registerDynamic("2a", ["2b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var ITERATOR = req('2b')('iterator'),
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

$__System.registerDynamic("2c", ["d", "2d", "2e", "2b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var core = req('d'),
      $ = req('2d'),
      DESCRIPTORS = req('2e'),
      SPECIES = req('2b')('species');
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

$__System.registerDynamic("2f", ["30"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $redef = req('30');
  module.exports = function(target, src) {
    for (var key in src)
      $redef(target, key, src[key]);
    return target;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("31", [], true, function(req, exports, module) {
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

$__System.registerDynamic("32", ["31"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = req('31');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("33", ["32"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = $__System._nodeRequire ? process : req('32');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("34", ["33"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = req('33');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("35", ["a", "36"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var isObject = req('a'),
      document = req('36').document,
      is = isObject(document) && isObject(document.createElement);
  module.exports = function(it) {
    return is ? document.createElement(it) : {};
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("37", ["36"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = req('36').document && document.documentElement;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("38", [], true, function(req, exports, module) {
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

$__System.registerDynamic("39", ["3a", "38", "37", "35", "36", "3b", "34"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var ctx = req('3a'),
        invoke = req('38'),
        html = req('37'),
        cel = req('35'),
        global = req('36'),
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
      if (req('3b')(process) == 'process') {
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
  })(req('34'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("3c", ["36", "39", "3b", "34"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    var global = req('36'),
        macrotask = req('39').set,
        Observer = global.MutationObserver || global.WebKitMutationObserver,
        process = global.process,
        isNode = req('3b')(process) == 'process',
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
  })(req('34'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("3d", ["3e", "3f", "2b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var anObject = req('3e'),
      aFunction = req('3f'),
      SPECIES = req('2b')('species');
  module.exports = function(O, D) {
    var C = anObject(O).constructor,
        S;
    return C === undefined || (S = anObject(C)[SPECIES]) == undefined ? D : aFunction(S);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("40", [], true, function(req, exports, module) {
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

$__System.registerDynamic("41", ["42"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var toInteger = req('42'),
      min = Math.min;
  module.exports = function(it) {
    return it > 0 ? min(toInteger(it), 0x1fffffffffffff) : 0;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("43", ["44", "2b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var Iterators = req('44'),
      ITERATOR = req('2b')('iterator'),
      ArrayProto = Array.prototype;
  module.exports = function(it) {
    return (Iterators.Array || ArrayProto[ITERATOR]) === it;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("45", ["3e"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var anObject = req('3e');
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

$__System.registerDynamic("46", ["3a", "45", "43", "3e", "41", "47"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var ctx = req('3a'),
      call = req('45'),
      isArrayIter = req('43'),
      anObject = req('3e'),
      toLength = req('41'),
      getIterFn = req('47');
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

$__System.registerDynamic("48", [], true, function(req, exports, module) {
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

$__System.registerDynamic("49", ["2d", "4a", "36", "3a", "4b", "4c", "a", "3e", "3f", "48", "46", "4d", "40", "2b", "3d", "4e", "3c", "2e", "2f", "4f", "2c", "d", "2a", "34"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    'use strict';
    var $ = req('2d'),
        LIBRARY = req('4a'),
        global = req('36'),
        ctx = req('3a'),
        classof = req('4b'),
        $def = req('4c'),
        isObject = req('a'),
        anObject = req('3e'),
        aFunction = req('3f'),
        strictNew = req('48'),
        forOf = req('46'),
        setProto = req('4d').set,
        same = req('40'),
        SPECIES = req('2b')('species'),
        speciesConstructor = req('3d'),
        RECORD = req('4e')('record'),
        asap = req('3c'),
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
        if (works && req('2e')) {
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
      req('2f')(P.prototype, {
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
    req('4f')(P, PROMISE);
    req('2c')(PROMISE);
    Wrapper = req('d')[PROMISE];
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
    $def($def.S + $def.F * !(useNative && req('2a')(function(iter) {
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
  })(req('34'));
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("50", ["51", "52", "53", "49", "d"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  req('51');
  req('52');
  req('53');
  req('49');
  module.exports = req('d').Promise;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("23", ["50"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {
    "default": req('50'),
    __esModule: true
  };
  global.define = __define;
  return module.exports;
});

$__System.register('1a', ['6', '7', '8', '13', '19', '23', '29'], function (_export) {
    var _classCallCheck, _getIterator, _Object$keys, _createClass, AudioModule, _Promise, TAFFY, units;

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
            _classCallCheck = _2['default'];
        }, function (_4) {
            _getIterator = _4['default'];
        }, function (_5) {
            _Object$keys = _5['default'];
        }, function (_) {
            _createClass = _['default'];
        }, function (_6) {
            AudioModule = _6.AudioModule;
        }, function (_3) {
            _Promise = _3['default'];
        }, function (_7) {
            TAFFY = _7['default'];
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
$__System.register('21', ['19', '1b', '1a'], function (_export) {
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

    var ctx, TWEEN, audioUtil;

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
        }, function (_b) {
            TWEEN = _b['default'];
        }, function (_a) {
            audioUtil = _a;
        }],
        execute: function () {}
    };
});
$__System.register('19', ['6', '13'], function (_export) {
    var _classCallCheck, _createClass, ctx, out, AudioModule;

    return {
        setters: [function (_2) {
            _classCallCheck = _2['default'];
        }, function (_) {
            _createClass = _['default'];
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
$__System.register("54", ["6", "13", "55"], function (_export) {
    var _classCallCheck, _createClass, renderLoop, Effect;

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
        setters: [function (_2) {
            _classCallCheck = _2["default"];
        }, function (_) {
            _createClass = _["default"];
        }, function (_3) {
            renderLoop = _3;
        }],
        execute: function () {
            "use strict";

            _export("webglSetup", webglSetup);

            Effect = (function () {
                function Effect() {
                    _classCallCheck(this, Effect);

                    /**
                     * @property {function} preInit 
                     * @default undefined
                     */
                    this.preInit;

                    /**
                     * @property {function} init
                     * @default undefined
                     */
                    this.init;

                    /**
                     * @property {function} animate 
                     * @default undefined
                     */
                    this.animate;

                    /**
                     * @property {function} preTeardown
                     * @default null
                     */
                    this.preTeardown;

                    /**
                     * @property {function} teardown
                     * @default undefined
                     */
                    this.teardown;
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
                                if (fn_name === 'animate') renderLoop[r_op](this[fn_name]);else this[fn_name]();
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
$__System.registerDynamic("1b", [], true, function(req, exports, module) {
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

$__System.register('5', ['6', '8', '13', '15', '55', '56', '1b'], function (_export) {
    var _classCallCheck, _Object$keys, _createClass, _Object$getOwnPropertyDescriptor, renderLoop, _Object$defineProperty, TWEEN, time, easing_keys, interpolation_keys, tween;

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
        setters: [function (_2) {
            _classCallCheck = _2['default'];
        }, function (_5) {
            _Object$keys = _5['default'];
        }, function (_) {
            _createClass = _['default'];
        }, function (_3) {
            _Object$getOwnPropertyDescriptor = _3['default'];
        }, function (_6) {
            renderLoop = _6;
        }, function (_4) {
            _Object$defineProperty = _4['default'];
        }, function (_b) {
            TWEEN = _b['default'];
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
$__System.register("57", ["5", "10", "16", "17", "18", "19", "20", "21", "22", "24", "25", "26", "27", "28", "54", "55", "1a", "1e", "1f", "1d", "1c", "f"], function (_export) {
    /**
     * Here as a convenience, although generally,
     * importing single modules is preferable.
     * @module rudy
     */
    "use strict";

    var util, envelopeCore, Generator, ParameterizedAction, Clock, audioCore, nodes, moduleExtensions, SamplePlayer, Osc, Noise, Convolution, Bandpass, mixer, visualCore, renderLoop, audioUtil, MediaElementPlayer, SchroederReverb, SpritePlayer, Instrument, asdr, audio, instrument, rhythm;
    return {
        setters: [function (_2) {
            util = _2;
        }, function (_16) {
            envelopeCore = _16;
        }, function (_15) {
            Generator = _15.Generator;
        }, function (_13) {
            ParameterizedAction = _13.ParameterizedAction;
        }, function (_14) {
            Clock = _14.Clock;
        }, function (_4) {
            audioCore = _4;
        }, function (_7) {
            nodes = _7;
        }, function (_5) {
            moduleExtensions = _5;
        }, function (_12) {
            SamplePlayer = _12.SamplePlayer;
        }, function (_11) {
            Osc = _11.Osc;
        }, function (_10) {
            Noise = _10.Noise;
        }, function (_9) {
            Convolution = _9.Convolution;
        }, function (_8) {
            Bandpass = _8.Bandpass;
        }, function (_6) {
            mixer = _6;
        }, function (_3) {
            visualCore = _3;
        }, function (_) {
            renderLoop = _;
        }, function (_a) {
            audioUtil = _a;
        }, function (_e) {
            MediaElementPlayer = _e.MediaElementPlayer;
        }, function (_f) {
            SchroederReverb = _f.SchroederReverb;
        }, function (_d) {
            SpritePlayer = _d.SpritePlayer;
        }, function (_c) {
            Instrument = _c.Instrument;
        }, function (_f2) {
            asdr = _f2;
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
(function() {
var _removeDefine = $__System.get("@@amd-helpers").createDefine();
define("58", [], function() {
  return "<svg id=\"loading\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 640 480\">\n <!-- Created with SVG-edit - http://svg-edit.googlecode.com/ -->\n <g>\n  <path d=\"m5.77504,97.71085c0,0 -0.21238,0.59723 0,1.10997c0.30036,0.72513 0.99658,2.27054 2.77494,6.10486c1.04429,2.25159 6.79895,8.22893 11.65474,12.20972c7.73743,6.34319 18.91081,11.53794 22.19949,12.76473c16.31963,6.08775 26.69567,11.4669 51.05884,18.86955c11.46306,3.483 33.84477,6.38229 46.06394,6.65985c5.54845,0.12604 10.48146,-1.79634 14.98466,-3.88492c3.83434,-1.77835 14.91391,-8.81285 22.19949,-14.98465c6.58759,-5.58054 7.49716,-8.12646 10.54477,-12.76472c2.45706,-3.73947 4.34467,-7.31006 2.77492,-8.87979c-0.39243,-0.39243 -2.77492,0 -14.98465,0c-4.99487,0 -14.09891,1.89337 -16.64961,3.8849c-4.33047,3.38115 -6.82564,8.22551 -7.76984,9.98977c-3.40437,6.36115 -5.09332,13.21967 -5.54988,26.08441c-0.67038,18.89032 3.19806,28.30994 2.77495,44.39902c-0.27759,10.55568 -4.38696,20.99365 -13.3197,32.18927c-4.16805,5.22386 -16.14017,15.74826 -23.30946,19.97955c-10.48233,6.18658 -25.4575,16.40646 -36.07418,12.76468c-15.22387,-5.22214 -11.58913,-29.02753 6.65984,-38.29413c17.28419,-8.77669 29.16979,-5.21512 41.06907,0c16.59619,7.27365 37.12262,12.68515 46.06395,7.76984c10.12018,-5.56335 21.38835,-16.94397 32.18927,-26.08441c8.13799,-6.88689 11.09975,-7.76984 12.20972,-7.76984c2.21996,0 5.29938,1.53729 6.10487,3.88492c1.83681,5.35342 2.21994,10.54477 2.21994,16.64963c0,3.88492 -2.78296,9.25638 -8.87979,12.20972c-5.21466,2.526 -13.87679,4.92747 -23.30948,-3.88492c-7.44478,-6.95522 -0.26758,-19.71057 12.76471,-31.63428c4.35268,-3.98239 8.39864,-5.95557 12.20972,-2.77495c8.52185,7.11217 8.58424,11.29881 11.65472,15.53966c2.54201,3.51096 13.84366,12.5126 32.18933,6.10486c7.85919,-2.74506 13.89117,-13.32178 13.31967,-17.75958c-0.38174,-2.96423 -17.34029,-7.99332 -24.41946,6.10484c-6.16103,12.26965 12.75174,30.84282 21.64453,23.30949c7.72751,-6.5462 0.03256,-20.18723 -2.77493,-27.19441c-0.46155,-1.15195 -0.83154,-0.58942 -1.10999,2.77495c-0.41196,4.97786 4.38,19.7746 24.97443,26.6394c6.86481,2.28827 14.05795,-3.25928 20.53455,-9.43478c5.237,-4.99356 4.43988,-12.20972 4.43988,-14.42969c0,-6.10486 0.39246,-7.37738 0,-7.76981c-0.39243,-0.39246 -1.1568,-0.08511 -2.21994,0.55499c-4.09006,2.46255 -8.15955,5.53355 -10.54474,10.54472c-1.96689,4.13237 -2.81641,9.16228 0.55496,13.87471c2.77786,3.88284 5.2692,3.76093 7.21484,2.21994c3.39795,-2.69119 7.31442,-15.54364 6.65985,-30.52429c-0.78131,-17.88074 -4.3187,-34.95326 -2.77496,-52.72382c2.40924,-27.73357 0.73657,-36.47363 -1.66495,-33.85423c-4.05679,4.42488 -6.90164,6.04694 -12.76468,17.7596c-13.75348,27.4754 -7.51511,51.18133 1.66495,73.25835c10.21259,24.56021 21.56229,45.65002 27.19437,48.83885c0.96591,0.54692 1.66495,0 2.21994,0c0.55499,0 0.55499,-0.55495 1.11002,-0.55495c0.55499,0 0.62097,-0.67456 1.66495,-3.88492c0.76755,-2.36037 1.40619,-2.27361 2.21994,-5.5499c2.96136,-11.92288 4.65158,-40.01331 8.3248,-62.15857c1.01532,-6.12131 1.10999,-4.9949 1.10999,-3.88492c0,3.88492 -0.39383,10.01642 -1.66495,17.20462c-0.98557,5.5733 -0.83459,10.5545 -1.10999,14.42966c-0.2782,3.91449 -1.67535,8.77228 -2.77493,16.09464c-1.1568,7.70325 -1.22452,11.16776 -0.55499,14.42967c0.84985,4.14032 2.21997,4.99489 3.32993,4.99489c0.55499,0 1.10999,0 1.66495,0c1.66498,0 3.47223,-0.99637 6.10489,-4.4399c4.11453,-5.38182 6.76932,-11.04131 9.98975,-17.20461c4.59769,-8.79918 7.46347,-16.34186 11.09976,-20.53455c4.62827,-5.3364 7.24207,-6.88547 12.76471,-6.10486c5.91858,0.83656 6.72449,2.74493 7.21484,3.88492c2.56674,5.96733 2.66898,9.96461 1.66495,14.42964c-0.62085,2.76097 -2.76953,5.43349 -3.3299,9.43483c-0.61581,4.39697 4.02588,13.57942 11.65472,20.53452c9.56573,8.72092 19.24088,7.28975 28.85934,3.88492c31.11905,-11.01587 61.57883,-17.40758 62.71356,-22.75449c0.11523,-0.54291 -0.32187,-1.54495 1.10999,-3.32993c2.32959,-2.90405 9.00653,-2.45192 9.98975,2.21996c2.80206,13.31404 -6.92838,21.72958 -8.87976,20.53453c-6.31439,-3.8671 -2.99661,-19.87244 2.21994,-19.42456c14.09756,1.21042 12.6749,20.56522 2.77487,36.62918c-18.17694,29.49432 -67.15341,44.39899 -97.12274,37.18414l34.9642,-9.43478l138.19183,0l43.289,-4.99487\"/>\n  <path d=\"m349.75903,144.09641c-0.60242,0 -1.02017,-0.2764 -1.80725,-0.60242c-0.55655,-0.23051 -1.98367,-0.17642 -2.40964,-0.60242c-0.42596,-0.42596 0,-1.2048 0.60242,-1.2048c0.60242,0 1.25067,-0.23051 1.80722,0c0.78708,0.32602 1.38129,0.77884 1.80725,1.2048c0.42596,0.42599 0.42596,1.38126 0,1.80725c-0.42596,0.42598 -0.60242,0.60239 -1.20483,0.60239c-0.60242,0 -1.2048,0 -1.80722,0c-0.60242,0 -1.20483,0 -1.80722,0c-0.60242,0 -0.37189,-0.64824 -0.60242,-1.2048c-0.32602,-0.78708 -0.60242,-1.20483 0,-1.20483c1.2048,0 1.80722,0 2.40964,0c0.60242,0 1.38126,-0.42596 1.80722,0c0.42596,0.42599 0,1.20483 0,1.80725c0,1.2048 0.42596,1.98364 0,2.40962c-0.42596,0.42598 -1.2048,0 -1.80722,0c-0.60242,0 -0.60242,-0.60242 -0.60242,-1.20482c0,-0.60242 0,-1.2048 0,-1.80722c0,-0.60242 0.41772,-0.87881 1.20483,-1.20483c0.55652,-0.23053 1.80722,0 2.40964,0c0.60239,0 1.2048,0 1.2048,0.60242c0,0.60242 -1.70105,1.49774 -3.01205,1.80722c-0.58627,0.13841 -1.2048,0 -1.2048,-0.60239c0,-0.60242 0.77884,-0.77887 1.2048,-1.20483c0.42596,-0.42596 0.60242,-0.60242 1.20483,-0.60242l0.60242,0\"/>\n </g>\n</svg>";
});

_removeDefine();
})();
$__System.registerDynamic("59", ["5a"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var defined = req('5a');
  module.exports = function(it) {
    return Object(defined(it));
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("5b", ["59", "b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var toObject = req('59');
  req('b')('keys', function($keys) {
    return function keys(it) {
      return $keys(toObject(it));
    };
  });
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("5c", ["5b", "d"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  req('5b');
  module.exports = req('d').Object.keys;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("8", ["5c"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {
    "default": req('5c'),
    __esModule: true
  };
  global.define = __define;
  return module.exports;
});

$__System.register("4", ["6", "7", "8", "5d"], function (_export) {
    var _classCallCheck, _getIterator, _Object$keys, $, events_added, event_locales, registeredEventCallback, addSingleEvent, map, overlay, events, zoom_plus, zoom_minus, randHex, plus_last, minus_last;

    function init() {
        var mapOptions = {
            center: new google.maps.LatLng(43.1, -87.107180),
            zoom: 11,
            mapTypeId: google.maps.MapTypeId.SATELLITE,
            disableDefaultUI: true,
            zoomControl: false,
            zoomControlOptions: {
                position: google.maps.ControlPosition.LEFT_BOTTOM
            }
        };
        _export("map", map = new google.maps.Map(document.getElementById("map-canvas"), mapOptions));

        _export("overlay", overlay = new google.maps.OverlayView());
        overlay.draw = function () {};
        overlay.setMap(map);
    }

    // mostly for dbug

    function logMapStats() {
        console.log(map.center.lat() + " " + map.center.lng());
        console.log(map.zoom);
    }

    // goTo a location/zoom

    function goTo(lat_or_latLng, lng_or_zoom, zoom) {
        if ('lat' in lat_or_latLng && 'lng' in lat_or_latLng) {
            map.setCenter(lat_or_latLng);
            map.setZoom(lng_or_zoom);
        } else {
            map.setCenter(new google.maps.LatLng(lat_or_latLng, lng_or_zoom));
            map.setZoom(zoom);
        }
    }

    ////////////////////// zoom controls

    function zoomControlsVisible(b) {
        var $zoomCtl = $(".gmnoprint").not(".gm-style-cc");
        b ? $zoomCtl.show() : $zoomCtl.hide();
    }

    return {
        setters: [function (_) {
            _classCallCheck = _["default"];
        }, function (_2) {
            _getIterator = _2["default"];
        }, function (_3) {
            _Object$keys = _3["default"];
        }, function (_d) {
            $ = _d["default"];
        }],
        execute: function () {
            /**
             * @module gMap
             */

            //////// module private stuff
            "use strict";

            _export("init", init);

            _export("logMapStats", logMapStats);

            _export("goTo", goTo);

            _export("zoomControlsVisible", zoomControlsVisible);

            events_added = false;
            event_locales = {
                map: {},
                marker: {}
            };

            registeredEventCallback = function registeredEventCallback(callback, only_once) {
                _classCallCheck(this, registeredEventCallback);

                this.once = only_once;
                this.fn = callback;
            };

            addSingleEvent = function addSingleEvent(event, callback, once, marker) {
                var locale = marker ? marker : map;
                var add_fn = once ? google.maps.event.addListenerOnce : google.maps.event.addListener;
                add_fn(locale, event, callback);
            };

            /////////////////////////////

            // on init, holds ref to google.maps.Map obj
            map = null;

            _export("map", map);

            overlay = null;

            _export("overlay", overlay);

            events = {
                queue: function queue(locale, event, callback, once) {
                    var real_once = once ? once : false;
                    if (events_added && locale === "marker" || !events_added) {
                        if (!event_locales[locale].hasOwnProperty(event)) {
                            event_locales[locale][event] = [];
                        }
                        event_locales[locale][event].push(new registeredEventCallback(callback, real_once));
                    } else {
                        addSingleEvent(event, callback, real_once);
                    }
                },

                // marker here is a ref to an individual marker we might
                // be attaching events to
                initQueuedEvents: function initQueuedEvents(locale, marker) {
                    // assume the event is attached to the map if the locale is not specified
                    var event_set = locale ? event_locales[locale] : event_groups.map;
                    var caller = marker ? marker : map;

                    var checked_locale = (function () {
                        if (locale === 'map') {
                            return map;
                        } else if (locale === 'marker' && marker) {
                            return marker;
                        } else if (locale === 'marker') {
                            throw new Error("Invalid gMap.events.addQueuedEvents param: " + "if locale === 'marker', a target marker object must be provided.");
                        }
                    })();

                    var _iteratorNormalCompletion = true;
                    var _didIteratorError = false;
                    var _iteratorError = undefined;

                    try {
                        var _loop = function () {
                            var event_name = _step.value;

                            var always = [];
                            var once = [];

                            _iteratorNormalCompletion2 = true;
                            _didIteratorError2 = false;
                            _iteratorError2 = undefined;

                            try {
                                for (_iterator2 = _getIterator(event_set[event_name]); !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                                    var callback = _step2.value;

                                    var fn = callback.fn;
                                    callback.once ? once.push(fn) : always.push(fn);
                                }
                            } catch (err) {
                                _didIteratorError2 = true;
                                _iteratorError2 = err;
                            } finally {
                                try {
                                    if (!_iteratorNormalCompletion2 && _iterator2["return"]) {
                                        _iterator2["return"]();
                                    }
                                } finally {
                                    if (_didIteratorError2) {
                                        throw _iteratorError2;
                                    }
                                }
                            }

                            if (always.length > 0) {
                                addSingleEvent(event_name, function () {
                                    var _iteratorNormalCompletion3 = true;
                                    var _didIteratorError3 = false;
                                    var _iteratorError3 = undefined;

                                    try {
                                        for (var _iterator3 = _getIterator(always), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                                            var fn = _step3.value;

                                            fn(caller);
                                        }
                                    } catch (err) {
                                        _didIteratorError3 = true;
                                        _iteratorError3 = err;
                                    } finally {
                                        try {
                                            if (!_iteratorNormalCompletion3 && _iterator3["return"]) {
                                                _iterator3["return"]();
                                            }
                                        } finally {
                                            if (_didIteratorError3) {
                                                throw _iteratorError3;
                                            }
                                        }
                                    }
                                }, false, marker);
                            }
                            if (once.length > 0) {
                                addSingleEvent(event_name, function () {
                                    var _iteratorNormalCompletion4 = true;
                                    var _didIteratorError4 = false;
                                    var _iteratorError4 = undefined;

                                    try {
                                        for (var _iterator4 = _getIterator(once), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
                                            var fn = _step4.value;

                                            fn(caller);
                                        }
                                    } catch (err) {
                                        _didIteratorError4 = true;
                                        _iteratorError4 = err;
                                    } finally {
                                        try {
                                            if (!_iteratorNormalCompletion4 && _iterator4["return"]) {
                                                _iterator4["return"]();
                                            }
                                        } finally {
                                            if (_didIteratorError4) {
                                                throw _iteratorError4;
                                            }
                                        }
                                    }
                                }, true, marker);
                            }
                        };

                        for (var _iterator = _getIterator(_Object$keys(event_set)), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                            var _iteratorNormalCompletion2;

                            var _didIteratorError2;

                            var _iteratorError2;

                            var _iterator2, _step2;

                            _loop();
                        }
                    } catch (err) {
                        _didIteratorError = true;
                        _iteratorError = err;
                    } finally {
                        try {
                            if (!_iteratorNormalCompletion && _iterator["return"]) {
                                _iterator["return"]();
                            }
                        } finally {
                            if (_didIteratorError) {
                                throw _iteratorError;
                            }
                        }
                    }

                    events_added = true;
                }
            };

            _export("events", events);

            window.logMapStats = logMapStats;zoom_plus = document.getElementById("zoom-in");
            zoom_minus = document.getElementById("zoom-out");

            randHex = function randHex() {
                return '#' + Math.floor(Math.random() * 16777215).toString(16);
            };

            plus_last = "#fff";

            zoom_plus.addEventListener("click", function () {
                try {
                    var z = map.getZoom();
                    map.setZoom(++z);
                    plus_last = randHex();
                    zoom_plus.style.color = plus_last;
                } catch (e) {
                    // will throw if map isn't ready, so cover that up.
                }
            });

            zoom_plus.addEventListener("mouseover", function () {
                zoom_plus.style.color = "#eb054c";
            });

            zoom_plus.addEventListener("mouseout", function () {
                zoom_plus.style.color = plus_last;
            });

            minus_last = "#fff";

            zoom_minus.addEventListener("click", function () {
                try {
                    var z = map.getZoom();
                    map.setZoom(--z);
                    minus_last = randHex();
                    zoom_minus.style.color = minus_last;
                } catch (e) {}
            });

            zoom_minus.addEventListener("mouseover", function () {
                zoom_minus.style.color = "#eb054c";
            });

            zoom_minus.addEventListener("mouseout", function () {
                zoom_minus.style.color = minus_last;
            });
        }
    };
});
$__System.register("5e", ["5d"], function (_export) {
  /**
   * @module div
   */
  "use strict";

  var $, $overlay, $map, selectors;
  return {
    setters: [function (_d) {
      $ = _d["default"];
    }],
    execute: function () {
      $overlay = $('#overlay');

      _export("$overlay", $overlay);

      $map = $("#map-canvas");

      _export("$map", $map);

      // useful css selectors
      selectors = {
        $_map_imgs: "#map-canvas :nth-child(1) :nth-child(1)" + ":nth-child(1) :nth-child(5) :nth-child(1) > div"
      };

      _export("selectors", selectors);
    }
  };
});
$__System.registerDynamic("4b", ["3b", "2b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var cof = req('3b'),
      TAG = req('2b')('toStringTag'),
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

$__System.registerDynamic("47", ["4b", "2b", "44", "d"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var classof = req('4b'),
      ITERATOR = req('2b')('iterator'),
      Iterators = req('44');
  module.exports = req('d').getIteratorMethod = function(it) {
    if (it != undefined)
      return it[ITERATOR] || it['@@iterator'] || Iterators[classof(it)];
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("5f", ["3e", "47", "d"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var anObject = req('3e'),
      get = req('47');
  module.exports = req('d').getIterator = function(it) {
    var iterFn = get(it);
    if (typeof iterFn != 'function')
      throw TypeError(it + ' is not iterable!');
    return anObject(iterFn.call(it));
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("42", [], true, function(req, exports, module) {
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

$__System.registerDynamic("60", ["42", "5a"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var toInteger = req('42'),
      defined = req('5a');
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

$__System.registerDynamic("52", ["60", "61"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var $at = req('60')(true);
  req('61')(String, 'String', function(iterated) {
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

$__System.registerDynamic("62", ["2d", "63", "4f", "64", "2b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var $ = req('2d'),
      descriptor = req('63'),
      setToStringTag = req('4f'),
      IteratorPrototype = {};
  req('64')(IteratorPrototype, req('2b')('iterator'), function() {
    return this;
  });
  module.exports = function(Constructor, NAME, next) {
    Constructor.prototype = $.create(IteratorPrototype, {next: descriptor(1, next)});
    setToStringTag(Constructor, NAME + ' Iterator');
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("61", ["4a", "4c", "30", "64", "65", "2b", "44", "62", "4f", "2d"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var LIBRARY = req('4a'),
      $def = req('4c'),
      $redef = req('30'),
      hide = req('64'),
      has = req('65'),
      SYMBOL_ITERATOR = req('2b')('iterator'),
      Iterators = req('44'),
      $iterCreate = req('62'),
      setToStringTag = req('4f'),
      getProto = req('2d').getProto,
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

$__System.registerDynamic("44", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {};
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("66", [], true, function(req, exports, module) {
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

$__System.registerDynamic("67", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = function() {};
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("68", ["67", "66", "44", "69", "61"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var addToUnscopables = req('67'),
      step = req('66'),
      Iterators = req('44'),
      toIObject = req('69');
  module.exports = req('61')(Array, 'Array', function(iterated, kind) {
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

$__System.registerDynamic("53", ["68", "44"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  req('68');
  var Iterators = req('44');
  Iterators.NodeList = Iterators.HTMLCollection = Iterators.Array;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("6a", ["53", "52", "5f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  req('53');
  req('52');
  module.exports = req('5f');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("7", ["6a"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {
    "default": req('6a'),
    __esModule: true
  };
  global.define = __define;
  return module.exports;
});

$__System.register("6b", ["4", "7", "58", "5d", "5e"], function (_export) {
    var gMap, _getIterator, loading_img, $, div, throttle, throttle_interval, text_posts, display_status, statusInvisible, post_event, iframeMouseStatus, overlay_iframe_mouse, marker_clicked, width;

    function renderTemplate(post, template) {
        var content = '';
        if (typeof post.title !== 'undefined') {
            if (post.type === "link") {
                content += "<a target='_blank' href=\"" + post.url + "\">" + post.title + "</a></div>";
            } else {
                content += "<div class='post-title'>" + post.title + "</div>";
            }
        }
        if (typeof post.body !== 'undefined') {
            content += "<div class='post-body'>" + post.body + "</div>";
        }
        if (typeof post.photos !== 'undefined') {
            content += "<img src=\"" + post.photos[0].alt_sizes[0].url + "\"/>";
        }
        if (typeof post.text !== 'undefined') {
            content += "<div class='post-text'>" + post.text + "</div>";
        }
        if (typeof post.player !== 'undefined') {
            content += Array.isArray(post.player) ? post.player[0].embed_code : post.player;
        }
        if (typeof post.description !== 'undefined') {
            content += "<div class='post-description'>" + post.description + "</div>";
        }
        if (typeof post.caption !== 'undefined') {
            content += "<div class='post-caption'>" + post.caption + "</div>";
        }
        if (typeof post.source !== 'undefined') {
            content += post.source;
        }

        var post_data = {
            'type': post.type,
            'date': post.date,
            'link': post.short_url,
            'content': content
        };

        var rendered = $template.html();

        $.each(post_data, function (i, v) {
            var rg = "~!" + i;
            var r = new RegExp(rg, "g");
            rendered = template.replace(r, v);
        });

        return rendered;
    }

    function get(visibleBounds, callback) {
        var sw = visibleBounds.getSouthWest(),
            ne = visibleBounds.getNorthEast(),
            url = "/posts/" + sw.lat() + "/" + sw.lng() + "/" + ne.lat() + "/" + ne.lng();

        if (!throttle) {
            $.getJSON(url, function (data) {
                throttle = true;
                window.setTimeout(function () {
                    throttle = false;
                }, throttle_interval);

                var _iteratorNormalCompletion = true;
                var _didIteratorError = false;
                var _iteratorError = undefined;

                try {
                    var _loop = function () {
                        var post = _step.value;

                        post.markerType = (function () {
                            if (post.tags.find(function (x) {
                                return x === "videos";
                            })) {
                                return 'video';
                                // TODO: generic audio tag
                            } else if (post.tags.find(function (x) {
                                    return x === "stumblesome";
                                })) {
                                    return 'stumble';
                                } else {
                                    return 'random';
                                }
                        })();

                        post.isTextPost = text_posts.find(function (x) {
                            return x === post.type;
                        });
                    };

                    for (var _iterator = _getIterator(data), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                        _loop();
                    }
                } catch (err) {
                    _didIteratorError = true;
                    _iteratorError = err;
                } finally {
                    try {
                        if (!_iteratorNormalCompletion && _iterator["return"]) {
                            _iterator["return"]();
                        }
                    } finally {
                        if (_didIteratorError) {
                            throw _iteratorError;
                        }
                    }
                }

                callback(data);
            });
        }
    }

    // everything below this point manages post display behavior

    function display(post) {
        var small_swap_time = 130; // fade duration for content swaps

        if (div.$overlay.is(':hidden')) {
            div.$overlay.fadeIn('fast');

            // c.f. '@small' in styles
            // 'auto' fills screen when @small
            var mm = window.matchMedia("screen and (max-width: 31em)");
            width = mm.matches ? 'auto' : div.$overlay.css('min-width');
        } else {
            width = div.$overlay.css("width");
        }
        div.$overlay.find("*").fadeOut(small_swap_time).remove();

        var $post = renderTemplate(post, $('#post-template'));
        div.$overlay.html($post).removeClass().addClass(post.type);

        var $contents = div.$overlay.find("*"),
            waiting = true,
            $loading = null;

        if (!post.isTextPost) {
            div.$overlay.css("width", width);
            $contents.hide();

            window.setTimeout(function () {
                if (waiting) $loading = div.$overlay.append(loading_img).find("#loading");
            }, 300);

            $contents.load(function () {
                if ($loading) $loading.fadeOut(trivial).remove();
                div.$overlay.css("width", "auto");
                $contents.fadeIn(trivial);
                waiting = false;

                var $iframe = $contents.find('iframe');
                $iframe.mouseover(function () {
                    iframeMouseStatus.status = 'mouseover';
                    window.dispatchEvent(overlay_iframe_mouse);
                });
                $iframe.mouseout(function () {
                    iframeMouseStatus.status = 'mouseout';
                    window.dispatchEvent(overlay_iframe_mouse);
                });
            });
        } else {
            $contents.fadeIn(trivial); // for now, just fade in if text ...or instagram
        }

        status.visible = true;
        status.postType = post.type;
        status.content = $post;
        document.dispatchEvent(post_event);

        marker_clicked = true;
        window.setTimeout(function () {
            marker_clicked = false;
        }, 200);
    }

    // Close overlay when user clicks on the X
    return {
        setters: [function (_2) {
            gMap = _2;
        }, function (_) {
            _getIterator = _["default"];
        }, function (_3) {
            loading_img = _3["default"];
        }, function (_d) {
            $ = _d["default"];
        }, function (_e) {
            div = _e;
        }],
        execute: function () {
            /**
             * @module posts
             */

            "use strict";

            _export("renderTemplate", renderTemplate);

            _export("get", get);

            _export("display", display);

            throttle = false;
            throttle_interval = 500;
            text_posts = ['text', 'audio', 'link', 'quote'];
            display_status = {
                visible: false,
                postType: null,
                content: null
            };

            statusInvisible = function statusInvisible() {
                display_status.visible = false;
                display_status.postType = null;
                display_status.content = "";
            };

            post_event = new CustomEvent('post_overlay', {
                "bubbles": false,
                "cancelable": true,
                "detail": display_status
            });
            iframeMouseStatus = { status: null };
            overlay_iframe_mouse = new CustomEvent('overlay_iframe_mouse', {
                "bubbles": false,
                "cancelable": true,
                "detail": iframeMouseStatus
            });
            marker_clicked = false;
            width = 0;
            $(document).on('click', '.close-post', function (e) {
                e.preventDefault();
                width = 'auto';
                $(this).parent().fadeOut('fast', function () {
                    $(this).find("*").html("");
                });
                statusInvisible();
                document.dispatchEvent(post_event);
            });

            // Close overlay on mousedown over map, i.e., to move it.
            div.$map.mousedown(function () {
                window.setTimeout(function () {
                    if (div.$overlay.is(':visible') && div.$overlay.css('opacity') === '1' && marker_clicked === false) {
                        div.$overlay.fadeOut('fast', function () {
                            $(this).find("*").html("");
                        });
                        statusInvisible();
                        document.dispatchEvent(post_event);
                    }
                }, 150);
            });
        }
    };
});
$__System.registerDynamic("6c", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  "format cjs";
  var Froogaloop = (function() {
    function Froogaloop(iframe) {
      return new Froogaloop.fn.init(iframe);
    }
    var eventCallbacks = {},
        hasWindowEvent = false,
        isReady = false,
        slice = Array.prototype.slice,
        playerDomain = '';
    Froogaloop.fn = Froogaloop.prototype = {
      element: null,
      init: function(iframe) {
        if (typeof iframe === "string") {
          iframe = document.getElementById(iframe);
        }
        this.element = iframe;
        playerDomain = getDomainFromUrl(this.element.getAttribute('src'));
        return this;
      },
      api: function(method, valueOrCallback) {
        if (!this.element || !method) {
          return false;
        }
        var self = this,
            element = self.element,
            target_id = element.id !== '' ? element.id : null,
            params = !isFunction(valueOrCallback) ? valueOrCallback : null,
            callback = isFunction(valueOrCallback) ? valueOrCallback : null;
        if (callback) {
          storeCallback(method, callback, target_id);
        }
        postMessage(method, params, element);
        return self;
      },
      addEvent: function(eventName, callback) {
        if (!this.element) {
          return false;
        }
        var self = this,
            element = self.element,
            target_id = element.id !== '' ? element.id : null;
        storeCallback(eventName, callback, target_id);
        if (eventName != 'ready') {
          postMessage('addEventListener', eventName, element);
        } else if (eventName == 'ready' && isReady) {
          callback.call(null, target_id);
        }
        return self;
      },
      removeEvent: function(eventName) {
        if (!this.element) {
          return false;
        }
        var self = this,
            element = self.element,
            target_id = element.id !== '' ? element.id : null,
            removed = removeCallback(eventName, target_id);
        if (eventName != 'ready' && removed) {
          postMessage('removeEventListener', eventName, element);
        }
      }
    };
    function postMessage(method, params, target) {
      if (!target.contentWindow.postMessage) {
        return false;
      }
      var url = target.getAttribute('src').split('?')[0],
          data = JSON.stringify({
            method: method,
            value: params
          });
      if (url.substr(0, 2) === '//') {
        url = window.location.protocol + url;
      }
      target.contentWindow.postMessage(data, url);
    }
    function onMessageReceived(event) {
      var data,
          method;
      try {
        data = JSON.parse(event.data);
        method = data.event || data.method;
      } catch (e) {}
      if (method == 'ready' && !isReady) {
        isReady = true;
      }
      if (event.origin != playerDomain) {
        return false;
      }
      var value = data.value,
          eventData = data.data,
          target_id = target_id === '' ? null : data.player_id,
          callback = getCallback(method, target_id),
          params = [];
      if (!callback) {
        return false;
      }
      if (value !== undefined) {
        params.push(value);
      }
      if (eventData) {
        params.push(eventData);
      }
      if (target_id) {
        params.push(target_id);
      }
      return params.length > 0 ? callback.apply(null, params) : callback.call();
    }
    function storeCallback(eventName, callback, target_id) {
      if (target_id) {
        if (!eventCallbacks[target_id]) {
          eventCallbacks[target_id] = {};
        }
        eventCallbacks[target_id][eventName] = callback;
      } else {
        eventCallbacks[eventName] = callback;
      }
    }
    function getCallback(eventName, target_id) {
      if (target_id) {
        return eventCallbacks[target_id][eventName];
      } else {
        return eventCallbacks[eventName];
      }
    }
    function removeCallback(eventName, target_id) {
      if (target_id && eventCallbacks[target_id]) {
        if (!eventCallbacks[target_id][eventName]) {
          return false;
        }
        eventCallbacks[target_id][eventName] = null;
      } else {
        if (!eventCallbacks[eventName]) {
          return false;
        }
        eventCallbacks[eventName] = null;
      }
      return true;
    }
    function getDomainFromUrl(url) {
      if (url.substr(0, 2) === '//') {
        url = window.location.protocol + url;
      }
      var url_pieces = url.split('/'),
          domain_str = '';
      for (var i = 0,
          length = url_pieces.length; i < length; i++) {
        if (i < 3) {
          domain_str += url_pieces[i];
        } else {
          break;
        }
        if (i < 2) {
          domain_str += '/';
        }
      }
      return domain_str;
    }
    function isFunction(obj) {
      return !!(obj && obj.constructor && obj.call && obj.apply);
    }
    function isArray(obj) {
      return toString.call(obj) === '[object Array]';
    }
    Froogaloop.fn.init.prototype = Froogaloop.fn;
    if (window.addEventListener) {
      window.addEventListener('message', onMessageReceived, false);
    } else {
      window.attachEvent('onmessage', onMessageReceived);
    }
    return (window.Froogaloop = window.$f = Froogaloop);
  })();
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("6d", ["6c"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = req('6c');
  global.define = __define;
  return module.exports;
});

(function() {
var _removeDefine = $__System.get("@@amd-helpers").createDefine();
(function(global, factory) {
  if (typeof module === "object" && typeof module.exports === "object") {
    module.exports = global.document ? factory(global, true) : function(w) {
      if (!w.document) {
        throw new Error("jQuery requires a window with a document");
      }
      return factory(w);
    };
  } else {
    factory(global);
  }
}(typeof window !== "undefined" ? window : this, function(window, noGlobal) {
  var arr = [];
  var slice = arr.slice;
  var concat = arr.concat;
  var push = arr.push;
  var indexOf = arr.indexOf;
  var class2type = {};
  var toString = class2type.toString;
  var hasOwn = class2type.hasOwnProperty;
  var support = {};
  var document = window.document,
      version = "2.1.4",
      jQuery = function(selector, context) {
        return new jQuery.fn.init(selector, context);
      },
      rtrim = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,
      rmsPrefix = /^-ms-/,
      rdashAlpha = /-([\da-z])/gi,
      fcamelCase = function(all, letter) {
        return letter.toUpperCase();
      };
  jQuery.fn = jQuery.prototype = {
    jquery: version,
    constructor: jQuery,
    selector: "",
    length: 0,
    toArray: function() {
      return slice.call(this);
    },
    get: function(num) {
      return num != null ? (num < 0 ? this[num + this.length] : this[num]) : slice.call(this);
    },
    pushStack: function(elems) {
      var ret = jQuery.merge(this.constructor(), elems);
      ret.prevObject = this;
      ret.context = this.context;
      return ret;
    },
    each: function(callback, args) {
      return jQuery.each(this, callback, args);
    },
    map: function(callback) {
      return this.pushStack(jQuery.map(this, function(elem, i) {
        return callback.call(elem, i, elem);
      }));
    },
    slice: function() {
      return this.pushStack(slice.apply(this, arguments));
    },
    first: function() {
      return this.eq(0);
    },
    last: function() {
      return this.eq(-1);
    },
    eq: function(i) {
      var len = this.length,
          j = +i + (i < 0 ? len : 0);
      return this.pushStack(j >= 0 && j < len ? [this[j]] : []);
    },
    end: function() {
      return this.prevObject || this.constructor(null);
    },
    push: push,
    sort: arr.sort,
    splice: arr.splice
  };
  jQuery.extend = jQuery.fn.extend = function() {
    var options,
        name,
        src,
        copy,
        copyIsArray,
        clone,
        target = arguments[0] || {},
        i = 1,
        length = arguments.length,
        deep = false;
    if (typeof target === "boolean") {
      deep = target;
      target = arguments[i] || {};
      i++;
    }
    if (typeof target !== "object" && !jQuery.isFunction(target)) {
      target = {};
    }
    if (i === length) {
      target = this;
      i--;
    }
    for (; i < length; i++) {
      if ((options = arguments[i]) != null) {
        for (name in options) {
          src = target[name];
          copy = options[name];
          if (target === copy) {
            continue;
          }
          if (deep && copy && (jQuery.isPlainObject(copy) || (copyIsArray = jQuery.isArray(copy)))) {
            if (copyIsArray) {
              copyIsArray = false;
              clone = src && jQuery.isArray(src) ? src : [];
            } else {
              clone = src && jQuery.isPlainObject(src) ? src : {};
            }
            target[name] = jQuery.extend(deep, clone, copy);
          } else if (copy !== undefined) {
            target[name] = copy;
          }
        }
      }
    }
    return target;
  };
  jQuery.extend({
    expando: "jQuery" + (version + Math.random()).replace(/\D/g, ""),
    isReady: true,
    error: function(msg) {
      throw new Error(msg);
    },
    noop: function() {},
    isFunction: function(obj) {
      return jQuery.type(obj) === "function";
    },
    isArray: Array.isArray,
    isWindow: function(obj) {
      return obj != null && obj === obj.window;
    },
    isNumeric: function(obj) {
      return !jQuery.isArray(obj) && (obj - parseFloat(obj) + 1) >= 0;
    },
    isPlainObject: function(obj) {
      if (jQuery.type(obj) !== "object" || obj.nodeType || jQuery.isWindow(obj)) {
        return false;
      }
      if (obj.constructor && !hasOwn.call(obj.constructor.prototype, "isPrototypeOf")) {
        return false;
      }
      return true;
    },
    isEmptyObject: function(obj) {
      var name;
      for (name in obj) {
        return false;
      }
      return true;
    },
    type: function(obj) {
      if (obj == null) {
        return obj + "";
      }
      return typeof obj === "object" || typeof obj === "function" ? class2type[toString.call(obj)] || "object" : typeof obj;
    },
    globalEval: function(code) {
      var script,
          indirect = eval;
      code = jQuery.trim(code);
      if (code) {
        if (code.indexOf("use strict") === 1) {
          script = document.createElement("script");
          script.text = code;
          document.head.appendChild(script).parentNode.removeChild(script);
        } else {
          indirect(code);
        }
      }
    },
    camelCase: function(string) {
      return string.replace(rmsPrefix, "ms-").replace(rdashAlpha, fcamelCase);
    },
    nodeName: function(elem, name) {
      return elem.nodeName && elem.nodeName.toLowerCase() === name.toLowerCase();
    },
    each: function(obj, callback, args) {
      var value,
          i = 0,
          length = obj.length,
          isArray = isArraylike(obj);
      if (args) {
        if (isArray) {
          for (; i < length; i++) {
            value = callback.apply(obj[i], args);
            if (value === false) {
              break;
            }
          }
        } else {
          for (i in obj) {
            value = callback.apply(obj[i], args);
            if (value === false) {
              break;
            }
          }
        }
      } else {
        if (isArray) {
          for (; i < length; i++) {
            value = callback.call(obj[i], i, obj[i]);
            if (value === false) {
              break;
            }
          }
        } else {
          for (i in obj) {
            value = callback.call(obj[i], i, obj[i]);
            if (value === false) {
              break;
            }
          }
        }
      }
      return obj;
    },
    trim: function(text) {
      return text == null ? "" : (text + "").replace(rtrim, "");
    },
    makeArray: function(arr, results) {
      var ret = results || [];
      if (arr != null) {
        if (isArraylike(Object(arr))) {
          jQuery.merge(ret, typeof arr === "string" ? [arr] : arr);
        } else {
          push.call(ret, arr);
        }
      }
      return ret;
    },
    inArray: function(elem, arr, i) {
      return arr == null ? -1 : indexOf.call(arr, elem, i);
    },
    merge: function(first, second) {
      var len = +second.length,
          j = 0,
          i = first.length;
      for (; j < len; j++) {
        first[i++] = second[j];
      }
      first.length = i;
      return first;
    },
    grep: function(elems, callback, invert) {
      var callbackInverse,
          matches = [],
          i = 0,
          length = elems.length,
          callbackExpect = !invert;
      for (; i < length; i++) {
        callbackInverse = !callback(elems[i], i);
        if (callbackInverse !== callbackExpect) {
          matches.push(elems[i]);
        }
      }
      return matches;
    },
    map: function(elems, callback, arg) {
      var value,
          i = 0,
          length = elems.length,
          isArray = isArraylike(elems),
          ret = [];
      if (isArray) {
        for (; i < length; i++) {
          value = callback(elems[i], i, arg);
          if (value != null) {
            ret.push(value);
          }
        }
      } else {
        for (i in elems) {
          value = callback(elems[i], i, arg);
          if (value != null) {
            ret.push(value);
          }
        }
      }
      return concat.apply([], ret);
    },
    guid: 1,
    proxy: function(fn, context) {
      var tmp,
          args,
          proxy;
      if (typeof context === "string") {
        tmp = fn[context];
        context = fn;
        fn = tmp;
      }
      if (!jQuery.isFunction(fn)) {
        return undefined;
      }
      args = slice.call(arguments, 2);
      proxy = function() {
        return fn.apply(context || this, args.concat(slice.call(arguments)));
      };
      proxy.guid = fn.guid = fn.guid || jQuery.guid++;
      return proxy;
    },
    now: Date.now,
    support: support
  });
  jQuery.each("Boolean Number String Function Array Date RegExp Object Error".split(" "), function(i, name) {
    class2type["[object " + name + "]"] = name.toLowerCase();
  });
  function isArraylike(obj) {
    var length = "length" in obj && obj.length,
        type = jQuery.type(obj);
    if (type === "function" || jQuery.isWindow(obj)) {
      return false;
    }
    if (obj.nodeType === 1 && length) {
      return true;
    }
    return type === "array" || length === 0 || typeof length === "number" && length > 0 && (length - 1) in obj;
  }
  var Sizzle = (function(window) {
    var i,
        support,
        Expr,
        getText,
        isXML,
        tokenize,
        compile,
        select,
        outermostContext,
        sortInput,
        hasDuplicate,
        setDocument,
        document,
        docElem,
        documentIsHTML,
        rbuggyQSA,
        rbuggyMatches,
        matches,
        contains,
        expando = "sizzle" + 1 * new Date(),
        preferredDoc = window.document,
        dirruns = 0,
        done = 0,
        classCache = createCache(),
        tokenCache = createCache(),
        compilerCache = createCache(),
        sortOrder = function(a, b) {
          if (a === b) {
            hasDuplicate = true;
          }
          return 0;
        },
        MAX_NEGATIVE = 1 << 31,
        hasOwn = ({}).hasOwnProperty,
        arr = [],
        pop = arr.pop,
        push_native = arr.push,
        push = arr.push,
        slice = arr.slice,
        indexOf = function(list, elem) {
          var i = 0,
              len = list.length;
          for (; i < len; i++) {
            if (list[i] === elem) {
              return i;
            }
          }
          return -1;
        },
        booleans = "checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped",
        whitespace = "[\\x20\\t\\r\\n\\f]",
        characterEncoding = "(?:\\\\.|[\\w-]|[^\\x00-\\xa0])+",
        identifier = characterEncoding.replace("w", "w#"),
        attributes = "\\[" + whitespace + "*(" + characterEncoding + ")(?:" + whitespace + "*([*^$|!~]?=)" + whitespace + "*(?:'((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\"|(" + identifier + "))|)" + whitespace + "*\\]",
        pseudos = ":(" + characterEncoding + ")(?:\\((" + "('((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\")|" + "((?:\\\\.|[^\\\\()[\\]]|" + attributes + ")*)|" + ".*" + ")\\)|)",
        rwhitespace = new RegExp(whitespace + "+", "g"),
        rtrim = new RegExp("^" + whitespace + "+|((?:^|[^\\\\])(?:\\\\.)*)" + whitespace + "+$", "g"),
        rcomma = new RegExp("^" + whitespace + "*," + whitespace + "*"),
        rcombinators = new RegExp("^" + whitespace + "*([>+~]|" + whitespace + ")" + whitespace + "*"),
        rattributeQuotes = new RegExp("=" + whitespace + "*([^\\]'\"]*?)" + whitespace + "*\\]", "g"),
        rpseudo = new RegExp(pseudos),
        ridentifier = new RegExp("^" + identifier + "$"),
        matchExpr = {
          "ID": new RegExp("^#(" + characterEncoding + ")"),
          "CLASS": new RegExp("^\\.(" + characterEncoding + ")"),
          "TAG": new RegExp("^(" + characterEncoding.replace("w", "w*") + ")"),
          "ATTR": new RegExp("^" + attributes),
          "PSEUDO": new RegExp("^" + pseudos),
          "CHILD": new RegExp("^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\(" + whitespace + "*(even|odd|(([+-]|)(\\d*)n|)" + whitespace + "*(?:([+-]|)" + whitespace + "*(\\d+)|))" + whitespace + "*\\)|)", "i"),
          "bool": new RegExp("^(?:" + booleans + ")$", "i"),
          "needsContext": new RegExp("^" + whitespace + "*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\(" + whitespace + "*((?:-\\d)?\\d*)" + whitespace + "*\\)|)(?=[^-]|$)", "i")
        },
        rinputs = /^(?:input|select|textarea|button)$/i,
        rheader = /^h\d$/i,
        rnative = /^[^{]+\{\s*\[native \w/,
        rquickExpr = /^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,
        rsibling = /[+~]/,
        rescape = /'|\\/g,
        runescape = new RegExp("\\\\([\\da-f]{1,6}" + whitespace + "?|(" + whitespace + ")|.)", "ig"),
        funescape = function(_, escaped, escapedWhitespace) {
          var high = "0x" + escaped - 0x10000;
          return high !== high || escapedWhitespace ? escaped : high < 0 ? String.fromCharCode(high + 0x10000) : String.fromCharCode(high >> 10 | 0xD800, high & 0x3FF | 0xDC00);
        },
        unloadHandler = function() {
          setDocument();
        };
    try {
      push.apply((arr = slice.call(preferredDoc.childNodes)), preferredDoc.childNodes);
      arr[preferredDoc.childNodes.length].nodeType;
    } catch (e) {
      push = {apply: arr.length ? function(target, els) {
          push_native.apply(target, slice.call(els));
        } : function(target, els) {
          var j = target.length,
              i = 0;
          while ((target[j++] = els[i++])) {}
          target.length = j - 1;
        }};
    }
    function Sizzle(selector, context, results, seed) {
      var match,
          elem,
          m,
          nodeType,
          i,
          groups,
          old,
          nid,
          newContext,
          newSelector;
      if ((context ? context.ownerDocument || context : preferredDoc) !== document) {
        setDocument(context);
      }
      context = context || document;
      results = results || [];
      nodeType = context.nodeType;
      if (typeof selector !== "string" || !selector || nodeType !== 1 && nodeType !== 9 && nodeType !== 11) {
        return results;
      }
      if (!seed && documentIsHTML) {
        if (nodeType !== 11 && (match = rquickExpr.exec(selector))) {
          if ((m = match[1])) {
            if (nodeType === 9) {
              elem = context.getElementById(m);
              if (elem && elem.parentNode) {
                if (elem.id === m) {
                  results.push(elem);
                  return results;
                }
              } else {
                return results;
              }
            } else {
              if (context.ownerDocument && (elem = context.ownerDocument.getElementById(m)) && contains(context, elem) && elem.id === m) {
                results.push(elem);
                return results;
              }
            }
          } else if (match[2]) {
            push.apply(results, context.getElementsByTagName(selector));
            return results;
          } else if ((m = match[3]) && support.getElementsByClassName) {
            push.apply(results, context.getElementsByClassName(m));
            return results;
          }
        }
        if (support.qsa && (!rbuggyQSA || !rbuggyQSA.test(selector))) {
          nid = old = expando;
          newContext = context;
          newSelector = nodeType !== 1 && selector;
          if (nodeType === 1 && context.nodeName.toLowerCase() !== "object") {
            groups = tokenize(selector);
            if ((old = context.getAttribute("id"))) {
              nid = old.replace(rescape, "\\$&");
            } else {
              context.setAttribute("id", nid);
            }
            nid = "[id='" + nid + "'] ";
            i = groups.length;
            while (i--) {
              groups[i] = nid + toSelector(groups[i]);
            }
            newContext = rsibling.test(selector) && testContext(context.parentNode) || context;
            newSelector = groups.join(",");
          }
          if (newSelector) {
            try {
              push.apply(results, newContext.querySelectorAll(newSelector));
              return results;
            } catch (qsaError) {} finally {
              if (!old) {
                context.removeAttribute("id");
              }
            }
          }
        }
      }
      return select(selector.replace(rtrim, "$1"), context, results, seed);
    }
    function createCache() {
      var keys = [];
      function cache(key, value) {
        if (keys.push(key + " ") > Expr.cacheLength) {
          delete cache[keys.shift()];
        }
        return (cache[key + " "] = value);
      }
      return cache;
    }
    function markFunction(fn) {
      fn[expando] = true;
      return fn;
    }
    function assert(fn) {
      var div = document.createElement("div");
      try {
        return !!fn(div);
      } catch (e) {
        return false;
      } finally {
        if (div.parentNode) {
          div.parentNode.removeChild(div);
        }
        div = null;
      }
    }
    function addHandle(attrs, handler) {
      var arr = attrs.split("|"),
          i = attrs.length;
      while (i--) {
        Expr.attrHandle[arr[i]] = handler;
      }
    }
    function siblingCheck(a, b) {
      var cur = b && a,
          diff = cur && a.nodeType === 1 && b.nodeType === 1 && (~b.sourceIndex || MAX_NEGATIVE) - (~a.sourceIndex || MAX_NEGATIVE);
      if (diff) {
        return diff;
      }
      if (cur) {
        while ((cur = cur.nextSibling)) {
          if (cur === b) {
            return -1;
          }
        }
      }
      return a ? 1 : -1;
    }
    function createInputPseudo(type) {
      return function(elem) {
        var name = elem.nodeName.toLowerCase();
        return name === "input" && elem.type === type;
      };
    }
    function createButtonPseudo(type) {
      return function(elem) {
        var name = elem.nodeName.toLowerCase();
        return (name === "input" || name === "button") && elem.type === type;
      };
    }
    function createPositionalPseudo(fn) {
      return markFunction(function(argument) {
        argument = +argument;
        return markFunction(function(seed, matches) {
          var j,
              matchIndexes = fn([], seed.length, argument),
              i = matchIndexes.length;
          while (i--) {
            if (seed[(j = matchIndexes[i])]) {
              seed[j] = !(matches[j] = seed[j]);
            }
          }
        });
      });
    }
    function testContext(context) {
      return context && typeof context.getElementsByTagName !== "undefined" && context;
    }
    support = Sizzle.support = {};
    isXML = Sizzle.isXML = function(elem) {
      var documentElement = elem && (elem.ownerDocument || elem).documentElement;
      return documentElement ? documentElement.nodeName !== "HTML" : false;
    };
    setDocument = Sizzle.setDocument = function(node) {
      var hasCompare,
          parent,
          doc = node ? node.ownerDocument || node : preferredDoc;
      if (doc === document || doc.nodeType !== 9 || !doc.documentElement) {
        return document;
      }
      document = doc;
      docElem = doc.documentElement;
      parent = doc.defaultView;
      if (parent && parent !== parent.top) {
        if (parent.addEventListener) {
          parent.addEventListener("unload", unloadHandler, false);
        } else if (parent.attachEvent) {
          parent.attachEvent("onunload", unloadHandler);
        }
      }
      documentIsHTML = !isXML(doc);
      support.attributes = assert(function(div) {
        div.className = "i";
        return !div.getAttribute("className");
      });
      support.getElementsByTagName = assert(function(div) {
        div.appendChild(doc.createComment(""));
        return !div.getElementsByTagName("*").length;
      });
      support.getElementsByClassName = rnative.test(doc.getElementsByClassName);
      support.getById = assert(function(div) {
        docElem.appendChild(div).id = expando;
        return !doc.getElementsByName || !doc.getElementsByName(expando).length;
      });
      if (support.getById) {
        Expr.find["ID"] = function(id, context) {
          if (typeof context.getElementById !== "undefined" && documentIsHTML) {
            var m = context.getElementById(id);
            return m && m.parentNode ? [m] : [];
          }
        };
        Expr.filter["ID"] = function(id) {
          var attrId = id.replace(runescape, funescape);
          return function(elem) {
            return elem.getAttribute("id") === attrId;
          };
        };
      } else {
        delete Expr.find["ID"];
        Expr.filter["ID"] = function(id) {
          var attrId = id.replace(runescape, funescape);
          return function(elem) {
            var node = typeof elem.getAttributeNode !== "undefined" && elem.getAttributeNode("id");
            return node && node.value === attrId;
          };
        };
      }
      Expr.find["TAG"] = support.getElementsByTagName ? function(tag, context) {
        if (typeof context.getElementsByTagName !== "undefined") {
          return context.getElementsByTagName(tag);
        } else if (support.qsa) {
          return context.querySelectorAll(tag);
        }
      } : function(tag, context) {
        var elem,
            tmp = [],
            i = 0,
            results = context.getElementsByTagName(tag);
        if (tag === "*") {
          while ((elem = results[i++])) {
            if (elem.nodeType === 1) {
              tmp.push(elem);
            }
          }
          return tmp;
        }
        return results;
      };
      Expr.find["CLASS"] = support.getElementsByClassName && function(className, context) {
        if (documentIsHTML) {
          return context.getElementsByClassName(className);
        }
      };
      rbuggyMatches = [];
      rbuggyQSA = [];
      if ((support.qsa = rnative.test(doc.querySelectorAll))) {
        assert(function(div) {
          docElem.appendChild(div).innerHTML = "<a id='" + expando + "'></a>" + "<select id='" + expando + "-\f]' msallowcapture=''>" + "<option selected=''></option></select>";
          if (div.querySelectorAll("[msallowcapture^='']").length) {
            rbuggyQSA.push("[*^$]=" + whitespace + "*(?:''|\"\")");
          }
          if (!div.querySelectorAll("[selected]").length) {
            rbuggyQSA.push("\\[" + whitespace + "*(?:value|" + booleans + ")");
          }
          if (!div.querySelectorAll("[id~=" + expando + "-]").length) {
            rbuggyQSA.push("~=");
          }
          if (!div.querySelectorAll(":checked").length) {
            rbuggyQSA.push(":checked");
          }
          if (!div.querySelectorAll("a#" + expando + "+*").length) {
            rbuggyQSA.push(".#.+[+~]");
          }
        });
        assert(function(div) {
          var input = doc.createElement("input");
          input.setAttribute("type", "hidden");
          div.appendChild(input).setAttribute("name", "D");
          if (div.querySelectorAll("[name=d]").length) {
            rbuggyQSA.push("name" + whitespace + "*[*^$|!~]?=");
          }
          if (!div.querySelectorAll(":enabled").length) {
            rbuggyQSA.push(":enabled", ":disabled");
          }
          div.querySelectorAll("*,:x");
          rbuggyQSA.push(",.*:");
        });
      }
      if ((support.matchesSelector = rnative.test((matches = docElem.matches || docElem.webkitMatchesSelector || docElem.mozMatchesSelector || docElem.oMatchesSelector || docElem.msMatchesSelector)))) {
        assert(function(div) {
          support.disconnectedMatch = matches.call(div, "div");
          matches.call(div, "[s!='']:x");
          rbuggyMatches.push("!=", pseudos);
        });
      }
      rbuggyQSA = rbuggyQSA.length && new RegExp(rbuggyQSA.join("|"));
      rbuggyMatches = rbuggyMatches.length && new RegExp(rbuggyMatches.join("|"));
      hasCompare = rnative.test(docElem.compareDocumentPosition);
      contains = hasCompare || rnative.test(docElem.contains) ? function(a, b) {
        var adown = a.nodeType === 9 ? a.documentElement : a,
            bup = b && b.parentNode;
        return a === bup || !!(bup && bup.nodeType === 1 && (adown.contains ? adown.contains(bup) : a.compareDocumentPosition && a.compareDocumentPosition(bup) & 16));
      } : function(a, b) {
        if (b) {
          while ((b = b.parentNode)) {
            if (b === a) {
              return true;
            }
          }
        }
        return false;
      };
      sortOrder = hasCompare ? function(a, b) {
        if (a === b) {
          hasDuplicate = true;
          return 0;
        }
        var compare = !a.compareDocumentPosition - !b.compareDocumentPosition;
        if (compare) {
          return compare;
        }
        compare = (a.ownerDocument || a) === (b.ownerDocument || b) ? a.compareDocumentPosition(b) : 1;
        if (compare & 1 || (!support.sortDetached && b.compareDocumentPosition(a) === compare)) {
          if (a === doc || a.ownerDocument === preferredDoc && contains(preferredDoc, a)) {
            return -1;
          }
          if (b === doc || b.ownerDocument === preferredDoc && contains(preferredDoc, b)) {
            return 1;
          }
          return sortInput ? (indexOf(sortInput, a) - indexOf(sortInput, b)) : 0;
        }
        return compare & 4 ? -1 : 1;
      } : function(a, b) {
        if (a === b) {
          hasDuplicate = true;
          return 0;
        }
        var cur,
            i = 0,
            aup = a.parentNode,
            bup = b.parentNode,
            ap = [a],
            bp = [b];
        if (!aup || !bup) {
          return a === doc ? -1 : b === doc ? 1 : aup ? -1 : bup ? 1 : sortInput ? (indexOf(sortInput, a) - indexOf(sortInput, b)) : 0;
        } else if (aup === bup) {
          return siblingCheck(a, b);
        }
        cur = a;
        while ((cur = cur.parentNode)) {
          ap.unshift(cur);
        }
        cur = b;
        while ((cur = cur.parentNode)) {
          bp.unshift(cur);
        }
        while (ap[i] === bp[i]) {
          i++;
        }
        return i ? siblingCheck(ap[i], bp[i]) : ap[i] === preferredDoc ? -1 : bp[i] === preferredDoc ? 1 : 0;
      };
      return doc;
    };
    Sizzle.matches = function(expr, elements) {
      return Sizzle(expr, null, null, elements);
    };
    Sizzle.matchesSelector = function(elem, expr) {
      if ((elem.ownerDocument || elem) !== document) {
        setDocument(elem);
      }
      expr = expr.replace(rattributeQuotes, "='$1']");
      if (support.matchesSelector && documentIsHTML && (!rbuggyMatches || !rbuggyMatches.test(expr)) && (!rbuggyQSA || !rbuggyQSA.test(expr))) {
        try {
          var ret = matches.call(elem, expr);
          if (ret || support.disconnectedMatch || elem.document && elem.document.nodeType !== 11) {
            return ret;
          }
        } catch (e) {}
      }
      return Sizzle(expr, document, null, [elem]).length > 0;
    };
    Sizzle.contains = function(context, elem) {
      if ((context.ownerDocument || context) !== document) {
        setDocument(context);
      }
      return contains(context, elem);
    };
    Sizzle.attr = function(elem, name) {
      if ((elem.ownerDocument || elem) !== document) {
        setDocument(elem);
      }
      var fn = Expr.attrHandle[name.toLowerCase()],
          val = fn && hasOwn.call(Expr.attrHandle, name.toLowerCase()) ? fn(elem, name, !documentIsHTML) : undefined;
      return val !== undefined ? val : support.attributes || !documentIsHTML ? elem.getAttribute(name) : (val = elem.getAttributeNode(name)) && val.specified ? val.value : null;
    };
    Sizzle.error = function(msg) {
      throw new Error("Syntax error, unrecognized expression: " + msg);
    };
    Sizzle.uniqueSort = function(results) {
      var elem,
          duplicates = [],
          j = 0,
          i = 0;
      hasDuplicate = !support.detectDuplicates;
      sortInput = !support.sortStable && results.slice(0);
      results.sort(sortOrder);
      if (hasDuplicate) {
        while ((elem = results[i++])) {
          if (elem === results[i]) {
            j = duplicates.push(i);
          }
        }
        while (j--) {
          results.splice(duplicates[j], 1);
        }
      }
      sortInput = null;
      return results;
    };
    getText = Sizzle.getText = function(elem) {
      var node,
          ret = "",
          i = 0,
          nodeType = elem.nodeType;
      if (!nodeType) {
        while ((node = elem[i++])) {
          ret += getText(node);
        }
      } else if (nodeType === 1 || nodeType === 9 || nodeType === 11) {
        if (typeof elem.textContent === "string") {
          return elem.textContent;
        } else {
          for (elem = elem.firstChild; elem; elem = elem.nextSibling) {
            ret += getText(elem);
          }
        }
      } else if (nodeType === 3 || nodeType === 4) {
        return elem.nodeValue;
      }
      return ret;
    };
    Expr = Sizzle.selectors = {
      cacheLength: 50,
      createPseudo: markFunction,
      match: matchExpr,
      attrHandle: {},
      find: {},
      relative: {
        ">": {
          dir: "parentNode",
          first: true
        },
        " ": {dir: "parentNode"},
        "+": {
          dir: "previousSibling",
          first: true
        },
        "~": {dir: "previousSibling"}
      },
      preFilter: {
        "ATTR": function(match) {
          match[1] = match[1].replace(runescape, funescape);
          match[3] = (match[3] || match[4] || match[5] || "").replace(runescape, funescape);
          if (match[2] === "~=") {
            match[3] = " " + match[3] + " ";
          }
          return match.slice(0, 4);
        },
        "CHILD": function(match) {
          match[1] = match[1].toLowerCase();
          if (match[1].slice(0, 3) === "nth") {
            if (!match[3]) {
              Sizzle.error(match[0]);
            }
            match[4] = +(match[4] ? match[5] + (match[6] || 1) : 2 * (match[3] === "even" || match[3] === "odd"));
            match[5] = +((match[7] + match[8]) || match[3] === "odd");
          } else if (match[3]) {
            Sizzle.error(match[0]);
          }
          return match;
        },
        "PSEUDO": function(match) {
          var excess,
              unquoted = !match[6] && match[2];
          if (matchExpr["CHILD"].test(match[0])) {
            return null;
          }
          if (match[3]) {
            match[2] = match[4] || match[5] || "";
          } else if (unquoted && rpseudo.test(unquoted) && (excess = tokenize(unquoted, true)) && (excess = unquoted.indexOf(")", unquoted.length - excess) - unquoted.length)) {
            match[0] = match[0].slice(0, excess);
            match[2] = unquoted.slice(0, excess);
          }
          return match.slice(0, 3);
        }
      },
      filter: {
        "TAG": function(nodeNameSelector) {
          var nodeName = nodeNameSelector.replace(runescape, funescape).toLowerCase();
          return nodeNameSelector === "*" ? function() {
            return true;
          } : function(elem) {
            return elem.nodeName && elem.nodeName.toLowerCase() === nodeName;
          };
        },
        "CLASS": function(className) {
          var pattern = classCache[className + " "];
          return pattern || (pattern = new RegExp("(^|" + whitespace + ")" + className + "(" + whitespace + "|$)")) && classCache(className, function(elem) {
            return pattern.test(typeof elem.className === "string" && elem.className || typeof elem.getAttribute !== "undefined" && elem.getAttribute("class") || "");
          });
        },
        "ATTR": function(name, operator, check) {
          return function(elem) {
            var result = Sizzle.attr(elem, name);
            if (result == null) {
              return operator === "!=";
            }
            if (!operator) {
              return true;
            }
            result += "";
            return operator === "=" ? result === check : operator === "!=" ? result !== check : operator === "^=" ? check && result.indexOf(check) === 0 : operator === "*=" ? check && result.indexOf(check) > -1 : operator === "$=" ? check && result.slice(-check.length) === check : operator === "~=" ? (" " + result.replace(rwhitespace, " ") + " ").indexOf(check) > -1 : operator === "|=" ? result === check || result.slice(0, check.length + 1) === check + "-" : false;
          };
        },
        "CHILD": function(type, what, argument, first, last) {
          var simple = type.slice(0, 3) !== "nth",
              forward = type.slice(-4) !== "last",
              ofType = what === "of-type";
          return first === 1 && last === 0 ? function(elem) {
            return !!elem.parentNode;
          } : function(elem, context, xml) {
            var cache,
                outerCache,
                node,
                diff,
                nodeIndex,
                start,
                dir = simple !== forward ? "nextSibling" : "previousSibling",
                parent = elem.parentNode,
                name = ofType && elem.nodeName.toLowerCase(),
                useCache = !xml && !ofType;
            if (parent) {
              if (simple) {
                while (dir) {
                  node = elem;
                  while ((node = node[dir])) {
                    if (ofType ? node.nodeName.toLowerCase() === name : node.nodeType === 1) {
                      return false;
                    }
                  }
                  start = dir = type === "only" && !start && "nextSibling";
                }
                return true;
              }
              start = [forward ? parent.firstChild : parent.lastChild];
              if (forward && useCache) {
                outerCache = parent[expando] || (parent[expando] = {});
                cache = outerCache[type] || [];
                nodeIndex = cache[0] === dirruns && cache[1];
                diff = cache[0] === dirruns && cache[2];
                node = nodeIndex && parent.childNodes[nodeIndex];
                while ((node = ++nodeIndex && node && node[dir] || (diff = nodeIndex = 0) || start.pop())) {
                  if (node.nodeType === 1 && ++diff && node === elem) {
                    outerCache[type] = [dirruns, nodeIndex, diff];
                    break;
                  }
                }
              } else if (useCache && (cache = (elem[expando] || (elem[expando] = {}))[type]) && cache[0] === dirruns) {
                diff = cache[1];
              } else {
                while ((node = ++nodeIndex && node && node[dir] || (diff = nodeIndex = 0) || start.pop())) {
                  if ((ofType ? node.nodeName.toLowerCase() === name : node.nodeType === 1) && ++diff) {
                    if (useCache) {
                      (node[expando] || (node[expando] = {}))[type] = [dirruns, diff];
                    }
                    if (node === elem) {
                      break;
                    }
                  }
                }
              }
              diff -= last;
              return diff === first || (diff % first === 0 && diff / first >= 0);
            }
          };
        },
        "PSEUDO": function(pseudo, argument) {
          var args,
              fn = Expr.pseudos[pseudo] || Expr.setFilters[pseudo.toLowerCase()] || Sizzle.error("unsupported pseudo: " + pseudo);
          if (fn[expando]) {
            return fn(argument);
          }
          if (fn.length > 1) {
            args = [pseudo, pseudo, "", argument];
            return Expr.setFilters.hasOwnProperty(pseudo.toLowerCase()) ? markFunction(function(seed, matches) {
              var idx,
                  matched = fn(seed, argument),
                  i = matched.length;
              while (i--) {
                idx = indexOf(seed, matched[i]);
                seed[idx] = !(matches[idx] = matched[i]);
              }
            }) : function(elem) {
              return fn(elem, 0, args);
            };
          }
          return fn;
        }
      },
      pseudos: {
        "not": markFunction(function(selector) {
          var input = [],
              results = [],
              matcher = compile(selector.replace(rtrim, "$1"));
          return matcher[expando] ? markFunction(function(seed, matches, context, xml) {
            var elem,
                unmatched = matcher(seed, null, xml, []),
                i = seed.length;
            while (i--) {
              if ((elem = unmatched[i])) {
                seed[i] = !(matches[i] = elem);
              }
            }
          }) : function(elem, context, xml) {
            input[0] = elem;
            matcher(input, null, xml, results);
            input[0] = null;
            return !results.pop();
          };
        }),
        "has": markFunction(function(selector) {
          return function(elem) {
            return Sizzle(selector, elem).length > 0;
          };
        }),
        "contains": markFunction(function(text) {
          text = text.replace(runescape, funescape);
          return function(elem) {
            return (elem.textContent || elem.innerText || getText(elem)).indexOf(text) > -1;
          };
        }),
        "lang": markFunction(function(lang) {
          if (!ridentifier.test(lang || "")) {
            Sizzle.error("unsupported lang: " + lang);
          }
          lang = lang.replace(runescape, funescape).toLowerCase();
          return function(elem) {
            var elemLang;
            do {
              if ((elemLang = documentIsHTML ? elem.lang : elem.getAttribute("xml:lang") || elem.getAttribute("lang"))) {
                elemLang = elemLang.toLowerCase();
                return elemLang === lang || elemLang.indexOf(lang + "-") === 0;
              }
            } while ((elem = elem.parentNode) && elem.nodeType === 1);
            return false;
          };
        }),
        "target": function(elem) {
          var hash = window.location && window.location.hash;
          return hash && hash.slice(1) === elem.id;
        },
        "root": function(elem) {
          return elem === docElem;
        },
        "focus": function(elem) {
          return elem === document.activeElement && (!document.hasFocus || document.hasFocus()) && !!(elem.type || elem.href || ~elem.tabIndex);
        },
        "enabled": function(elem) {
          return elem.disabled === false;
        },
        "disabled": function(elem) {
          return elem.disabled === true;
        },
        "checked": function(elem) {
          var nodeName = elem.nodeName.toLowerCase();
          return (nodeName === "input" && !!elem.checked) || (nodeName === "option" && !!elem.selected);
        },
        "selected": function(elem) {
          if (elem.parentNode) {
            elem.parentNode.selectedIndex;
          }
          return elem.selected === true;
        },
        "empty": function(elem) {
          for (elem = elem.firstChild; elem; elem = elem.nextSibling) {
            if (elem.nodeType < 6) {
              return false;
            }
          }
          return true;
        },
        "parent": function(elem) {
          return !Expr.pseudos["empty"](elem);
        },
        "header": function(elem) {
          return rheader.test(elem.nodeName);
        },
        "input": function(elem) {
          return rinputs.test(elem.nodeName);
        },
        "button": function(elem) {
          var name = elem.nodeName.toLowerCase();
          return name === "input" && elem.type === "button" || name === "button";
        },
        "text": function(elem) {
          var attr;
          return elem.nodeName.toLowerCase() === "input" && elem.type === "text" && ((attr = elem.getAttribute("type")) == null || attr.toLowerCase() === "text");
        },
        "first": createPositionalPseudo(function() {
          return [0];
        }),
        "last": createPositionalPseudo(function(matchIndexes, length) {
          return [length - 1];
        }),
        "eq": createPositionalPseudo(function(matchIndexes, length, argument) {
          return [argument < 0 ? argument + length : argument];
        }),
        "even": createPositionalPseudo(function(matchIndexes, length) {
          var i = 0;
          for (; i < length; i += 2) {
            matchIndexes.push(i);
          }
          return matchIndexes;
        }),
        "odd": createPositionalPseudo(function(matchIndexes, length) {
          var i = 1;
          for (; i < length; i += 2) {
            matchIndexes.push(i);
          }
          return matchIndexes;
        }),
        "lt": createPositionalPseudo(function(matchIndexes, length, argument) {
          var i = argument < 0 ? argument + length : argument;
          for (; --i >= 0; ) {
            matchIndexes.push(i);
          }
          return matchIndexes;
        }),
        "gt": createPositionalPseudo(function(matchIndexes, length, argument) {
          var i = argument < 0 ? argument + length : argument;
          for (; ++i < length; ) {
            matchIndexes.push(i);
          }
          return matchIndexes;
        })
      }
    };
    Expr.pseudos["nth"] = Expr.pseudos["eq"];
    for (i in {
      radio: true,
      checkbox: true,
      file: true,
      password: true,
      image: true
    }) {
      Expr.pseudos[i] = createInputPseudo(i);
    }
    for (i in {
      submit: true,
      reset: true
    }) {
      Expr.pseudos[i] = createButtonPseudo(i);
    }
    function setFilters() {}
    setFilters.prototype = Expr.filters = Expr.pseudos;
    Expr.setFilters = new setFilters();
    tokenize = Sizzle.tokenize = function(selector, parseOnly) {
      var matched,
          match,
          tokens,
          type,
          soFar,
          groups,
          preFilters,
          cached = tokenCache[selector + " "];
      if (cached) {
        return parseOnly ? 0 : cached.slice(0);
      }
      soFar = selector;
      groups = [];
      preFilters = Expr.preFilter;
      while (soFar) {
        if (!matched || (match = rcomma.exec(soFar))) {
          if (match) {
            soFar = soFar.slice(match[0].length) || soFar;
          }
          groups.push((tokens = []));
        }
        matched = false;
        if ((match = rcombinators.exec(soFar))) {
          matched = match.shift();
          tokens.push({
            value: matched,
            type: match[0].replace(rtrim, " ")
          });
          soFar = soFar.slice(matched.length);
        }
        for (type in Expr.filter) {
          if ((match = matchExpr[type].exec(soFar)) && (!preFilters[type] || (match = preFilters[type](match)))) {
            matched = match.shift();
            tokens.push({
              value: matched,
              type: type,
              matches: match
            });
            soFar = soFar.slice(matched.length);
          }
        }
        if (!matched) {
          break;
        }
      }
      return parseOnly ? soFar.length : soFar ? Sizzle.error(selector) : tokenCache(selector, groups).slice(0);
    };
    function toSelector(tokens) {
      var i = 0,
          len = tokens.length,
          selector = "";
      for (; i < len; i++) {
        selector += tokens[i].value;
      }
      return selector;
    }
    function addCombinator(matcher, combinator, base) {
      var dir = combinator.dir,
          checkNonElements = base && dir === "parentNode",
          doneName = done++;
      return combinator.first ? function(elem, context, xml) {
        while ((elem = elem[dir])) {
          if (elem.nodeType === 1 || checkNonElements) {
            return matcher(elem, context, xml);
          }
        }
      } : function(elem, context, xml) {
        var oldCache,
            outerCache,
            newCache = [dirruns, doneName];
        if (xml) {
          while ((elem = elem[dir])) {
            if (elem.nodeType === 1 || checkNonElements) {
              if (matcher(elem, context, xml)) {
                return true;
              }
            }
          }
        } else {
          while ((elem = elem[dir])) {
            if (elem.nodeType === 1 || checkNonElements) {
              outerCache = elem[expando] || (elem[expando] = {});
              if ((oldCache = outerCache[dir]) && oldCache[0] === dirruns && oldCache[1] === doneName) {
                return (newCache[2] = oldCache[2]);
              } else {
                outerCache[dir] = newCache;
                if ((newCache[2] = matcher(elem, context, xml))) {
                  return true;
                }
              }
            }
          }
        }
      };
    }
    function elementMatcher(matchers) {
      return matchers.length > 1 ? function(elem, context, xml) {
        var i = matchers.length;
        while (i--) {
          if (!matchers[i](elem, context, xml)) {
            return false;
          }
        }
        return true;
      } : matchers[0];
    }
    function multipleContexts(selector, contexts, results) {
      var i = 0,
          len = contexts.length;
      for (; i < len; i++) {
        Sizzle(selector, contexts[i], results);
      }
      return results;
    }
    function condense(unmatched, map, filter, context, xml) {
      var elem,
          newUnmatched = [],
          i = 0,
          len = unmatched.length,
          mapped = map != null;
      for (; i < len; i++) {
        if ((elem = unmatched[i])) {
          if (!filter || filter(elem, context, xml)) {
            newUnmatched.push(elem);
            if (mapped) {
              map.push(i);
            }
          }
        }
      }
      return newUnmatched;
    }
    function setMatcher(preFilter, selector, matcher, postFilter, postFinder, postSelector) {
      if (postFilter && !postFilter[expando]) {
        postFilter = setMatcher(postFilter);
      }
      if (postFinder && !postFinder[expando]) {
        postFinder = setMatcher(postFinder, postSelector);
      }
      return markFunction(function(seed, results, context, xml) {
        var temp,
            i,
            elem,
            preMap = [],
            postMap = [],
            preexisting = results.length,
            elems = seed || multipleContexts(selector || "*", context.nodeType ? [context] : context, []),
            matcherIn = preFilter && (seed || !selector) ? condense(elems, preMap, preFilter, context, xml) : elems,
            matcherOut = matcher ? postFinder || (seed ? preFilter : preexisting || postFilter) ? [] : results : matcherIn;
        if (matcher) {
          matcher(matcherIn, matcherOut, context, xml);
        }
        if (postFilter) {
          temp = condense(matcherOut, postMap);
          postFilter(temp, [], context, xml);
          i = temp.length;
          while (i--) {
            if ((elem = temp[i])) {
              matcherOut[postMap[i]] = !(matcherIn[postMap[i]] = elem);
            }
          }
        }
        if (seed) {
          if (postFinder || preFilter) {
            if (postFinder) {
              temp = [];
              i = matcherOut.length;
              while (i--) {
                if ((elem = matcherOut[i])) {
                  temp.push((matcherIn[i] = elem));
                }
              }
              postFinder(null, (matcherOut = []), temp, xml);
            }
            i = matcherOut.length;
            while (i--) {
              if ((elem = matcherOut[i]) && (temp = postFinder ? indexOf(seed, elem) : preMap[i]) > -1) {
                seed[temp] = !(results[temp] = elem);
              }
            }
          }
        } else {
          matcherOut = condense(matcherOut === results ? matcherOut.splice(preexisting, matcherOut.length) : matcherOut);
          if (postFinder) {
            postFinder(null, results, matcherOut, xml);
          } else {
            push.apply(results, matcherOut);
          }
        }
      });
    }
    function matcherFromTokens(tokens) {
      var checkContext,
          matcher,
          j,
          len = tokens.length,
          leadingRelative = Expr.relative[tokens[0].type],
          implicitRelative = leadingRelative || Expr.relative[" "],
          i = leadingRelative ? 1 : 0,
          matchContext = addCombinator(function(elem) {
            return elem === checkContext;
          }, implicitRelative, true),
          matchAnyContext = addCombinator(function(elem) {
            return indexOf(checkContext, elem) > -1;
          }, implicitRelative, true),
          matchers = [function(elem, context, xml) {
            var ret = (!leadingRelative && (xml || context !== outermostContext)) || ((checkContext = context).nodeType ? matchContext(elem, context, xml) : matchAnyContext(elem, context, xml));
            checkContext = null;
            return ret;
          }];
      for (; i < len; i++) {
        if ((matcher = Expr.relative[tokens[i].type])) {
          matchers = [addCombinator(elementMatcher(matchers), matcher)];
        } else {
          matcher = Expr.filter[tokens[i].type].apply(null, tokens[i].matches);
          if (matcher[expando]) {
            j = ++i;
            for (; j < len; j++) {
              if (Expr.relative[tokens[j].type]) {
                break;
              }
            }
            return setMatcher(i > 1 && elementMatcher(matchers), i > 1 && toSelector(tokens.slice(0, i - 1).concat({value: tokens[i - 2].type === " " ? "*" : ""})).replace(rtrim, "$1"), matcher, i < j && matcherFromTokens(tokens.slice(i, j)), j < len && matcherFromTokens((tokens = tokens.slice(j))), j < len && toSelector(tokens));
          }
          matchers.push(matcher);
        }
      }
      return elementMatcher(matchers);
    }
    function matcherFromGroupMatchers(elementMatchers, setMatchers) {
      var bySet = setMatchers.length > 0,
          byElement = elementMatchers.length > 0,
          superMatcher = function(seed, context, xml, results, outermost) {
            var elem,
                j,
                matcher,
                matchedCount = 0,
                i = "0",
                unmatched = seed && [],
                setMatched = [],
                contextBackup = outermostContext,
                elems = seed || byElement && Expr.find["TAG"]("*", outermost),
                dirrunsUnique = (dirruns += contextBackup == null ? 1 : Math.random() || 0.1),
                len = elems.length;
            if (outermost) {
              outermostContext = context !== document && context;
            }
            for (; i !== len && (elem = elems[i]) != null; i++) {
              if (byElement && elem) {
                j = 0;
                while ((matcher = elementMatchers[j++])) {
                  if (matcher(elem, context, xml)) {
                    results.push(elem);
                    break;
                  }
                }
                if (outermost) {
                  dirruns = dirrunsUnique;
                }
              }
              if (bySet) {
                if ((elem = !matcher && elem)) {
                  matchedCount--;
                }
                if (seed) {
                  unmatched.push(elem);
                }
              }
            }
            matchedCount += i;
            if (bySet && i !== matchedCount) {
              j = 0;
              while ((matcher = setMatchers[j++])) {
                matcher(unmatched, setMatched, context, xml);
              }
              if (seed) {
                if (matchedCount > 0) {
                  while (i--) {
                    if (!(unmatched[i] || setMatched[i])) {
                      setMatched[i] = pop.call(results);
                    }
                  }
                }
                setMatched = condense(setMatched);
              }
              push.apply(results, setMatched);
              if (outermost && !seed && setMatched.length > 0 && (matchedCount + setMatchers.length) > 1) {
                Sizzle.uniqueSort(results);
              }
            }
            if (outermost) {
              dirruns = dirrunsUnique;
              outermostContext = contextBackup;
            }
            return unmatched;
          };
      return bySet ? markFunction(superMatcher) : superMatcher;
    }
    compile = Sizzle.compile = function(selector, match) {
      var i,
          setMatchers = [],
          elementMatchers = [],
          cached = compilerCache[selector + " "];
      if (!cached) {
        if (!match) {
          match = tokenize(selector);
        }
        i = match.length;
        while (i--) {
          cached = matcherFromTokens(match[i]);
          if (cached[expando]) {
            setMatchers.push(cached);
          } else {
            elementMatchers.push(cached);
          }
        }
        cached = compilerCache(selector, matcherFromGroupMatchers(elementMatchers, setMatchers));
        cached.selector = selector;
      }
      return cached;
    };
    select = Sizzle.select = function(selector, context, results, seed) {
      var i,
          tokens,
          token,
          type,
          find,
          compiled = typeof selector === "function" && selector,
          match = !seed && tokenize((selector = compiled.selector || selector));
      results = results || [];
      if (match.length === 1) {
        tokens = match[0] = match[0].slice(0);
        if (tokens.length > 2 && (token = tokens[0]).type === "ID" && support.getById && context.nodeType === 9 && documentIsHTML && Expr.relative[tokens[1].type]) {
          context = (Expr.find["ID"](token.matches[0].replace(runescape, funescape), context) || [])[0];
          if (!context) {
            return results;
          } else if (compiled) {
            context = context.parentNode;
          }
          selector = selector.slice(tokens.shift().value.length);
        }
        i = matchExpr["needsContext"].test(selector) ? 0 : tokens.length;
        while (i--) {
          token = tokens[i];
          if (Expr.relative[(type = token.type)]) {
            break;
          }
          if ((find = Expr.find[type])) {
            if ((seed = find(token.matches[0].replace(runescape, funescape), rsibling.test(tokens[0].type) && testContext(context.parentNode) || context))) {
              tokens.splice(i, 1);
              selector = seed.length && toSelector(tokens);
              if (!selector) {
                push.apply(results, seed);
                return results;
              }
              break;
            }
          }
        }
      }
      (compiled || compile(selector, match))(seed, context, !documentIsHTML, results, rsibling.test(selector) && testContext(context.parentNode) || context);
      return results;
    };
    support.sortStable = expando.split("").sort(sortOrder).join("") === expando;
    support.detectDuplicates = !!hasDuplicate;
    setDocument();
    support.sortDetached = assert(function(div1) {
      return div1.compareDocumentPosition(document.createElement("div")) & 1;
    });
    if (!assert(function(div) {
      div.innerHTML = "<a href='#'></a>";
      return div.firstChild.getAttribute("href") === "#";
    })) {
      addHandle("type|href|height|width", function(elem, name, isXML) {
        if (!isXML) {
          return elem.getAttribute(name, name.toLowerCase() === "type" ? 1 : 2);
        }
      });
    }
    if (!support.attributes || !assert(function(div) {
      div.innerHTML = "<input/>";
      div.firstChild.setAttribute("value", "");
      return div.firstChild.getAttribute("value") === "";
    })) {
      addHandle("value", function(elem, name, isXML) {
        if (!isXML && elem.nodeName.toLowerCase() === "input") {
          return elem.defaultValue;
        }
      });
    }
    if (!assert(function(div) {
      return div.getAttribute("disabled") == null;
    })) {
      addHandle(booleans, function(elem, name, isXML) {
        var val;
        if (!isXML) {
          return elem[name] === true ? name.toLowerCase() : (val = elem.getAttributeNode(name)) && val.specified ? val.value : null;
        }
      });
    }
    return Sizzle;
  })(window);
  jQuery.find = Sizzle;
  jQuery.expr = Sizzle.selectors;
  jQuery.expr[":"] = jQuery.expr.pseudos;
  jQuery.unique = Sizzle.uniqueSort;
  jQuery.text = Sizzle.getText;
  jQuery.isXMLDoc = Sizzle.isXML;
  jQuery.contains = Sizzle.contains;
  var rneedsContext = jQuery.expr.match.needsContext;
  var rsingleTag = (/^<(\w+)\s*\/?>(?:<\/\1>|)$/);
  var risSimple = /^.[^:#\[\.,]*$/;
  function winnow(elements, qualifier, not) {
    if (jQuery.isFunction(qualifier)) {
      return jQuery.grep(elements, function(elem, i) {
        return !!qualifier.call(elem, i, elem) !== not;
      });
    }
    if (qualifier.nodeType) {
      return jQuery.grep(elements, function(elem) {
        return (elem === qualifier) !== not;
      });
    }
    if (typeof qualifier === "string") {
      if (risSimple.test(qualifier)) {
        return jQuery.filter(qualifier, elements, not);
      }
      qualifier = jQuery.filter(qualifier, elements);
    }
    return jQuery.grep(elements, function(elem) {
      return (indexOf.call(qualifier, elem) >= 0) !== not;
    });
  }
  jQuery.filter = function(expr, elems, not) {
    var elem = elems[0];
    if (not) {
      expr = ":not(" + expr + ")";
    }
    return elems.length === 1 && elem.nodeType === 1 ? jQuery.find.matchesSelector(elem, expr) ? [elem] : [] : jQuery.find.matches(expr, jQuery.grep(elems, function(elem) {
      return elem.nodeType === 1;
    }));
  };
  jQuery.fn.extend({
    find: function(selector) {
      var i,
          len = this.length,
          ret = [],
          self = this;
      if (typeof selector !== "string") {
        return this.pushStack(jQuery(selector).filter(function() {
          for (i = 0; i < len; i++) {
            if (jQuery.contains(self[i], this)) {
              return true;
            }
          }
        }));
      }
      for (i = 0; i < len; i++) {
        jQuery.find(selector, self[i], ret);
      }
      ret = this.pushStack(len > 1 ? jQuery.unique(ret) : ret);
      ret.selector = this.selector ? this.selector + " " + selector : selector;
      return ret;
    },
    filter: function(selector) {
      return this.pushStack(winnow(this, selector || [], false));
    },
    not: function(selector) {
      return this.pushStack(winnow(this, selector || [], true));
    },
    is: function(selector) {
      return !!winnow(this, typeof selector === "string" && rneedsContext.test(selector) ? jQuery(selector) : selector || [], false).length;
    }
  });
  var rootjQuery,
      rquickExpr = /^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]*))$/,
      init = jQuery.fn.init = function(selector, context) {
        var match,
            elem;
        if (!selector) {
          return this;
        }
        if (typeof selector === "string") {
          if (selector[0] === "<" && selector[selector.length - 1] === ">" && selector.length >= 3) {
            match = [null, selector, null];
          } else {
            match = rquickExpr.exec(selector);
          }
          if (match && (match[1] || !context)) {
            if (match[1]) {
              context = context instanceof jQuery ? context[0] : context;
              jQuery.merge(this, jQuery.parseHTML(match[1], context && context.nodeType ? context.ownerDocument || context : document, true));
              if (rsingleTag.test(match[1]) && jQuery.isPlainObject(context)) {
                for (match in context) {
                  if (jQuery.isFunction(this[match])) {
                    this[match](context[match]);
                  } else {
                    this.attr(match, context[match]);
                  }
                }
              }
              return this;
            } else {
              elem = document.getElementById(match[2]);
              if (elem && elem.parentNode) {
                this.length = 1;
                this[0] = elem;
              }
              this.context = document;
              this.selector = selector;
              return this;
            }
          } else if (!context || context.jquery) {
            return (context || rootjQuery).find(selector);
          } else {
            return this.constructor(context).find(selector);
          }
        } else if (selector.nodeType) {
          this.context = this[0] = selector;
          this.length = 1;
          return this;
        } else if (jQuery.isFunction(selector)) {
          return typeof rootjQuery.ready !== "undefined" ? rootjQuery.ready(selector) : selector(jQuery);
        }
        if (selector.selector !== undefined) {
          this.selector = selector.selector;
          this.context = selector.context;
        }
        return jQuery.makeArray(selector, this);
      };
  init.prototype = jQuery.fn;
  rootjQuery = jQuery(document);
  var rparentsprev = /^(?:parents|prev(?:Until|All))/,
      guaranteedUnique = {
        children: true,
        contents: true,
        next: true,
        prev: true
      };
  jQuery.extend({
    dir: function(elem, dir, until) {
      var matched = [],
          truncate = until !== undefined;
      while ((elem = elem[dir]) && elem.nodeType !== 9) {
        if (elem.nodeType === 1) {
          if (truncate && jQuery(elem).is(until)) {
            break;
          }
          matched.push(elem);
        }
      }
      return matched;
    },
    sibling: function(n, elem) {
      var matched = [];
      for (; n; n = n.nextSibling) {
        if (n.nodeType === 1 && n !== elem) {
          matched.push(n);
        }
      }
      return matched;
    }
  });
  jQuery.fn.extend({
    has: function(target) {
      var targets = jQuery(target, this),
          l = targets.length;
      return this.filter(function() {
        var i = 0;
        for (; i < l; i++) {
          if (jQuery.contains(this, targets[i])) {
            return true;
          }
        }
      });
    },
    closest: function(selectors, context) {
      var cur,
          i = 0,
          l = this.length,
          matched = [],
          pos = rneedsContext.test(selectors) || typeof selectors !== "string" ? jQuery(selectors, context || this.context) : 0;
      for (; i < l; i++) {
        for (cur = this[i]; cur && cur !== context; cur = cur.parentNode) {
          if (cur.nodeType < 11 && (pos ? pos.index(cur) > -1 : cur.nodeType === 1 && jQuery.find.matchesSelector(cur, selectors))) {
            matched.push(cur);
            break;
          }
        }
      }
      return this.pushStack(matched.length > 1 ? jQuery.unique(matched) : matched);
    },
    index: function(elem) {
      if (!elem) {
        return (this[0] && this[0].parentNode) ? this.first().prevAll().length : -1;
      }
      if (typeof elem === "string") {
        return indexOf.call(jQuery(elem), this[0]);
      }
      return indexOf.call(this, elem.jquery ? elem[0] : elem);
    },
    add: function(selector, context) {
      return this.pushStack(jQuery.unique(jQuery.merge(this.get(), jQuery(selector, context))));
    },
    addBack: function(selector) {
      return this.add(selector == null ? this.prevObject : this.prevObject.filter(selector));
    }
  });
  function sibling(cur, dir) {
    while ((cur = cur[dir]) && cur.nodeType !== 1) {}
    return cur;
  }
  jQuery.each({
    parent: function(elem) {
      var parent = elem.parentNode;
      return parent && parent.nodeType !== 11 ? parent : null;
    },
    parents: function(elem) {
      return jQuery.dir(elem, "parentNode");
    },
    parentsUntil: function(elem, i, until) {
      return jQuery.dir(elem, "parentNode", until);
    },
    next: function(elem) {
      return sibling(elem, "nextSibling");
    },
    prev: function(elem) {
      return sibling(elem, "previousSibling");
    },
    nextAll: function(elem) {
      return jQuery.dir(elem, "nextSibling");
    },
    prevAll: function(elem) {
      return jQuery.dir(elem, "previousSibling");
    },
    nextUntil: function(elem, i, until) {
      return jQuery.dir(elem, "nextSibling", until);
    },
    prevUntil: function(elem, i, until) {
      return jQuery.dir(elem, "previousSibling", until);
    },
    siblings: function(elem) {
      return jQuery.sibling((elem.parentNode || {}).firstChild, elem);
    },
    children: function(elem) {
      return jQuery.sibling(elem.firstChild);
    },
    contents: function(elem) {
      return elem.contentDocument || jQuery.merge([], elem.childNodes);
    }
  }, function(name, fn) {
    jQuery.fn[name] = function(until, selector) {
      var matched = jQuery.map(this, fn, until);
      if (name.slice(-5) !== "Until") {
        selector = until;
      }
      if (selector && typeof selector === "string") {
        matched = jQuery.filter(selector, matched);
      }
      if (this.length > 1) {
        if (!guaranteedUnique[name]) {
          jQuery.unique(matched);
        }
        if (rparentsprev.test(name)) {
          matched.reverse();
        }
      }
      return this.pushStack(matched);
    };
  });
  var rnotwhite = (/\S+/g);
  var optionsCache = {};
  function createOptions(options) {
    var object = optionsCache[options] = {};
    jQuery.each(options.match(rnotwhite) || [], function(_, flag) {
      object[flag] = true;
    });
    return object;
  }
  jQuery.Callbacks = function(options) {
    options = typeof options === "string" ? (optionsCache[options] || createOptions(options)) : jQuery.extend({}, options);
    var memory,
        fired,
        firing,
        firingStart,
        firingLength,
        firingIndex,
        list = [],
        stack = !options.once && [],
        fire = function(data) {
          memory = options.memory && data;
          fired = true;
          firingIndex = firingStart || 0;
          firingStart = 0;
          firingLength = list.length;
          firing = true;
          for (; list && firingIndex < firingLength; firingIndex++) {
            if (list[firingIndex].apply(data[0], data[1]) === false && options.stopOnFalse) {
              memory = false;
              break;
            }
          }
          firing = false;
          if (list) {
            if (stack) {
              if (stack.length) {
                fire(stack.shift());
              }
            } else if (memory) {
              list = [];
            } else {
              self.disable();
            }
          }
        },
        self = {
          add: function() {
            if (list) {
              var start = list.length;
              (function add(args) {
                jQuery.each(args, function(_, arg) {
                  var type = jQuery.type(arg);
                  if (type === "function") {
                    if (!options.unique || !self.has(arg)) {
                      list.push(arg);
                    }
                  } else if (arg && arg.length && type !== "string") {
                    add(arg);
                  }
                });
              })(arguments);
              if (firing) {
                firingLength = list.length;
              } else if (memory) {
                firingStart = start;
                fire(memory);
              }
            }
            return this;
          },
          remove: function() {
            if (list) {
              jQuery.each(arguments, function(_, arg) {
                var index;
                while ((index = jQuery.inArray(arg, list, index)) > -1) {
                  list.splice(index, 1);
                  if (firing) {
                    if (index <= firingLength) {
                      firingLength--;
                    }
                    if (index <= firingIndex) {
                      firingIndex--;
                    }
                  }
                }
              });
            }
            return this;
          },
          has: function(fn) {
            return fn ? jQuery.inArray(fn, list) > -1 : !!(list && list.length);
          },
          empty: function() {
            list = [];
            firingLength = 0;
            return this;
          },
          disable: function() {
            list = stack = memory = undefined;
            return this;
          },
          disabled: function() {
            return !list;
          },
          lock: function() {
            stack = undefined;
            if (!memory) {
              self.disable();
            }
            return this;
          },
          locked: function() {
            return !stack;
          },
          fireWith: function(context, args) {
            if (list && (!fired || stack)) {
              args = args || [];
              args = [context, args.slice ? args.slice() : args];
              if (firing) {
                stack.push(args);
              } else {
                fire(args);
              }
            }
            return this;
          },
          fire: function() {
            self.fireWith(this, arguments);
            return this;
          },
          fired: function() {
            return !!fired;
          }
        };
    return self;
  };
  jQuery.extend({
    Deferred: function(func) {
      var tuples = [["resolve", "done", jQuery.Callbacks("once memory"), "resolved"], ["reject", "fail", jQuery.Callbacks("once memory"), "rejected"], ["notify", "progress", jQuery.Callbacks("memory")]],
          state = "pending",
          promise = {
            state: function() {
              return state;
            },
            always: function() {
              deferred.done(arguments).fail(arguments);
              return this;
            },
            then: function() {
              var fns = arguments;
              return jQuery.Deferred(function(newDefer) {
                jQuery.each(tuples, function(i, tuple) {
                  var fn = jQuery.isFunction(fns[i]) && fns[i];
                  deferred[tuple[1]](function() {
                    var returned = fn && fn.apply(this, arguments);
                    if (returned && jQuery.isFunction(returned.promise)) {
                      returned.promise().done(newDefer.resolve).fail(newDefer.reject).progress(newDefer.notify);
                    } else {
                      newDefer[tuple[0] + "With"](this === promise ? newDefer.promise() : this, fn ? [returned] : arguments);
                    }
                  });
                });
                fns = null;
              }).promise();
            },
            promise: function(obj) {
              return obj != null ? jQuery.extend(obj, promise) : promise;
            }
          },
          deferred = {};
      promise.pipe = promise.then;
      jQuery.each(tuples, function(i, tuple) {
        var list = tuple[2],
            stateString = tuple[3];
        promise[tuple[1]] = list.add;
        if (stateString) {
          list.add(function() {
            state = stateString;
          }, tuples[i ^ 1][2].disable, tuples[2][2].lock);
        }
        deferred[tuple[0]] = function() {
          deferred[tuple[0] + "With"](this === deferred ? promise : this, arguments);
          return this;
        };
        deferred[tuple[0] + "With"] = list.fireWith;
      });
      promise.promise(deferred);
      if (func) {
        func.call(deferred, deferred);
      }
      return deferred;
    },
    when: function(subordinate) {
      var i = 0,
          resolveValues = slice.call(arguments),
          length = resolveValues.length,
          remaining = length !== 1 || (subordinate && jQuery.isFunction(subordinate.promise)) ? length : 0,
          deferred = remaining === 1 ? subordinate : jQuery.Deferred(),
          updateFunc = function(i, contexts, values) {
            return function(value) {
              contexts[i] = this;
              values[i] = arguments.length > 1 ? slice.call(arguments) : value;
              if (values === progressValues) {
                deferred.notifyWith(contexts, values);
              } else if (!(--remaining)) {
                deferred.resolveWith(contexts, values);
              }
            };
          },
          progressValues,
          progressContexts,
          resolveContexts;
      if (length > 1) {
        progressValues = new Array(length);
        progressContexts = new Array(length);
        resolveContexts = new Array(length);
        for (; i < length; i++) {
          if (resolveValues[i] && jQuery.isFunction(resolveValues[i].promise)) {
            resolveValues[i].promise().done(updateFunc(i, resolveContexts, resolveValues)).fail(deferred.reject).progress(updateFunc(i, progressContexts, progressValues));
          } else {
            --remaining;
          }
        }
      }
      if (!remaining) {
        deferred.resolveWith(resolveContexts, resolveValues);
      }
      return deferred.promise();
    }
  });
  var readyList;
  jQuery.fn.ready = function(fn) {
    jQuery.ready.promise().done(fn);
    return this;
  };
  jQuery.extend({
    isReady: false,
    readyWait: 1,
    holdReady: function(hold) {
      if (hold) {
        jQuery.readyWait++;
      } else {
        jQuery.ready(true);
      }
    },
    ready: function(wait) {
      if (wait === true ? --jQuery.readyWait : jQuery.isReady) {
        return;
      }
      jQuery.isReady = true;
      if (wait !== true && --jQuery.readyWait > 0) {
        return;
      }
      readyList.resolveWith(document, [jQuery]);
      if (jQuery.fn.triggerHandler) {
        jQuery(document).triggerHandler("ready");
        jQuery(document).off("ready");
      }
    }
  });
  function completed() {
    document.removeEventListener("DOMContentLoaded", completed, false);
    window.removeEventListener("load", completed, false);
    jQuery.ready();
  }
  jQuery.ready.promise = function(obj) {
    if (!readyList) {
      readyList = jQuery.Deferred();
      if (document.readyState === "complete") {
        setTimeout(jQuery.ready);
      } else {
        document.addEventListener("DOMContentLoaded", completed, false);
        window.addEventListener("load", completed, false);
      }
    }
    return readyList.promise(obj);
  };
  jQuery.ready.promise();
  var access = jQuery.access = function(elems, fn, key, value, chainable, emptyGet, raw) {
    var i = 0,
        len = elems.length,
        bulk = key == null;
    if (jQuery.type(key) === "object") {
      chainable = true;
      for (i in key) {
        jQuery.access(elems, fn, i, key[i], true, emptyGet, raw);
      }
    } else if (value !== undefined) {
      chainable = true;
      if (!jQuery.isFunction(value)) {
        raw = true;
      }
      if (bulk) {
        if (raw) {
          fn.call(elems, value);
          fn = null;
        } else {
          bulk = fn;
          fn = function(elem, key, value) {
            return bulk.call(jQuery(elem), value);
          };
        }
      }
      if (fn) {
        for (; i < len; i++) {
          fn(elems[i], key, raw ? value : value.call(elems[i], i, fn(elems[i], key)));
        }
      }
    }
    return chainable ? elems : bulk ? fn.call(elems) : len ? fn(elems[0], key) : emptyGet;
  };
  jQuery.acceptData = function(owner) {
    return owner.nodeType === 1 || owner.nodeType === 9 || !(+owner.nodeType);
  };
  function Data() {
    Object.defineProperty(this.cache = {}, 0, {get: function() {
        return {};
      }});
    this.expando = jQuery.expando + Data.uid++;
  }
  Data.uid = 1;
  Data.accepts = jQuery.acceptData;
  Data.prototype = {
    key: function(owner) {
      if (!Data.accepts(owner)) {
        return 0;
      }
      var descriptor = {},
          unlock = owner[this.expando];
      if (!unlock) {
        unlock = Data.uid++;
        try {
          descriptor[this.expando] = {value: unlock};
          Object.defineProperties(owner, descriptor);
        } catch (e) {
          descriptor[this.expando] = unlock;
          jQuery.extend(owner, descriptor);
        }
      }
      if (!this.cache[unlock]) {
        this.cache[unlock] = {};
      }
      return unlock;
    },
    set: function(owner, data, value) {
      var prop,
          unlock = this.key(owner),
          cache = this.cache[unlock];
      if (typeof data === "string") {
        cache[data] = value;
      } else {
        if (jQuery.isEmptyObject(cache)) {
          jQuery.extend(this.cache[unlock], data);
        } else {
          for (prop in data) {
            cache[prop] = data[prop];
          }
        }
      }
      return cache;
    },
    get: function(owner, key) {
      var cache = this.cache[this.key(owner)];
      return key === undefined ? cache : cache[key];
    },
    access: function(owner, key, value) {
      var stored;
      if (key === undefined || ((key && typeof key === "string") && value === undefined)) {
        stored = this.get(owner, key);
        return stored !== undefined ? stored : this.get(owner, jQuery.camelCase(key));
      }
      this.set(owner, key, value);
      return value !== undefined ? value : key;
    },
    remove: function(owner, key) {
      var i,
          name,
          camel,
          unlock = this.key(owner),
          cache = this.cache[unlock];
      if (key === undefined) {
        this.cache[unlock] = {};
      } else {
        if (jQuery.isArray(key)) {
          name = key.concat(key.map(jQuery.camelCase));
        } else {
          camel = jQuery.camelCase(key);
          if (key in cache) {
            name = [key, camel];
          } else {
            name = camel;
            name = name in cache ? [name] : (name.match(rnotwhite) || []);
          }
        }
        i = name.length;
        while (i--) {
          delete cache[name[i]];
        }
      }
    },
    hasData: function(owner) {
      return !jQuery.isEmptyObject(this.cache[owner[this.expando]] || {});
    },
    discard: function(owner) {
      if (owner[this.expando]) {
        delete this.cache[owner[this.expando]];
      }
    }
  };
  var data_priv = new Data();
  var data_user = new Data();
  var rbrace = /^(?:\{[\w\W]*\}|\[[\w\W]*\])$/,
      rmultiDash = /([A-Z])/g;
  function dataAttr(elem, key, data) {
    var name;
    if (data === undefined && elem.nodeType === 1) {
      name = "data-" + key.replace(rmultiDash, "-$1").toLowerCase();
      data = elem.getAttribute(name);
      if (typeof data === "string") {
        try {
          data = data === "true" ? true : data === "false" ? false : data === "null" ? null : +data + "" === data ? +data : rbrace.test(data) ? jQuery.parseJSON(data) : data;
        } catch (e) {}
        data_user.set(elem, key, data);
      } else {
        data = undefined;
      }
    }
    return data;
  }
  jQuery.extend({
    hasData: function(elem) {
      return data_user.hasData(elem) || data_priv.hasData(elem);
    },
    data: function(elem, name, data) {
      return data_user.access(elem, name, data);
    },
    removeData: function(elem, name) {
      data_user.remove(elem, name);
    },
    _data: function(elem, name, data) {
      return data_priv.access(elem, name, data);
    },
    _removeData: function(elem, name) {
      data_priv.remove(elem, name);
    }
  });
  jQuery.fn.extend({
    data: function(key, value) {
      var i,
          name,
          data,
          elem = this[0],
          attrs = elem && elem.attributes;
      if (key === undefined) {
        if (this.length) {
          data = data_user.get(elem);
          if (elem.nodeType === 1 && !data_priv.get(elem, "hasDataAttrs")) {
            i = attrs.length;
            while (i--) {
              if (attrs[i]) {
                name = attrs[i].name;
                if (name.indexOf("data-") === 0) {
                  name = jQuery.camelCase(name.slice(5));
                  dataAttr(elem, name, data[name]);
                }
              }
            }
            data_priv.set(elem, "hasDataAttrs", true);
          }
        }
        return data;
      }
      if (typeof key === "object") {
        return this.each(function() {
          data_user.set(this, key);
        });
      }
      return access(this, function(value) {
        var data,
            camelKey = jQuery.camelCase(key);
        if (elem && value === undefined) {
          data = data_user.get(elem, key);
          if (data !== undefined) {
            return data;
          }
          data = data_user.get(elem, camelKey);
          if (data !== undefined) {
            return data;
          }
          data = dataAttr(elem, camelKey, undefined);
          if (data !== undefined) {
            return data;
          }
          return;
        }
        this.each(function() {
          var data = data_user.get(this, camelKey);
          data_user.set(this, camelKey, value);
          if (key.indexOf("-") !== -1 && data !== undefined) {
            data_user.set(this, key, value);
          }
        });
      }, null, value, arguments.length > 1, null, true);
    },
    removeData: function(key) {
      return this.each(function() {
        data_user.remove(this, key);
      });
    }
  });
  jQuery.extend({
    queue: function(elem, type, data) {
      var queue;
      if (elem) {
        type = (type || "fx") + "queue";
        queue = data_priv.get(elem, type);
        if (data) {
          if (!queue || jQuery.isArray(data)) {
            queue = data_priv.access(elem, type, jQuery.makeArray(data));
          } else {
            queue.push(data);
          }
        }
        return queue || [];
      }
    },
    dequeue: function(elem, type) {
      type = type || "fx";
      var queue = jQuery.queue(elem, type),
          startLength = queue.length,
          fn = queue.shift(),
          hooks = jQuery._queueHooks(elem, type),
          next = function() {
            jQuery.dequeue(elem, type);
          };
      if (fn === "inprogress") {
        fn = queue.shift();
        startLength--;
      }
      if (fn) {
        if (type === "fx") {
          queue.unshift("inprogress");
        }
        delete hooks.stop;
        fn.call(elem, next, hooks);
      }
      if (!startLength && hooks) {
        hooks.empty.fire();
      }
    },
    _queueHooks: function(elem, type) {
      var key = type + "queueHooks";
      return data_priv.get(elem, key) || data_priv.access(elem, key, {empty: jQuery.Callbacks("once memory").add(function() {
          data_priv.remove(elem, [type + "queue", key]);
        })});
    }
  });
  jQuery.fn.extend({
    queue: function(type, data) {
      var setter = 2;
      if (typeof type !== "string") {
        data = type;
        type = "fx";
        setter--;
      }
      if (arguments.length < setter) {
        return jQuery.queue(this[0], type);
      }
      return data === undefined ? this : this.each(function() {
        var queue = jQuery.queue(this, type, data);
        jQuery._queueHooks(this, type);
        if (type === "fx" && queue[0] !== "inprogress") {
          jQuery.dequeue(this, type);
        }
      });
    },
    dequeue: function(type) {
      return this.each(function() {
        jQuery.dequeue(this, type);
      });
    },
    clearQueue: function(type) {
      return this.queue(type || "fx", []);
    },
    promise: function(type, obj) {
      var tmp,
          count = 1,
          defer = jQuery.Deferred(),
          elements = this,
          i = this.length,
          resolve = function() {
            if (!(--count)) {
              defer.resolveWith(elements, [elements]);
            }
          };
      if (typeof type !== "string") {
        obj = type;
        type = undefined;
      }
      type = type || "fx";
      while (i--) {
        tmp = data_priv.get(elements[i], type + "queueHooks");
        if (tmp && tmp.empty) {
          count++;
          tmp.empty.add(resolve);
        }
      }
      resolve();
      return defer.promise(obj);
    }
  });
  var pnum = (/[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/).source;
  var cssExpand = ["Top", "Right", "Bottom", "Left"];
  var isHidden = function(elem, el) {
    elem = el || elem;
    return jQuery.css(elem, "display") === "none" || !jQuery.contains(elem.ownerDocument, elem);
  };
  var rcheckableType = (/^(?:checkbox|radio)$/i);
  (function() {
    var fragment = document.createDocumentFragment(),
        div = fragment.appendChild(document.createElement("div")),
        input = document.createElement("input");
    input.setAttribute("type", "radio");
    input.setAttribute("checked", "checked");
    input.setAttribute("name", "t");
    div.appendChild(input);
    support.checkClone = div.cloneNode(true).cloneNode(true).lastChild.checked;
    div.innerHTML = "<textarea>x</textarea>";
    support.noCloneChecked = !!div.cloneNode(true).lastChild.defaultValue;
  })();
  var strundefined = typeof undefined;
  support.focusinBubbles = "onfocusin" in window;
  var rkeyEvent = /^key/,
      rmouseEvent = /^(?:mouse|pointer|contextmenu)|click/,
      rfocusMorph = /^(?:focusinfocus|focusoutblur)$/,
      rtypenamespace = /^([^.]*)(?:\.(.+)|)$/;
  function returnTrue() {
    return true;
  }
  function returnFalse() {
    return false;
  }
  function safeActiveElement() {
    try {
      return document.activeElement;
    } catch (err) {}
  }
  jQuery.event = {
    global: {},
    add: function(elem, types, handler, data, selector) {
      var handleObjIn,
          eventHandle,
          tmp,
          events,
          t,
          handleObj,
          special,
          handlers,
          type,
          namespaces,
          origType,
          elemData = data_priv.get(elem);
      if (!elemData) {
        return;
      }
      if (handler.handler) {
        handleObjIn = handler;
        handler = handleObjIn.handler;
        selector = handleObjIn.selector;
      }
      if (!handler.guid) {
        handler.guid = jQuery.guid++;
      }
      if (!(events = elemData.events)) {
        events = elemData.events = {};
      }
      if (!(eventHandle = elemData.handle)) {
        eventHandle = elemData.handle = function(e) {
          return typeof jQuery !== strundefined && jQuery.event.triggered !== e.type ? jQuery.event.dispatch.apply(elem, arguments) : undefined;
        };
      }
      types = (types || "").match(rnotwhite) || [""];
      t = types.length;
      while (t--) {
        tmp = rtypenamespace.exec(types[t]) || [];
        type = origType = tmp[1];
        namespaces = (tmp[2] || "").split(".").sort();
        if (!type) {
          continue;
        }
        special = jQuery.event.special[type] || {};
        type = (selector ? special.delegateType : special.bindType) || type;
        special = jQuery.event.special[type] || {};
        handleObj = jQuery.extend({
          type: type,
          origType: origType,
          data: data,
          handler: handler,
          guid: handler.guid,
          selector: selector,
          needsContext: selector && jQuery.expr.match.needsContext.test(selector),
          namespace: namespaces.join(".")
        }, handleObjIn);
        if (!(handlers = events[type])) {
          handlers = events[type] = [];
          handlers.delegateCount = 0;
          if (!special.setup || special.setup.call(elem, data, namespaces, eventHandle) === false) {
            if (elem.addEventListener) {
              elem.addEventListener(type, eventHandle, false);
            }
          }
        }
        if (special.add) {
          special.add.call(elem, handleObj);
          if (!handleObj.handler.guid) {
            handleObj.handler.guid = handler.guid;
          }
        }
        if (selector) {
          handlers.splice(handlers.delegateCount++, 0, handleObj);
        } else {
          handlers.push(handleObj);
        }
        jQuery.event.global[type] = true;
      }
    },
    remove: function(elem, types, handler, selector, mappedTypes) {
      var j,
          origCount,
          tmp,
          events,
          t,
          handleObj,
          special,
          handlers,
          type,
          namespaces,
          origType,
          elemData = data_priv.hasData(elem) && data_priv.get(elem);
      if (!elemData || !(events = elemData.events)) {
        return;
      }
      types = (types || "").match(rnotwhite) || [""];
      t = types.length;
      while (t--) {
        tmp = rtypenamespace.exec(types[t]) || [];
        type = origType = tmp[1];
        namespaces = (tmp[2] || "").split(".").sort();
        if (!type) {
          for (type in events) {
            jQuery.event.remove(elem, type + types[t], handler, selector, true);
          }
          continue;
        }
        special = jQuery.event.special[type] || {};
        type = (selector ? special.delegateType : special.bindType) || type;
        handlers = events[type] || [];
        tmp = tmp[2] && new RegExp("(^|\\.)" + namespaces.join("\\.(?:.*\\.|)") + "(\\.|$)");
        origCount = j = handlers.length;
        while (j--) {
          handleObj = handlers[j];
          if ((mappedTypes || origType === handleObj.origType) && (!handler || handler.guid === handleObj.guid) && (!tmp || tmp.test(handleObj.namespace)) && (!selector || selector === handleObj.selector || selector === "**" && handleObj.selector)) {
            handlers.splice(j, 1);
            if (handleObj.selector) {
              handlers.delegateCount--;
            }
            if (special.remove) {
              special.remove.call(elem, handleObj);
            }
          }
        }
        if (origCount && !handlers.length) {
          if (!special.teardown || special.teardown.call(elem, namespaces, elemData.handle) === false) {
            jQuery.removeEvent(elem, type, elemData.handle);
          }
          delete events[type];
        }
      }
      if (jQuery.isEmptyObject(events)) {
        delete elemData.handle;
        data_priv.remove(elem, "events");
      }
    },
    trigger: function(event, data, elem, onlyHandlers) {
      var i,
          cur,
          tmp,
          bubbleType,
          ontype,
          handle,
          special,
          eventPath = [elem || document],
          type = hasOwn.call(event, "type") ? event.type : event,
          namespaces = hasOwn.call(event, "namespace") ? event.namespace.split(".") : [];
      cur = tmp = elem = elem || document;
      if (elem.nodeType === 3 || elem.nodeType === 8) {
        return;
      }
      if (rfocusMorph.test(type + jQuery.event.triggered)) {
        return;
      }
      if (type.indexOf(".") >= 0) {
        namespaces = type.split(".");
        type = namespaces.shift();
        namespaces.sort();
      }
      ontype = type.indexOf(":") < 0 && "on" + type;
      event = event[jQuery.expando] ? event : new jQuery.Event(type, typeof event === "object" && event);
      event.isTrigger = onlyHandlers ? 2 : 3;
      event.namespace = namespaces.join(".");
      event.namespace_re = event.namespace ? new RegExp("(^|\\.)" + namespaces.join("\\.(?:.*\\.|)") + "(\\.|$)") : null;
      event.result = undefined;
      if (!event.target) {
        event.target = elem;
      }
      data = data == null ? [event] : jQuery.makeArray(data, [event]);
      special = jQuery.event.special[type] || {};
      if (!onlyHandlers && special.trigger && special.trigger.apply(elem, data) === false) {
        return;
      }
      if (!onlyHandlers && !special.noBubble && !jQuery.isWindow(elem)) {
        bubbleType = special.delegateType || type;
        if (!rfocusMorph.test(bubbleType + type)) {
          cur = cur.parentNode;
        }
        for (; cur; cur = cur.parentNode) {
          eventPath.push(cur);
          tmp = cur;
        }
        if (tmp === (elem.ownerDocument || document)) {
          eventPath.push(tmp.defaultView || tmp.parentWindow || window);
        }
      }
      i = 0;
      while ((cur = eventPath[i++]) && !event.isPropagationStopped()) {
        event.type = i > 1 ? bubbleType : special.bindType || type;
        handle = (data_priv.get(cur, "events") || {})[event.type] && data_priv.get(cur, "handle");
        if (handle) {
          handle.apply(cur, data);
        }
        handle = ontype && cur[ontype];
        if (handle && handle.apply && jQuery.acceptData(cur)) {
          event.result = handle.apply(cur, data);
          if (event.result === false) {
            event.preventDefault();
          }
        }
      }
      event.type = type;
      if (!onlyHandlers && !event.isDefaultPrevented()) {
        if ((!special._default || special._default.apply(eventPath.pop(), data) === false) && jQuery.acceptData(elem)) {
          if (ontype && jQuery.isFunction(elem[type]) && !jQuery.isWindow(elem)) {
            tmp = elem[ontype];
            if (tmp) {
              elem[ontype] = null;
            }
            jQuery.event.triggered = type;
            elem[type]();
            jQuery.event.triggered = undefined;
            if (tmp) {
              elem[ontype] = tmp;
            }
          }
        }
      }
      return event.result;
    },
    dispatch: function(event) {
      event = jQuery.event.fix(event);
      var i,
          j,
          ret,
          matched,
          handleObj,
          handlerQueue = [],
          args = slice.call(arguments),
          handlers = (data_priv.get(this, "events") || {})[event.type] || [],
          special = jQuery.event.special[event.type] || {};
      args[0] = event;
      event.delegateTarget = this;
      if (special.preDispatch && special.preDispatch.call(this, event) === false) {
        return;
      }
      handlerQueue = jQuery.event.handlers.call(this, event, handlers);
      i = 0;
      while ((matched = handlerQueue[i++]) && !event.isPropagationStopped()) {
        event.currentTarget = matched.elem;
        j = 0;
        while ((handleObj = matched.handlers[j++]) && !event.isImmediatePropagationStopped()) {
          if (!event.namespace_re || event.namespace_re.test(handleObj.namespace)) {
            event.handleObj = handleObj;
            event.data = handleObj.data;
            ret = ((jQuery.event.special[handleObj.origType] || {}).handle || handleObj.handler).apply(matched.elem, args);
            if (ret !== undefined) {
              if ((event.result = ret) === false) {
                event.preventDefault();
                event.stopPropagation();
              }
            }
          }
        }
      }
      if (special.postDispatch) {
        special.postDispatch.call(this, event);
      }
      return event.result;
    },
    handlers: function(event, handlers) {
      var i,
          matches,
          sel,
          handleObj,
          handlerQueue = [],
          delegateCount = handlers.delegateCount,
          cur = event.target;
      if (delegateCount && cur.nodeType && (!event.button || event.type !== "click")) {
        for (; cur !== this; cur = cur.parentNode || this) {
          if (cur.disabled !== true || event.type !== "click") {
            matches = [];
            for (i = 0; i < delegateCount; i++) {
              handleObj = handlers[i];
              sel = handleObj.selector + " ";
              if (matches[sel] === undefined) {
                matches[sel] = handleObj.needsContext ? jQuery(sel, this).index(cur) >= 0 : jQuery.find(sel, this, null, [cur]).length;
              }
              if (matches[sel]) {
                matches.push(handleObj);
              }
            }
            if (matches.length) {
              handlerQueue.push({
                elem: cur,
                handlers: matches
              });
            }
          }
        }
      }
      if (delegateCount < handlers.length) {
        handlerQueue.push({
          elem: this,
          handlers: handlers.slice(delegateCount)
        });
      }
      return handlerQueue;
    },
    props: "altKey bubbles cancelable ctrlKey currentTarget eventPhase metaKey relatedTarget shiftKey target timeStamp view which".split(" "),
    fixHooks: {},
    keyHooks: {
      props: "char charCode key keyCode".split(" "),
      filter: function(event, original) {
        if (event.which == null) {
          event.which = original.charCode != null ? original.charCode : original.keyCode;
        }
        return event;
      }
    },
    mouseHooks: {
      props: "button buttons clientX clientY offsetX offsetY pageX pageY screenX screenY toElement".split(" "),
      filter: function(event, original) {
        var eventDoc,
            doc,
            body,
            button = original.button;
        if (event.pageX == null && original.clientX != null) {
          eventDoc = event.target.ownerDocument || document;
          doc = eventDoc.documentElement;
          body = eventDoc.body;
          event.pageX = original.clientX + (doc && doc.scrollLeft || body && body.scrollLeft || 0) - (doc && doc.clientLeft || body && body.clientLeft || 0);
          event.pageY = original.clientY + (doc && doc.scrollTop || body && body.scrollTop || 0) - (doc && doc.clientTop || body && body.clientTop || 0);
        }
        if (!event.which && button !== undefined) {
          event.which = (button & 1 ? 1 : (button & 2 ? 3 : (button & 4 ? 2 : 0)));
        }
        return event;
      }
    },
    fix: function(event) {
      if (event[jQuery.expando]) {
        return event;
      }
      var i,
          prop,
          copy,
          type = event.type,
          originalEvent = event,
          fixHook = this.fixHooks[type];
      if (!fixHook) {
        this.fixHooks[type] = fixHook = rmouseEvent.test(type) ? this.mouseHooks : rkeyEvent.test(type) ? this.keyHooks : {};
      }
      copy = fixHook.props ? this.props.concat(fixHook.props) : this.props;
      event = new jQuery.Event(originalEvent);
      i = copy.length;
      while (i--) {
        prop = copy[i];
        event[prop] = originalEvent[prop];
      }
      if (!event.target) {
        event.target = document;
      }
      if (event.target.nodeType === 3) {
        event.target = event.target.parentNode;
      }
      return fixHook.filter ? fixHook.filter(event, originalEvent) : event;
    },
    special: {
      load: {noBubble: true},
      focus: {
        trigger: function() {
          if (this !== safeActiveElement() && this.focus) {
            this.focus();
            return false;
          }
        },
        delegateType: "focusin"
      },
      blur: {
        trigger: function() {
          if (this === safeActiveElement() && this.blur) {
            this.blur();
            return false;
          }
        },
        delegateType: "focusout"
      },
      click: {
        trigger: function() {
          if (this.type === "checkbox" && this.click && jQuery.nodeName(this, "input")) {
            this.click();
            return false;
          }
        },
        _default: function(event) {
          return jQuery.nodeName(event.target, "a");
        }
      },
      beforeunload: {postDispatch: function(event) {
          if (event.result !== undefined && event.originalEvent) {
            event.originalEvent.returnValue = event.result;
          }
        }}
    },
    simulate: function(type, elem, event, bubble) {
      var e = jQuery.extend(new jQuery.Event(), event, {
        type: type,
        isSimulated: true,
        originalEvent: {}
      });
      if (bubble) {
        jQuery.event.trigger(e, null, elem);
      } else {
        jQuery.event.dispatch.call(elem, e);
      }
      if (e.isDefaultPrevented()) {
        event.preventDefault();
      }
    }
  };
  jQuery.removeEvent = function(elem, type, handle) {
    if (elem.removeEventListener) {
      elem.removeEventListener(type, handle, false);
    }
  };
  jQuery.Event = function(src, props) {
    if (!(this instanceof jQuery.Event)) {
      return new jQuery.Event(src, props);
    }
    if (src && src.type) {
      this.originalEvent = src;
      this.type = src.type;
      this.isDefaultPrevented = src.defaultPrevented || src.defaultPrevented === undefined && src.returnValue === false ? returnTrue : returnFalse;
    } else {
      this.type = src;
    }
    if (props) {
      jQuery.extend(this, props);
    }
    this.timeStamp = src && src.timeStamp || jQuery.now();
    this[jQuery.expando] = true;
  };
  jQuery.Event.prototype = {
    isDefaultPrevented: returnFalse,
    isPropagationStopped: returnFalse,
    isImmediatePropagationStopped: returnFalse,
    preventDefault: function() {
      var e = this.originalEvent;
      this.isDefaultPrevented = returnTrue;
      if (e && e.preventDefault) {
        e.preventDefault();
      }
    },
    stopPropagation: function() {
      var e = this.originalEvent;
      this.isPropagationStopped = returnTrue;
      if (e && e.stopPropagation) {
        e.stopPropagation();
      }
    },
    stopImmediatePropagation: function() {
      var e = this.originalEvent;
      this.isImmediatePropagationStopped = returnTrue;
      if (e && e.stopImmediatePropagation) {
        e.stopImmediatePropagation();
      }
      this.stopPropagation();
    }
  };
  jQuery.each({
    mouseenter: "mouseover",
    mouseleave: "mouseout",
    pointerenter: "pointerover",
    pointerleave: "pointerout"
  }, function(orig, fix) {
    jQuery.event.special[orig] = {
      delegateType: fix,
      bindType: fix,
      handle: function(event) {
        var ret,
            target = this,
            related = event.relatedTarget,
            handleObj = event.handleObj;
        if (!related || (related !== target && !jQuery.contains(target, related))) {
          event.type = handleObj.origType;
          ret = handleObj.handler.apply(this, arguments);
          event.type = fix;
        }
        return ret;
      }
    };
  });
  if (!support.focusinBubbles) {
    jQuery.each({
      focus: "focusin",
      blur: "focusout"
    }, function(orig, fix) {
      var handler = function(event) {
        jQuery.event.simulate(fix, event.target, jQuery.event.fix(event), true);
      };
      jQuery.event.special[fix] = {
        setup: function() {
          var doc = this.ownerDocument || this,
              attaches = data_priv.access(doc, fix);
          if (!attaches) {
            doc.addEventListener(orig, handler, true);
          }
          data_priv.access(doc, fix, (attaches || 0) + 1);
        },
        teardown: function() {
          var doc = this.ownerDocument || this,
              attaches = data_priv.access(doc, fix) - 1;
          if (!attaches) {
            doc.removeEventListener(orig, handler, true);
            data_priv.remove(doc, fix);
          } else {
            data_priv.access(doc, fix, attaches);
          }
        }
      };
    });
  }
  jQuery.fn.extend({
    on: function(types, selector, data, fn, one) {
      var origFn,
          type;
      if (typeof types === "object") {
        if (typeof selector !== "string") {
          data = data || selector;
          selector = undefined;
        }
        for (type in types) {
          this.on(type, selector, data, types[type], one);
        }
        return this;
      }
      if (data == null && fn == null) {
        fn = selector;
        data = selector = undefined;
      } else if (fn == null) {
        if (typeof selector === "string") {
          fn = data;
          data = undefined;
        } else {
          fn = data;
          data = selector;
          selector = undefined;
        }
      }
      if (fn === false) {
        fn = returnFalse;
      } else if (!fn) {
        return this;
      }
      if (one === 1) {
        origFn = fn;
        fn = function(event) {
          jQuery().off(event);
          return origFn.apply(this, arguments);
        };
        fn.guid = origFn.guid || (origFn.guid = jQuery.guid++);
      }
      return this.each(function() {
        jQuery.event.add(this, types, fn, data, selector);
      });
    },
    one: function(types, selector, data, fn) {
      return this.on(types, selector, data, fn, 1);
    },
    off: function(types, selector, fn) {
      var handleObj,
          type;
      if (types && types.preventDefault && types.handleObj) {
        handleObj = types.handleObj;
        jQuery(types.delegateTarget).off(handleObj.namespace ? handleObj.origType + "." + handleObj.namespace : handleObj.origType, handleObj.selector, handleObj.handler);
        return this;
      }
      if (typeof types === "object") {
        for (type in types) {
          this.off(type, selector, types[type]);
        }
        return this;
      }
      if (selector === false || typeof selector === "function") {
        fn = selector;
        selector = undefined;
      }
      if (fn === false) {
        fn = returnFalse;
      }
      return this.each(function() {
        jQuery.event.remove(this, types, fn, selector);
      });
    },
    trigger: function(type, data) {
      return this.each(function() {
        jQuery.event.trigger(type, data, this);
      });
    },
    triggerHandler: function(type, data) {
      var elem = this[0];
      if (elem) {
        return jQuery.event.trigger(type, data, elem, true);
      }
    }
  });
  var rxhtmlTag = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/gi,
      rtagName = /<([\w:]+)/,
      rhtml = /<|&#?\w+;/,
      rnoInnerhtml = /<(?:script|style|link)/i,
      rchecked = /checked\s*(?:[^=]|=\s*.checked.)/i,
      rscriptType = /^$|\/(?:java|ecma)script/i,
      rscriptTypeMasked = /^true\/(.*)/,
      rcleanScript = /^\s*<!(?:\[CDATA\[|--)|(?:\]\]|--)>\s*$/g,
      wrapMap = {
        option: [1, "<select multiple='multiple'>", "</select>"],
        thead: [1, "<table>", "</table>"],
        col: [2, "<table><colgroup>", "</colgroup></table>"],
        tr: [2, "<table><tbody>", "</tbody></table>"],
        td: [3, "<table><tbody><tr>", "</tr></tbody></table>"],
        _default: [0, "", ""]
      };
  wrapMap.optgroup = wrapMap.option;
  wrapMap.tbody = wrapMap.tfoot = wrapMap.colgroup = wrapMap.caption = wrapMap.thead;
  wrapMap.th = wrapMap.td;
  function manipulationTarget(elem, content) {
    return jQuery.nodeName(elem, "table") && jQuery.nodeName(content.nodeType !== 11 ? content : content.firstChild, "tr") ? elem.getElementsByTagName("tbody")[0] || elem.appendChild(elem.ownerDocument.createElement("tbody")) : elem;
  }
  function disableScript(elem) {
    elem.type = (elem.getAttribute("type") !== null) + "/" + elem.type;
    return elem;
  }
  function restoreScript(elem) {
    var match = rscriptTypeMasked.exec(elem.type);
    if (match) {
      elem.type = match[1];
    } else {
      elem.removeAttribute("type");
    }
    return elem;
  }
  function setGlobalEval(elems, refElements) {
    var i = 0,
        l = elems.length;
    for (; i < l; i++) {
      data_priv.set(elems[i], "globalEval", !refElements || data_priv.get(refElements[i], "globalEval"));
    }
  }
  function cloneCopyEvent(src, dest) {
    var i,
        l,
        type,
        pdataOld,
        pdataCur,
        udataOld,
        udataCur,
        events;
    if (dest.nodeType !== 1) {
      return;
    }
    if (data_priv.hasData(src)) {
      pdataOld = data_priv.access(src);
      pdataCur = data_priv.set(dest, pdataOld);
      events = pdataOld.events;
      if (events) {
        delete pdataCur.handle;
        pdataCur.events = {};
        for (type in events) {
          for (i = 0, l = events[type].length; i < l; i++) {
            jQuery.event.add(dest, type, events[type][i]);
          }
        }
      }
    }
    if (data_user.hasData(src)) {
      udataOld = data_user.access(src);
      udataCur = jQuery.extend({}, udataOld);
      data_user.set(dest, udataCur);
    }
  }
  function getAll(context, tag) {
    var ret = context.getElementsByTagName ? context.getElementsByTagName(tag || "*") : context.querySelectorAll ? context.querySelectorAll(tag || "*") : [];
    return tag === undefined || tag && jQuery.nodeName(context, tag) ? jQuery.merge([context], ret) : ret;
  }
  function fixInput(src, dest) {
    var nodeName = dest.nodeName.toLowerCase();
    if (nodeName === "input" && rcheckableType.test(src.type)) {
      dest.checked = src.checked;
    } else if (nodeName === "input" || nodeName === "textarea") {
      dest.defaultValue = src.defaultValue;
    }
  }
  jQuery.extend({
    clone: function(elem, dataAndEvents, deepDataAndEvents) {
      var i,
          l,
          srcElements,
          destElements,
          clone = elem.cloneNode(true),
          inPage = jQuery.contains(elem.ownerDocument, elem);
      if (!support.noCloneChecked && (elem.nodeType === 1 || elem.nodeType === 11) && !jQuery.isXMLDoc(elem)) {
        destElements = getAll(clone);
        srcElements = getAll(elem);
        for (i = 0, l = srcElements.length; i < l; i++) {
          fixInput(srcElements[i], destElements[i]);
        }
      }
      if (dataAndEvents) {
        if (deepDataAndEvents) {
          srcElements = srcElements || getAll(elem);
          destElements = destElements || getAll(clone);
          for (i = 0, l = srcElements.length; i < l; i++) {
            cloneCopyEvent(srcElements[i], destElements[i]);
          }
        } else {
          cloneCopyEvent(elem, clone);
        }
      }
      destElements = getAll(clone, "script");
      if (destElements.length > 0) {
        setGlobalEval(destElements, !inPage && getAll(elem, "script"));
      }
      return clone;
    },
    buildFragment: function(elems, context, scripts, selection) {
      var elem,
          tmp,
          tag,
          wrap,
          contains,
          j,
          fragment = context.createDocumentFragment(),
          nodes = [],
          i = 0,
          l = elems.length;
      for (; i < l; i++) {
        elem = elems[i];
        if (elem || elem === 0) {
          if (jQuery.type(elem) === "object") {
            jQuery.merge(nodes, elem.nodeType ? [elem] : elem);
          } else if (!rhtml.test(elem)) {
            nodes.push(context.createTextNode(elem));
          } else {
            tmp = tmp || fragment.appendChild(context.createElement("div"));
            tag = (rtagName.exec(elem) || ["", ""])[1].toLowerCase();
            wrap = wrapMap[tag] || wrapMap._default;
            tmp.innerHTML = wrap[1] + elem.replace(rxhtmlTag, "<$1></$2>") + wrap[2];
            j = wrap[0];
            while (j--) {
              tmp = tmp.lastChild;
            }
            jQuery.merge(nodes, tmp.childNodes);
            tmp = fragment.firstChild;
            tmp.textContent = "";
          }
        }
      }
      fragment.textContent = "";
      i = 0;
      while ((elem = nodes[i++])) {
        if (selection && jQuery.inArray(elem, selection) !== -1) {
          continue;
        }
        contains = jQuery.contains(elem.ownerDocument, elem);
        tmp = getAll(fragment.appendChild(elem), "script");
        if (contains) {
          setGlobalEval(tmp);
        }
        if (scripts) {
          j = 0;
          while ((elem = tmp[j++])) {
            if (rscriptType.test(elem.type || "")) {
              scripts.push(elem);
            }
          }
        }
      }
      return fragment;
    },
    cleanData: function(elems) {
      var data,
          elem,
          type,
          key,
          special = jQuery.event.special,
          i = 0;
      for (; (elem = elems[i]) !== undefined; i++) {
        if (jQuery.acceptData(elem)) {
          key = elem[data_priv.expando];
          if (key && (data = data_priv.cache[key])) {
            if (data.events) {
              for (type in data.events) {
                if (special[type]) {
                  jQuery.event.remove(elem, type);
                } else {
                  jQuery.removeEvent(elem, type, data.handle);
                }
              }
            }
            if (data_priv.cache[key]) {
              delete data_priv.cache[key];
            }
          }
        }
        delete data_user.cache[elem[data_user.expando]];
      }
    }
  });
  jQuery.fn.extend({
    text: function(value) {
      return access(this, function(value) {
        return value === undefined ? jQuery.text(this) : this.empty().each(function() {
          if (this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9) {
            this.textContent = value;
          }
        });
      }, null, value, arguments.length);
    },
    append: function() {
      return this.domManip(arguments, function(elem) {
        if (this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9) {
          var target = manipulationTarget(this, elem);
          target.appendChild(elem);
        }
      });
    },
    prepend: function() {
      return this.domManip(arguments, function(elem) {
        if (this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9) {
          var target = manipulationTarget(this, elem);
          target.insertBefore(elem, target.firstChild);
        }
      });
    },
    before: function() {
      return this.domManip(arguments, function(elem) {
        if (this.parentNode) {
          this.parentNode.insertBefore(elem, this);
        }
      });
    },
    after: function() {
      return this.domManip(arguments, function(elem) {
        if (this.parentNode) {
          this.parentNode.insertBefore(elem, this.nextSibling);
        }
      });
    },
    remove: function(selector, keepData) {
      var elem,
          elems = selector ? jQuery.filter(selector, this) : this,
          i = 0;
      for (; (elem = elems[i]) != null; i++) {
        if (!keepData && elem.nodeType === 1) {
          jQuery.cleanData(getAll(elem));
        }
        if (elem.parentNode) {
          if (keepData && jQuery.contains(elem.ownerDocument, elem)) {
            setGlobalEval(getAll(elem, "script"));
          }
          elem.parentNode.removeChild(elem);
        }
      }
      return this;
    },
    empty: function() {
      var elem,
          i = 0;
      for (; (elem = this[i]) != null; i++) {
        if (elem.nodeType === 1) {
          jQuery.cleanData(getAll(elem, false));
          elem.textContent = "";
        }
      }
      return this;
    },
    clone: function(dataAndEvents, deepDataAndEvents) {
      dataAndEvents = dataAndEvents == null ? false : dataAndEvents;
      deepDataAndEvents = deepDataAndEvents == null ? dataAndEvents : deepDataAndEvents;
      return this.map(function() {
        return jQuery.clone(this, dataAndEvents, deepDataAndEvents);
      });
    },
    html: function(value) {
      return access(this, function(value) {
        var elem = this[0] || {},
            i = 0,
            l = this.length;
        if (value === undefined && elem.nodeType === 1) {
          return elem.innerHTML;
        }
        if (typeof value === "string" && !rnoInnerhtml.test(value) && !wrapMap[(rtagName.exec(value) || ["", ""])[1].toLowerCase()]) {
          value = value.replace(rxhtmlTag, "<$1></$2>");
          try {
            for (; i < l; i++) {
              elem = this[i] || {};
              if (elem.nodeType === 1) {
                jQuery.cleanData(getAll(elem, false));
                elem.innerHTML = value;
              }
            }
            elem = 0;
          } catch (e) {}
        }
        if (elem) {
          this.empty().append(value);
        }
      }, null, value, arguments.length);
    },
    replaceWith: function() {
      var arg = arguments[0];
      this.domManip(arguments, function(elem) {
        arg = this.parentNode;
        jQuery.cleanData(getAll(this));
        if (arg) {
          arg.replaceChild(elem, this);
        }
      });
      return arg && (arg.length || arg.nodeType) ? this : this.remove();
    },
    detach: function(selector) {
      return this.remove(selector, true);
    },
    domManip: function(args, callback) {
      args = concat.apply([], args);
      var fragment,
          first,
          scripts,
          hasScripts,
          node,
          doc,
          i = 0,
          l = this.length,
          set = this,
          iNoClone = l - 1,
          value = args[0],
          isFunction = jQuery.isFunction(value);
      if (isFunction || (l > 1 && typeof value === "string" && !support.checkClone && rchecked.test(value))) {
        return this.each(function(index) {
          var self = set.eq(index);
          if (isFunction) {
            args[0] = value.call(this, index, self.html());
          }
          self.domManip(args, callback);
        });
      }
      if (l) {
        fragment = jQuery.buildFragment(args, this[0].ownerDocument, false, this);
        first = fragment.firstChild;
        if (fragment.childNodes.length === 1) {
          fragment = first;
        }
        if (first) {
          scripts = jQuery.map(getAll(fragment, "script"), disableScript);
          hasScripts = scripts.length;
          for (; i < l; i++) {
            node = fragment;
            if (i !== iNoClone) {
              node = jQuery.clone(node, true, true);
              if (hasScripts) {
                jQuery.merge(scripts, getAll(node, "script"));
              }
            }
            callback.call(this[i], node, i);
          }
          if (hasScripts) {
            doc = scripts[scripts.length - 1].ownerDocument;
            jQuery.map(scripts, restoreScript);
            for (i = 0; i < hasScripts; i++) {
              node = scripts[i];
              if (rscriptType.test(node.type || "") && !data_priv.access(node, "globalEval") && jQuery.contains(doc, node)) {
                if (node.src) {
                  if (jQuery._evalUrl) {
                    jQuery._evalUrl(node.src);
                  }
                } else {
                  jQuery.globalEval(node.textContent.replace(rcleanScript, ""));
                }
              }
            }
          }
        }
      }
      return this;
    }
  });
  jQuery.each({
    appendTo: "append",
    prependTo: "prepend",
    insertBefore: "before",
    insertAfter: "after",
    replaceAll: "replaceWith"
  }, function(name, original) {
    jQuery.fn[name] = function(selector) {
      var elems,
          ret = [],
          insert = jQuery(selector),
          last = insert.length - 1,
          i = 0;
      for (; i <= last; i++) {
        elems = i === last ? this : this.clone(true);
        jQuery(insert[i])[original](elems);
        push.apply(ret, elems.get());
      }
      return this.pushStack(ret);
    };
  });
  var iframe,
      elemdisplay = {};
  function actualDisplay(name, doc) {
    var style,
        elem = jQuery(doc.createElement(name)).appendTo(doc.body),
        display = window.getDefaultComputedStyle && (style = window.getDefaultComputedStyle(elem[0])) ? style.display : jQuery.css(elem[0], "display");
    elem.detach();
    return display;
  }
  function defaultDisplay(nodeName) {
    var doc = document,
        display = elemdisplay[nodeName];
    if (!display) {
      display = actualDisplay(nodeName, doc);
      if (display === "none" || !display) {
        iframe = (iframe || jQuery("<iframe frameborder='0' width='0' height='0'/>")).appendTo(doc.documentElement);
        doc = iframe[0].contentDocument;
        doc.write();
        doc.close();
        display = actualDisplay(nodeName, doc);
        iframe.detach();
      }
      elemdisplay[nodeName] = display;
    }
    return display;
  }
  var rmargin = (/^margin/);
  var rnumnonpx = new RegExp("^(" + pnum + ")(?!px)[a-z%]+$", "i");
  var getStyles = function(elem) {
    if (elem.ownerDocument.defaultView.opener) {
      return elem.ownerDocument.defaultView.getComputedStyle(elem, null);
    }
    return window.getComputedStyle(elem, null);
  };
  function curCSS(elem, name, computed) {
    var width,
        minWidth,
        maxWidth,
        ret,
        style = elem.style;
    computed = computed || getStyles(elem);
    if (computed) {
      ret = computed.getPropertyValue(name) || computed[name];
    }
    if (computed) {
      if (ret === "" && !jQuery.contains(elem.ownerDocument, elem)) {
        ret = jQuery.style(elem, name);
      }
      if (rnumnonpx.test(ret) && rmargin.test(name)) {
        width = style.width;
        minWidth = style.minWidth;
        maxWidth = style.maxWidth;
        style.minWidth = style.maxWidth = style.width = ret;
        ret = computed.width;
        style.width = width;
        style.minWidth = minWidth;
        style.maxWidth = maxWidth;
      }
    }
    return ret !== undefined ? ret + "" : ret;
  }
  function addGetHookIf(conditionFn, hookFn) {
    return {get: function() {
        if (conditionFn()) {
          delete this.get;
          return;
        }
        return (this.get = hookFn).apply(this, arguments);
      }};
  }
  (function() {
    var pixelPositionVal,
        boxSizingReliableVal,
        docElem = document.documentElement,
        container = document.createElement("div"),
        div = document.createElement("div");
    if (!div.style) {
      return;
    }
    div.style.backgroundClip = "content-box";
    div.cloneNode(true).style.backgroundClip = "";
    support.clearCloneStyle = div.style.backgroundClip === "content-box";
    container.style.cssText = "border:0;width:0;height:0;top:0;left:-9999px;margin-top:1px;" + "position:absolute";
    container.appendChild(div);
    function computePixelPositionAndBoxSizingReliable() {
      div.style.cssText = "-webkit-box-sizing:border-box;-moz-box-sizing:border-box;" + "box-sizing:border-box;display:block;margin-top:1%;top:1%;" + "border:1px;padding:1px;width:4px;position:absolute";
      div.innerHTML = "";
      docElem.appendChild(container);
      var divStyle = window.getComputedStyle(div, null);
      pixelPositionVal = divStyle.top !== "1%";
      boxSizingReliableVal = divStyle.width === "4px";
      docElem.removeChild(container);
    }
    if (window.getComputedStyle) {
      jQuery.extend(support, {
        pixelPosition: function() {
          computePixelPositionAndBoxSizingReliable();
          return pixelPositionVal;
        },
        boxSizingReliable: function() {
          if (boxSizingReliableVal == null) {
            computePixelPositionAndBoxSizingReliable();
          }
          return boxSizingReliableVal;
        },
        reliableMarginRight: function() {
          var ret,
              marginDiv = div.appendChild(document.createElement("div"));
          marginDiv.style.cssText = div.style.cssText = "-webkit-box-sizing:content-box;-moz-box-sizing:content-box;" + "box-sizing:content-box;display:block;margin:0;border:0;padding:0";
          marginDiv.style.marginRight = marginDiv.style.width = "0";
          div.style.width = "1px";
          docElem.appendChild(container);
          ret = !parseFloat(window.getComputedStyle(marginDiv, null).marginRight);
          docElem.removeChild(container);
          div.removeChild(marginDiv);
          return ret;
        }
      });
    }
  })();
  jQuery.swap = function(elem, options, callback, args) {
    var ret,
        name,
        old = {};
    for (name in options) {
      old[name] = elem.style[name];
      elem.style[name] = options[name];
    }
    ret = callback.apply(elem, args || []);
    for (name in options) {
      elem.style[name] = old[name];
    }
    return ret;
  };
  var rdisplayswap = /^(none|table(?!-c[ea]).+)/,
      rnumsplit = new RegExp("^(" + pnum + ")(.*)$", "i"),
      rrelNum = new RegExp("^([+-])=(" + pnum + ")", "i"),
      cssShow = {
        position: "absolute",
        visibility: "hidden",
        display: "block"
      },
      cssNormalTransform = {
        letterSpacing: "0",
        fontWeight: "400"
      },
      cssPrefixes = ["Webkit", "O", "Moz", "ms"];
  function vendorPropName(style, name) {
    if (name in style) {
      return name;
    }
    var capName = name[0].toUpperCase() + name.slice(1),
        origName = name,
        i = cssPrefixes.length;
    while (i--) {
      name = cssPrefixes[i] + capName;
      if (name in style) {
        return name;
      }
    }
    return origName;
  }
  function setPositiveNumber(elem, value, subtract) {
    var matches = rnumsplit.exec(value);
    return matches ? Math.max(0, matches[1] - (subtract || 0)) + (matches[2] || "px") : value;
  }
  function augmentWidthOrHeight(elem, name, extra, isBorderBox, styles) {
    var i = extra === (isBorderBox ? "border" : "content") ? 4 : name === "width" ? 1 : 0,
        val = 0;
    for (; i < 4; i += 2) {
      if (extra === "margin") {
        val += jQuery.css(elem, extra + cssExpand[i], true, styles);
      }
      if (isBorderBox) {
        if (extra === "content") {
          val -= jQuery.css(elem, "padding" + cssExpand[i], true, styles);
        }
        if (extra !== "margin") {
          val -= jQuery.css(elem, "border" + cssExpand[i] + "Width", true, styles);
        }
      } else {
        val += jQuery.css(elem, "padding" + cssExpand[i], true, styles);
        if (extra !== "padding") {
          val += jQuery.css(elem, "border" + cssExpand[i] + "Width", true, styles);
        }
      }
    }
    return val;
  }
  function getWidthOrHeight(elem, name, extra) {
    var valueIsBorderBox = true,
        val = name === "width" ? elem.offsetWidth : elem.offsetHeight,
        styles = getStyles(elem),
        isBorderBox = jQuery.css(elem, "boxSizing", false, styles) === "border-box";
    if (val <= 0 || val == null) {
      val = curCSS(elem, name, styles);
      if (val < 0 || val == null) {
        val = elem.style[name];
      }
      if (rnumnonpx.test(val)) {
        return val;
      }
      valueIsBorderBox = isBorderBox && (support.boxSizingReliable() || val === elem.style[name]);
      val = parseFloat(val) || 0;
    }
    return (val + augmentWidthOrHeight(elem, name, extra || (isBorderBox ? "border" : "content"), valueIsBorderBox, styles)) + "px";
  }
  function showHide(elements, show) {
    var display,
        elem,
        hidden,
        values = [],
        index = 0,
        length = elements.length;
    for (; index < length; index++) {
      elem = elements[index];
      if (!elem.style) {
        continue;
      }
      values[index] = data_priv.get(elem, "olddisplay");
      display = elem.style.display;
      if (show) {
        if (!values[index] && display === "none") {
          elem.style.display = "";
        }
        if (elem.style.display === "" && isHidden(elem)) {
          values[index] = data_priv.access(elem, "olddisplay", defaultDisplay(elem.nodeName));
        }
      } else {
        hidden = isHidden(elem);
        if (display !== "none" || !hidden) {
          data_priv.set(elem, "olddisplay", hidden ? display : jQuery.css(elem, "display"));
        }
      }
    }
    for (index = 0; index < length; index++) {
      elem = elements[index];
      if (!elem.style) {
        continue;
      }
      if (!show || elem.style.display === "none" || elem.style.display === "") {
        elem.style.display = show ? values[index] || "" : "none";
      }
    }
    return elements;
  }
  jQuery.extend({
    cssHooks: {opacity: {get: function(elem, computed) {
          if (computed) {
            var ret = curCSS(elem, "opacity");
            return ret === "" ? "1" : ret;
          }
        }}},
    cssNumber: {
      "columnCount": true,
      "fillOpacity": true,
      "flexGrow": true,
      "flexShrink": true,
      "fontWeight": true,
      "lineHeight": true,
      "opacity": true,
      "order": true,
      "orphans": true,
      "widows": true,
      "zIndex": true,
      "zoom": true
    },
    cssProps: {"float": "cssFloat"},
    style: function(elem, name, value, extra) {
      if (!elem || elem.nodeType === 3 || elem.nodeType === 8 || !elem.style) {
        return;
      }
      var ret,
          type,
          hooks,
          origName = jQuery.camelCase(name),
          style = elem.style;
      name = jQuery.cssProps[origName] || (jQuery.cssProps[origName] = vendorPropName(style, origName));
      hooks = jQuery.cssHooks[name] || jQuery.cssHooks[origName];
      if (value !== undefined) {
        type = typeof value;
        if (type === "string" && (ret = rrelNum.exec(value))) {
          value = (ret[1] + 1) * ret[2] + parseFloat(jQuery.css(elem, name));
          type = "number";
        }
        if (value == null || value !== value) {
          return;
        }
        if (type === "number" && !jQuery.cssNumber[origName]) {
          value += "px";
        }
        if (!support.clearCloneStyle && value === "" && name.indexOf("background") === 0) {
          style[name] = "inherit";
        }
        if (!hooks || !("set" in hooks) || (value = hooks.set(elem, value, extra)) !== undefined) {
          style[name] = value;
        }
      } else {
        if (hooks && "get" in hooks && (ret = hooks.get(elem, false, extra)) !== undefined) {
          return ret;
        }
        return style[name];
      }
    },
    css: function(elem, name, extra, styles) {
      var val,
          num,
          hooks,
          origName = jQuery.camelCase(name);
      name = jQuery.cssProps[origName] || (jQuery.cssProps[origName] = vendorPropName(elem.style, origName));
      hooks = jQuery.cssHooks[name] || jQuery.cssHooks[origName];
      if (hooks && "get" in hooks) {
        val = hooks.get(elem, true, extra);
      }
      if (val === undefined) {
        val = curCSS(elem, name, styles);
      }
      if (val === "normal" && name in cssNormalTransform) {
        val = cssNormalTransform[name];
      }
      if (extra === "" || extra) {
        num = parseFloat(val);
        return extra === true || jQuery.isNumeric(num) ? num || 0 : val;
      }
      return val;
    }
  });
  jQuery.each(["height", "width"], function(i, name) {
    jQuery.cssHooks[name] = {
      get: function(elem, computed, extra) {
        if (computed) {
          return rdisplayswap.test(jQuery.css(elem, "display")) && elem.offsetWidth === 0 ? jQuery.swap(elem, cssShow, function() {
            return getWidthOrHeight(elem, name, extra);
          }) : getWidthOrHeight(elem, name, extra);
        }
      },
      set: function(elem, value, extra) {
        var styles = extra && getStyles(elem);
        return setPositiveNumber(elem, value, extra ? augmentWidthOrHeight(elem, name, extra, jQuery.css(elem, "boxSizing", false, styles) === "border-box", styles) : 0);
      }
    };
  });
  jQuery.cssHooks.marginRight = addGetHookIf(support.reliableMarginRight, function(elem, computed) {
    if (computed) {
      return jQuery.swap(elem, {"display": "inline-block"}, curCSS, [elem, "marginRight"]);
    }
  });
  jQuery.each({
    margin: "",
    padding: "",
    border: "Width"
  }, function(prefix, suffix) {
    jQuery.cssHooks[prefix + suffix] = {expand: function(value) {
        var i = 0,
            expanded = {},
            parts = typeof value === "string" ? value.split(" ") : [value];
        for (; i < 4; i++) {
          expanded[prefix + cssExpand[i] + suffix] = parts[i] || parts[i - 2] || parts[0];
        }
        return expanded;
      }};
    if (!rmargin.test(prefix)) {
      jQuery.cssHooks[prefix + suffix].set = setPositiveNumber;
    }
  });
  jQuery.fn.extend({
    css: function(name, value) {
      return access(this, function(elem, name, value) {
        var styles,
            len,
            map = {},
            i = 0;
        if (jQuery.isArray(name)) {
          styles = getStyles(elem);
          len = name.length;
          for (; i < len; i++) {
            map[name[i]] = jQuery.css(elem, name[i], false, styles);
          }
          return map;
        }
        return value !== undefined ? jQuery.style(elem, name, value) : jQuery.css(elem, name);
      }, name, value, arguments.length > 1);
    },
    show: function() {
      return showHide(this, true);
    },
    hide: function() {
      return showHide(this);
    },
    toggle: function(state) {
      if (typeof state === "boolean") {
        return state ? this.show() : this.hide();
      }
      return this.each(function() {
        if (isHidden(this)) {
          jQuery(this).show();
        } else {
          jQuery(this).hide();
        }
      });
    }
  });
  function Tween(elem, options, prop, end, easing) {
    return new Tween.prototype.init(elem, options, prop, end, easing);
  }
  jQuery.Tween = Tween;
  Tween.prototype = {
    constructor: Tween,
    init: function(elem, options, prop, end, easing, unit) {
      this.elem = elem;
      this.prop = prop;
      this.easing = easing || "swing";
      this.options = options;
      this.start = this.now = this.cur();
      this.end = end;
      this.unit = unit || (jQuery.cssNumber[prop] ? "" : "px");
    },
    cur: function() {
      var hooks = Tween.propHooks[this.prop];
      return hooks && hooks.get ? hooks.get(this) : Tween.propHooks._default.get(this);
    },
    run: function(percent) {
      var eased,
          hooks = Tween.propHooks[this.prop];
      if (this.options.duration) {
        this.pos = eased = jQuery.easing[this.easing](percent, this.options.duration * percent, 0, 1, this.options.duration);
      } else {
        this.pos = eased = percent;
      }
      this.now = (this.end - this.start) * eased + this.start;
      if (this.options.step) {
        this.options.step.call(this.elem, this.now, this);
      }
      if (hooks && hooks.set) {
        hooks.set(this);
      } else {
        Tween.propHooks._default.set(this);
      }
      return this;
    }
  };
  Tween.prototype.init.prototype = Tween.prototype;
  Tween.propHooks = {_default: {
      get: function(tween) {
        var result;
        if (tween.elem[tween.prop] != null && (!tween.elem.style || tween.elem.style[tween.prop] == null)) {
          return tween.elem[tween.prop];
        }
        result = jQuery.css(tween.elem, tween.prop, "");
        return !result || result === "auto" ? 0 : result;
      },
      set: function(tween) {
        if (jQuery.fx.step[tween.prop]) {
          jQuery.fx.step[tween.prop](tween);
        } else if (tween.elem.style && (tween.elem.style[jQuery.cssProps[tween.prop]] != null || jQuery.cssHooks[tween.prop])) {
          jQuery.style(tween.elem, tween.prop, tween.now + tween.unit);
        } else {
          tween.elem[tween.prop] = tween.now;
        }
      }
    }};
  Tween.propHooks.scrollTop = Tween.propHooks.scrollLeft = {set: function(tween) {
      if (tween.elem.nodeType && tween.elem.parentNode) {
        tween.elem[tween.prop] = tween.now;
      }
    }};
  jQuery.easing = {
    linear: function(p) {
      return p;
    },
    swing: function(p) {
      return 0.5 - Math.cos(p * Math.PI) / 2;
    }
  };
  jQuery.fx = Tween.prototype.init;
  jQuery.fx.step = {};
  var fxNow,
      timerId,
      rfxtypes = /^(?:toggle|show|hide)$/,
      rfxnum = new RegExp("^(?:([+-])=|)(" + pnum + ")([a-z%]*)$", "i"),
      rrun = /queueHooks$/,
      animationPrefilters = [defaultPrefilter],
      tweeners = {"*": [function(prop, value) {
          var tween = this.createTween(prop, value),
              target = tween.cur(),
              parts = rfxnum.exec(value),
              unit = parts && parts[3] || (jQuery.cssNumber[prop] ? "" : "px"),
              start = (jQuery.cssNumber[prop] || unit !== "px" && +target) && rfxnum.exec(jQuery.css(tween.elem, prop)),
              scale = 1,
              maxIterations = 20;
          if (start && start[3] !== unit) {
            unit = unit || start[3];
            parts = parts || [];
            start = +target || 1;
            do {
              scale = scale || ".5";
              start = start / scale;
              jQuery.style(tween.elem, prop, start + unit);
            } while (scale !== (scale = tween.cur() / target) && scale !== 1 && --maxIterations);
          }
          if (parts) {
            start = tween.start = +start || +target || 0;
            tween.unit = unit;
            tween.end = parts[1] ? start + (parts[1] + 1) * parts[2] : +parts[2];
          }
          return tween;
        }]};
  function createFxNow() {
    setTimeout(function() {
      fxNow = undefined;
    });
    return (fxNow = jQuery.now());
  }
  function genFx(type, includeWidth) {
    var which,
        i = 0,
        attrs = {height: type};
    includeWidth = includeWidth ? 1 : 0;
    for (; i < 4; i += 2 - includeWidth) {
      which = cssExpand[i];
      attrs["margin" + which] = attrs["padding" + which] = type;
    }
    if (includeWidth) {
      attrs.opacity = attrs.width = type;
    }
    return attrs;
  }
  function createTween(value, prop, animation) {
    var tween,
        collection = (tweeners[prop] || []).concat(tweeners["*"]),
        index = 0,
        length = collection.length;
    for (; index < length; index++) {
      if ((tween = collection[index].call(animation, prop, value))) {
        return tween;
      }
    }
  }
  function defaultPrefilter(elem, props, opts) {
    var prop,
        value,
        toggle,
        tween,
        hooks,
        oldfire,
        display,
        checkDisplay,
        anim = this,
        orig = {},
        style = elem.style,
        hidden = elem.nodeType && isHidden(elem),
        dataShow = data_priv.get(elem, "fxshow");
    if (!opts.queue) {
      hooks = jQuery._queueHooks(elem, "fx");
      if (hooks.unqueued == null) {
        hooks.unqueued = 0;
        oldfire = hooks.empty.fire;
        hooks.empty.fire = function() {
          if (!hooks.unqueued) {
            oldfire();
          }
        };
      }
      hooks.unqueued++;
      anim.always(function() {
        anim.always(function() {
          hooks.unqueued--;
          if (!jQuery.queue(elem, "fx").length) {
            hooks.empty.fire();
          }
        });
      });
    }
    if (elem.nodeType === 1 && ("height" in props || "width" in props)) {
      opts.overflow = [style.overflow, style.overflowX, style.overflowY];
      display = jQuery.css(elem, "display");
      checkDisplay = display === "none" ? data_priv.get(elem, "olddisplay") || defaultDisplay(elem.nodeName) : display;
      if (checkDisplay === "inline" && jQuery.css(elem, "float") === "none") {
        style.display = "inline-block";
      }
    }
    if (opts.overflow) {
      style.overflow = "hidden";
      anim.always(function() {
        style.overflow = opts.overflow[0];
        style.overflowX = opts.overflow[1];
        style.overflowY = opts.overflow[2];
      });
    }
    for (prop in props) {
      value = props[prop];
      if (rfxtypes.exec(value)) {
        delete props[prop];
        toggle = toggle || value === "toggle";
        if (value === (hidden ? "hide" : "show")) {
          if (value === "show" && dataShow && dataShow[prop] !== undefined) {
            hidden = true;
          } else {
            continue;
          }
        }
        orig[prop] = dataShow && dataShow[prop] || jQuery.style(elem, prop);
      } else {
        display = undefined;
      }
    }
    if (!jQuery.isEmptyObject(orig)) {
      if (dataShow) {
        if ("hidden" in dataShow) {
          hidden = dataShow.hidden;
        }
      } else {
        dataShow = data_priv.access(elem, "fxshow", {});
      }
      if (toggle) {
        dataShow.hidden = !hidden;
      }
      if (hidden) {
        jQuery(elem).show();
      } else {
        anim.done(function() {
          jQuery(elem).hide();
        });
      }
      anim.done(function() {
        var prop;
        data_priv.remove(elem, "fxshow");
        for (prop in orig) {
          jQuery.style(elem, prop, orig[prop]);
        }
      });
      for (prop in orig) {
        tween = createTween(hidden ? dataShow[prop] : 0, prop, anim);
        if (!(prop in dataShow)) {
          dataShow[prop] = tween.start;
          if (hidden) {
            tween.end = tween.start;
            tween.start = prop === "width" || prop === "height" ? 1 : 0;
          }
        }
      }
    } else if ((display === "none" ? defaultDisplay(elem.nodeName) : display) === "inline") {
      style.display = display;
    }
  }
  function propFilter(props, specialEasing) {
    var index,
        name,
        easing,
        value,
        hooks;
    for (index in props) {
      name = jQuery.camelCase(index);
      easing = specialEasing[name];
      value = props[index];
      if (jQuery.isArray(value)) {
        easing = value[1];
        value = props[index] = value[0];
      }
      if (index !== name) {
        props[name] = value;
        delete props[index];
      }
      hooks = jQuery.cssHooks[name];
      if (hooks && "expand" in hooks) {
        value = hooks.expand(value);
        delete props[name];
        for (index in value) {
          if (!(index in props)) {
            props[index] = value[index];
            specialEasing[index] = easing;
          }
        }
      } else {
        specialEasing[name] = easing;
      }
    }
  }
  function Animation(elem, properties, options) {
    var result,
        stopped,
        index = 0,
        length = animationPrefilters.length,
        deferred = jQuery.Deferred().always(function() {
          delete tick.elem;
        }),
        tick = function() {
          if (stopped) {
            return false;
          }
          var currentTime = fxNow || createFxNow(),
              remaining = Math.max(0, animation.startTime + animation.duration - currentTime),
              temp = remaining / animation.duration || 0,
              percent = 1 - temp,
              index = 0,
              length = animation.tweens.length;
          for (; index < length; index++) {
            animation.tweens[index].run(percent);
          }
          deferred.notifyWith(elem, [animation, percent, remaining]);
          if (percent < 1 && length) {
            return remaining;
          } else {
            deferred.resolveWith(elem, [animation]);
            return false;
          }
        },
        animation = deferred.promise({
          elem: elem,
          props: jQuery.extend({}, properties),
          opts: jQuery.extend(true, {specialEasing: {}}, options),
          originalProperties: properties,
          originalOptions: options,
          startTime: fxNow || createFxNow(),
          duration: options.duration,
          tweens: [],
          createTween: function(prop, end) {
            var tween = jQuery.Tween(elem, animation.opts, prop, end, animation.opts.specialEasing[prop] || animation.opts.easing);
            animation.tweens.push(tween);
            return tween;
          },
          stop: function(gotoEnd) {
            var index = 0,
                length = gotoEnd ? animation.tweens.length : 0;
            if (stopped) {
              return this;
            }
            stopped = true;
            for (; index < length; index++) {
              animation.tweens[index].run(1);
            }
            if (gotoEnd) {
              deferred.resolveWith(elem, [animation, gotoEnd]);
            } else {
              deferred.rejectWith(elem, [animation, gotoEnd]);
            }
            return this;
          }
        }),
        props = animation.props;
    propFilter(props, animation.opts.specialEasing);
    for (; index < length; index++) {
      result = animationPrefilters[index].call(animation, elem, props, animation.opts);
      if (result) {
        return result;
      }
    }
    jQuery.map(props, createTween, animation);
    if (jQuery.isFunction(animation.opts.start)) {
      animation.opts.start.call(elem, animation);
    }
    jQuery.fx.timer(jQuery.extend(tick, {
      elem: elem,
      anim: animation,
      queue: animation.opts.queue
    }));
    return animation.progress(animation.opts.progress).done(animation.opts.done, animation.opts.complete).fail(animation.opts.fail).always(animation.opts.always);
  }
  jQuery.Animation = jQuery.extend(Animation, {
    tweener: function(props, callback) {
      if (jQuery.isFunction(props)) {
        callback = props;
        props = ["*"];
      } else {
        props = props.split(" ");
      }
      var prop,
          index = 0,
          length = props.length;
      for (; index < length; index++) {
        prop = props[index];
        tweeners[prop] = tweeners[prop] || [];
        tweeners[prop].unshift(callback);
      }
    },
    prefilter: function(callback, prepend) {
      if (prepend) {
        animationPrefilters.unshift(callback);
      } else {
        animationPrefilters.push(callback);
      }
    }
  });
  jQuery.speed = function(speed, easing, fn) {
    var opt = speed && typeof speed === "object" ? jQuery.extend({}, speed) : {
      complete: fn || !fn && easing || jQuery.isFunction(speed) && speed,
      duration: speed,
      easing: fn && easing || easing && !jQuery.isFunction(easing) && easing
    };
    opt.duration = jQuery.fx.off ? 0 : typeof opt.duration === "number" ? opt.duration : opt.duration in jQuery.fx.speeds ? jQuery.fx.speeds[opt.duration] : jQuery.fx.speeds._default;
    if (opt.queue == null || opt.queue === true) {
      opt.queue = "fx";
    }
    opt.old = opt.complete;
    opt.complete = function() {
      if (jQuery.isFunction(opt.old)) {
        opt.old.call(this);
      }
      if (opt.queue) {
        jQuery.dequeue(this, opt.queue);
      }
    };
    return opt;
  };
  jQuery.fn.extend({
    fadeTo: function(speed, to, easing, callback) {
      return this.filter(isHidden).css("opacity", 0).show().end().animate({opacity: to}, speed, easing, callback);
    },
    animate: function(prop, speed, easing, callback) {
      var empty = jQuery.isEmptyObject(prop),
          optall = jQuery.speed(speed, easing, callback),
          doAnimation = function() {
            var anim = Animation(this, jQuery.extend({}, prop), optall);
            if (empty || data_priv.get(this, "finish")) {
              anim.stop(true);
            }
          };
      doAnimation.finish = doAnimation;
      return empty || optall.queue === false ? this.each(doAnimation) : this.queue(optall.queue, doAnimation);
    },
    stop: function(type, clearQueue, gotoEnd) {
      var stopQueue = function(hooks) {
        var stop = hooks.stop;
        delete hooks.stop;
        stop(gotoEnd);
      };
      if (typeof type !== "string") {
        gotoEnd = clearQueue;
        clearQueue = type;
        type = undefined;
      }
      if (clearQueue && type !== false) {
        this.queue(type || "fx", []);
      }
      return this.each(function() {
        var dequeue = true,
            index = type != null && type + "queueHooks",
            timers = jQuery.timers,
            data = data_priv.get(this);
        if (index) {
          if (data[index] && data[index].stop) {
            stopQueue(data[index]);
          }
        } else {
          for (index in data) {
            if (data[index] && data[index].stop && rrun.test(index)) {
              stopQueue(data[index]);
            }
          }
        }
        for (index = timers.length; index--; ) {
          if (timers[index].elem === this && (type == null || timers[index].queue === type)) {
            timers[index].anim.stop(gotoEnd);
            dequeue = false;
            timers.splice(index, 1);
          }
        }
        if (dequeue || !gotoEnd) {
          jQuery.dequeue(this, type);
        }
      });
    },
    finish: function(type) {
      if (type !== false) {
        type = type || "fx";
      }
      return this.each(function() {
        var index,
            data = data_priv.get(this),
            queue = data[type + "queue"],
            hooks = data[type + "queueHooks"],
            timers = jQuery.timers,
            length = queue ? queue.length : 0;
        data.finish = true;
        jQuery.queue(this, type, []);
        if (hooks && hooks.stop) {
          hooks.stop.call(this, true);
        }
        for (index = timers.length; index--; ) {
          if (timers[index].elem === this && timers[index].queue === type) {
            timers[index].anim.stop(true);
            timers.splice(index, 1);
          }
        }
        for (index = 0; index < length; index++) {
          if (queue[index] && queue[index].finish) {
            queue[index].finish.call(this);
          }
        }
        delete data.finish;
      });
    }
  });
  jQuery.each(["toggle", "show", "hide"], function(i, name) {
    var cssFn = jQuery.fn[name];
    jQuery.fn[name] = function(speed, easing, callback) {
      return speed == null || typeof speed === "boolean" ? cssFn.apply(this, arguments) : this.animate(genFx(name, true), speed, easing, callback);
    };
  });
  jQuery.each({
    slideDown: genFx("show"),
    slideUp: genFx("hide"),
    slideToggle: genFx("toggle"),
    fadeIn: {opacity: "show"},
    fadeOut: {opacity: "hide"},
    fadeToggle: {opacity: "toggle"}
  }, function(name, props) {
    jQuery.fn[name] = function(speed, easing, callback) {
      return this.animate(props, speed, easing, callback);
    };
  });
  jQuery.timers = [];
  jQuery.fx.tick = function() {
    var timer,
        i = 0,
        timers = jQuery.timers;
    fxNow = jQuery.now();
    for (; i < timers.length; i++) {
      timer = timers[i];
      if (!timer() && timers[i] === timer) {
        timers.splice(i--, 1);
      }
    }
    if (!timers.length) {
      jQuery.fx.stop();
    }
    fxNow = undefined;
  };
  jQuery.fx.timer = function(timer) {
    jQuery.timers.push(timer);
    if (timer()) {
      jQuery.fx.start();
    } else {
      jQuery.timers.pop();
    }
  };
  jQuery.fx.interval = 13;
  jQuery.fx.start = function() {
    if (!timerId) {
      timerId = setInterval(jQuery.fx.tick, jQuery.fx.interval);
    }
  };
  jQuery.fx.stop = function() {
    clearInterval(timerId);
    timerId = null;
  };
  jQuery.fx.speeds = {
    slow: 600,
    fast: 200,
    _default: 400
  };
  jQuery.fn.delay = function(time, type) {
    time = jQuery.fx ? jQuery.fx.speeds[time] || time : time;
    type = type || "fx";
    return this.queue(type, function(next, hooks) {
      var timeout = setTimeout(next, time);
      hooks.stop = function() {
        clearTimeout(timeout);
      };
    });
  };
  (function() {
    var input = document.createElement("input"),
        select = document.createElement("select"),
        opt = select.appendChild(document.createElement("option"));
    input.type = "checkbox";
    support.checkOn = input.value !== "";
    support.optSelected = opt.selected;
    select.disabled = true;
    support.optDisabled = !opt.disabled;
    input = document.createElement("input");
    input.value = "t";
    input.type = "radio";
    support.radioValue = input.value === "t";
  })();
  var nodeHook,
      boolHook,
      attrHandle = jQuery.expr.attrHandle;
  jQuery.fn.extend({
    attr: function(name, value) {
      return access(this, jQuery.attr, name, value, arguments.length > 1);
    },
    removeAttr: function(name) {
      return this.each(function() {
        jQuery.removeAttr(this, name);
      });
    }
  });
  jQuery.extend({
    attr: function(elem, name, value) {
      var hooks,
          ret,
          nType = elem.nodeType;
      if (!elem || nType === 3 || nType === 8 || nType === 2) {
        return;
      }
      if (typeof elem.getAttribute === strundefined) {
        return jQuery.prop(elem, name, value);
      }
      if (nType !== 1 || !jQuery.isXMLDoc(elem)) {
        name = name.toLowerCase();
        hooks = jQuery.attrHooks[name] || (jQuery.expr.match.bool.test(name) ? boolHook : nodeHook);
      }
      if (value !== undefined) {
        if (value === null) {
          jQuery.removeAttr(elem, name);
        } else if (hooks && "set" in hooks && (ret = hooks.set(elem, value, name)) !== undefined) {
          return ret;
        } else {
          elem.setAttribute(name, value + "");
          return value;
        }
      } else if (hooks && "get" in hooks && (ret = hooks.get(elem, name)) !== null) {
        return ret;
      } else {
        ret = jQuery.find.attr(elem, name);
        return ret == null ? undefined : ret;
      }
    },
    removeAttr: function(elem, value) {
      var name,
          propName,
          i = 0,
          attrNames = value && value.match(rnotwhite);
      if (attrNames && elem.nodeType === 1) {
        while ((name = attrNames[i++])) {
          propName = jQuery.propFix[name] || name;
          if (jQuery.expr.match.bool.test(name)) {
            elem[propName] = false;
          }
          elem.removeAttribute(name);
        }
      }
    },
    attrHooks: {type: {set: function(elem, value) {
          if (!support.radioValue && value === "radio" && jQuery.nodeName(elem, "input")) {
            var val = elem.value;
            elem.setAttribute("type", value);
            if (val) {
              elem.value = val;
            }
            return value;
          }
        }}}
  });
  boolHook = {set: function(elem, value, name) {
      if (value === false) {
        jQuery.removeAttr(elem, name);
      } else {
        elem.setAttribute(name, name);
      }
      return name;
    }};
  jQuery.each(jQuery.expr.match.bool.source.match(/\w+/g), function(i, name) {
    var getter = attrHandle[name] || jQuery.find.attr;
    attrHandle[name] = function(elem, name, isXML) {
      var ret,
          handle;
      if (!isXML) {
        handle = attrHandle[name];
        attrHandle[name] = ret;
        ret = getter(elem, name, isXML) != null ? name.toLowerCase() : null;
        attrHandle[name] = handle;
      }
      return ret;
    };
  });
  var rfocusable = /^(?:input|select|textarea|button)$/i;
  jQuery.fn.extend({
    prop: function(name, value) {
      return access(this, jQuery.prop, name, value, arguments.length > 1);
    },
    removeProp: function(name) {
      return this.each(function() {
        delete this[jQuery.propFix[name] || name];
      });
    }
  });
  jQuery.extend({
    propFix: {
      "for": "htmlFor",
      "class": "className"
    },
    prop: function(elem, name, value) {
      var ret,
          hooks,
          notxml,
          nType = elem.nodeType;
      if (!elem || nType === 3 || nType === 8 || nType === 2) {
        return;
      }
      notxml = nType !== 1 || !jQuery.isXMLDoc(elem);
      if (notxml) {
        name = jQuery.propFix[name] || name;
        hooks = jQuery.propHooks[name];
      }
      if (value !== undefined) {
        return hooks && "set" in hooks && (ret = hooks.set(elem, value, name)) !== undefined ? ret : (elem[name] = value);
      } else {
        return hooks && "get" in hooks && (ret = hooks.get(elem, name)) !== null ? ret : elem[name];
      }
    },
    propHooks: {tabIndex: {get: function(elem) {
          return elem.hasAttribute("tabindex") || rfocusable.test(elem.nodeName) || elem.href ? elem.tabIndex : -1;
        }}}
  });
  if (!support.optSelected) {
    jQuery.propHooks.selected = {get: function(elem) {
        var parent = elem.parentNode;
        if (parent && parent.parentNode) {
          parent.parentNode.selectedIndex;
        }
        return null;
      }};
  }
  jQuery.each(["tabIndex", "readOnly", "maxLength", "cellSpacing", "cellPadding", "rowSpan", "colSpan", "useMap", "frameBorder", "contentEditable"], function() {
    jQuery.propFix[this.toLowerCase()] = this;
  });
  var rclass = /[\t\r\n\f]/g;
  jQuery.fn.extend({
    addClass: function(value) {
      var classes,
          elem,
          cur,
          clazz,
          j,
          finalValue,
          proceed = typeof value === "string" && value,
          i = 0,
          len = this.length;
      if (jQuery.isFunction(value)) {
        return this.each(function(j) {
          jQuery(this).addClass(value.call(this, j, this.className));
        });
      }
      if (proceed) {
        classes = (value || "").match(rnotwhite) || [];
        for (; i < len; i++) {
          elem = this[i];
          cur = elem.nodeType === 1 && (elem.className ? (" " + elem.className + " ").replace(rclass, " ") : " ");
          if (cur) {
            j = 0;
            while ((clazz = classes[j++])) {
              if (cur.indexOf(" " + clazz + " ") < 0) {
                cur += clazz + " ";
              }
            }
            finalValue = jQuery.trim(cur);
            if (elem.className !== finalValue) {
              elem.className = finalValue;
            }
          }
        }
      }
      return this;
    },
    removeClass: function(value) {
      var classes,
          elem,
          cur,
          clazz,
          j,
          finalValue,
          proceed = arguments.length === 0 || typeof value === "string" && value,
          i = 0,
          len = this.length;
      if (jQuery.isFunction(value)) {
        return this.each(function(j) {
          jQuery(this).removeClass(value.call(this, j, this.className));
        });
      }
      if (proceed) {
        classes = (value || "").match(rnotwhite) || [];
        for (; i < len; i++) {
          elem = this[i];
          cur = elem.nodeType === 1 && (elem.className ? (" " + elem.className + " ").replace(rclass, " ") : "");
          if (cur) {
            j = 0;
            while ((clazz = classes[j++])) {
              while (cur.indexOf(" " + clazz + " ") >= 0) {
                cur = cur.replace(" " + clazz + " ", " ");
              }
            }
            finalValue = value ? jQuery.trim(cur) : "";
            if (elem.className !== finalValue) {
              elem.className = finalValue;
            }
          }
        }
      }
      return this;
    },
    toggleClass: function(value, stateVal) {
      var type = typeof value;
      if (typeof stateVal === "boolean" && type === "string") {
        return stateVal ? this.addClass(value) : this.removeClass(value);
      }
      if (jQuery.isFunction(value)) {
        return this.each(function(i) {
          jQuery(this).toggleClass(value.call(this, i, this.className, stateVal), stateVal);
        });
      }
      return this.each(function() {
        if (type === "string") {
          var className,
              i = 0,
              self = jQuery(this),
              classNames = value.match(rnotwhite) || [];
          while ((className = classNames[i++])) {
            if (self.hasClass(className)) {
              self.removeClass(className);
            } else {
              self.addClass(className);
            }
          }
        } else if (type === strundefined || type === "boolean") {
          if (this.className) {
            data_priv.set(this, "__className__", this.className);
          }
          this.className = this.className || value === false ? "" : data_priv.get(this, "__className__") || "";
        }
      });
    },
    hasClass: function(selector) {
      var className = " " + selector + " ",
          i = 0,
          l = this.length;
      for (; i < l; i++) {
        if (this[i].nodeType === 1 && (" " + this[i].className + " ").replace(rclass, " ").indexOf(className) >= 0) {
          return true;
        }
      }
      return false;
    }
  });
  var rreturn = /\r/g;
  jQuery.fn.extend({val: function(value) {
      var hooks,
          ret,
          isFunction,
          elem = this[0];
      if (!arguments.length) {
        if (elem) {
          hooks = jQuery.valHooks[elem.type] || jQuery.valHooks[elem.nodeName.toLowerCase()];
          if (hooks && "get" in hooks && (ret = hooks.get(elem, "value")) !== undefined) {
            return ret;
          }
          ret = elem.value;
          return typeof ret === "string" ? ret.replace(rreturn, "") : ret == null ? "" : ret;
        }
        return;
      }
      isFunction = jQuery.isFunction(value);
      return this.each(function(i) {
        var val;
        if (this.nodeType !== 1) {
          return;
        }
        if (isFunction) {
          val = value.call(this, i, jQuery(this).val());
        } else {
          val = value;
        }
        if (val == null) {
          val = "";
        } else if (typeof val === "number") {
          val += "";
        } else if (jQuery.isArray(val)) {
          val = jQuery.map(val, function(value) {
            return value == null ? "" : value + "";
          });
        }
        hooks = jQuery.valHooks[this.type] || jQuery.valHooks[this.nodeName.toLowerCase()];
        if (!hooks || !("set" in hooks) || hooks.set(this, val, "value") === undefined) {
          this.value = val;
        }
      });
    }});
  jQuery.extend({valHooks: {
      option: {get: function(elem) {
          var val = jQuery.find.attr(elem, "value");
          return val != null ? val : jQuery.trim(jQuery.text(elem));
        }},
      select: {
        get: function(elem) {
          var value,
              option,
              options = elem.options,
              index = elem.selectedIndex,
              one = elem.type === "select-one" || index < 0,
              values = one ? null : [],
              max = one ? index + 1 : options.length,
              i = index < 0 ? max : one ? index : 0;
          for (; i < max; i++) {
            option = options[i];
            if ((option.selected || i === index) && (support.optDisabled ? !option.disabled : option.getAttribute("disabled") === null) && (!option.parentNode.disabled || !jQuery.nodeName(option.parentNode, "optgroup"))) {
              value = jQuery(option).val();
              if (one) {
                return value;
              }
              values.push(value);
            }
          }
          return values;
        },
        set: function(elem, value) {
          var optionSet,
              option,
              options = elem.options,
              values = jQuery.makeArray(value),
              i = options.length;
          while (i--) {
            option = options[i];
            if ((option.selected = jQuery.inArray(option.value, values) >= 0)) {
              optionSet = true;
            }
          }
          if (!optionSet) {
            elem.selectedIndex = -1;
          }
          return values;
        }
      }
    }});
  jQuery.each(["radio", "checkbox"], function() {
    jQuery.valHooks[this] = {set: function(elem, value) {
        if (jQuery.isArray(value)) {
          return (elem.checked = jQuery.inArray(jQuery(elem).val(), value) >= 0);
        }
      }};
    if (!support.checkOn) {
      jQuery.valHooks[this].get = function(elem) {
        return elem.getAttribute("value") === null ? "on" : elem.value;
      };
    }
  });
  jQuery.each(("blur focus focusin focusout load resize scroll unload click dblclick " + "mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave " + "change select submit keydown keypress keyup error contextmenu").split(" "), function(i, name) {
    jQuery.fn[name] = function(data, fn) {
      return arguments.length > 0 ? this.on(name, null, data, fn) : this.trigger(name);
    };
  });
  jQuery.fn.extend({
    hover: function(fnOver, fnOut) {
      return this.mouseenter(fnOver).mouseleave(fnOut || fnOver);
    },
    bind: function(types, data, fn) {
      return this.on(types, null, data, fn);
    },
    unbind: function(types, fn) {
      return this.off(types, null, fn);
    },
    delegate: function(selector, types, data, fn) {
      return this.on(types, selector, data, fn);
    },
    undelegate: function(selector, types, fn) {
      return arguments.length === 1 ? this.off(selector, "**") : this.off(types, selector || "**", fn);
    }
  });
  var nonce = jQuery.now();
  var rquery = (/\?/);
  jQuery.parseJSON = function(data) {
    return JSON.parse(data + "");
  };
  jQuery.parseXML = function(data) {
    var xml,
        tmp;
    if (!data || typeof data !== "string") {
      return null;
    }
    try {
      tmp = new DOMParser();
      xml = tmp.parseFromString(data, "text/xml");
    } catch (e) {
      xml = undefined;
    }
    if (!xml || xml.getElementsByTagName("parsererror").length) {
      jQuery.error("Invalid XML: " + data);
    }
    return xml;
  };
  var rhash = /#.*$/,
      rts = /([?&])_=[^&]*/,
      rheaders = /^(.*?):[ \t]*([^\r\n]*)$/mg,
      rlocalProtocol = /^(?:about|app|app-storage|.+-extension|file|res|widget):$/,
      rnoContent = /^(?:GET|HEAD)$/,
      rprotocol = /^\/\//,
      rurl = /^([\w.+-]+:)(?:\/\/(?:[^\/?#]*@|)([^\/?#:]*)(?::(\d+)|)|)/,
      prefilters = {},
      transports = {},
      allTypes = "*/".concat("*"),
      ajaxLocation = window.location.href,
      ajaxLocParts = rurl.exec(ajaxLocation.toLowerCase()) || [];
  function addToPrefiltersOrTransports(structure) {
    return function(dataTypeExpression, func) {
      if (typeof dataTypeExpression !== "string") {
        func = dataTypeExpression;
        dataTypeExpression = "*";
      }
      var dataType,
          i = 0,
          dataTypes = dataTypeExpression.toLowerCase().match(rnotwhite) || [];
      if (jQuery.isFunction(func)) {
        while ((dataType = dataTypes[i++])) {
          if (dataType[0] === "+") {
            dataType = dataType.slice(1) || "*";
            (structure[dataType] = structure[dataType] || []).unshift(func);
          } else {
            (structure[dataType] = structure[dataType] || []).push(func);
          }
        }
      }
    };
  }
  function inspectPrefiltersOrTransports(structure, options, originalOptions, jqXHR) {
    var inspected = {},
        seekingTransport = (structure === transports);
    function inspect(dataType) {
      var selected;
      inspected[dataType] = true;
      jQuery.each(structure[dataType] || [], function(_, prefilterOrFactory) {
        var dataTypeOrTransport = prefilterOrFactory(options, originalOptions, jqXHR);
        if (typeof dataTypeOrTransport === "string" && !seekingTransport && !inspected[dataTypeOrTransport]) {
          options.dataTypes.unshift(dataTypeOrTransport);
          inspect(dataTypeOrTransport);
          return false;
        } else if (seekingTransport) {
          return !(selected = dataTypeOrTransport);
        }
      });
      return selected;
    }
    return inspect(options.dataTypes[0]) || !inspected["*"] && inspect("*");
  }
  function ajaxExtend(target, src) {
    var key,
        deep,
        flatOptions = jQuery.ajaxSettings.flatOptions || {};
    for (key in src) {
      if (src[key] !== undefined) {
        (flatOptions[key] ? target : (deep || (deep = {})))[key] = src[key];
      }
    }
    if (deep) {
      jQuery.extend(true, target, deep);
    }
    return target;
  }
  function ajaxHandleResponses(s, jqXHR, responses) {
    var ct,
        type,
        finalDataType,
        firstDataType,
        contents = s.contents,
        dataTypes = s.dataTypes;
    while (dataTypes[0] === "*") {
      dataTypes.shift();
      if (ct === undefined) {
        ct = s.mimeType || jqXHR.getResponseHeader("Content-Type");
      }
    }
    if (ct) {
      for (type in contents) {
        if (contents[type] && contents[type].test(ct)) {
          dataTypes.unshift(type);
          break;
        }
      }
    }
    if (dataTypes[0] in responses) {
      finalDataType = dataTypes[0];
    } else {
      for (type in responses) {
        if (!dataTypes[0] || s.converters[type + " " + dataTypes[0]]) {
          finalDataType = type;
          break;
        }
        if (!firstDataType) {
          firstDataType = type;
        }
      }
      finalDataType = finalDataType || firstDataType;
    }
    if (finalDataType) {
      if (finalDataType !== dataTypes[0]) {
        dataTypes.unshift(finalDataType);
      }
      return responses[finalDataType];
    }
  }
  function ajaxConvert(s, response, jqXHR, isSuccess) {
    var conv2,
        current,
        conv,
        tmp,
        prev,
        converters = {},
        dataTypes = s.dataTypes.slice();
    if (dataTypes[1]) {
      for (conv in s.converters) {
        converters[conv.toLowerCase()] = s.converters[conv];
      }
    }
    current = dataTypes.shift();
    while (current) {
      if (s.responseFields[current]) {
        jqXHR[s.responseFields[current]] = response;
      }
      if (!prev && isSuccess && s.dataFilter) {
        response = s.dataFilter(response, s.dataType);
      }
      prev = current;
      current = dataTypes.shift();
      if (current) {
        if (current === "*") {
          current = prev;
        } else if (prev !== "*" && prev !== current) {
          conv = converters[prev + " " + current] || converters["* " + current];
          if (!conv) {
            for (conv2 in converters) {
              tmp = conv2.split(" ");
              if (tmp[1] === current) {
                conv = converters[prev + " " + tmp[0]] || converters["* " + tmp[0]];
                if (conv) {
                  if (conv === true) {
                    conv = converters[conv2];
                  } else if (converters[conv2] !== true) {
                    current = tmp[0];
                    dataTypes.unshift(tmp[1]);
                  }
                  break;
                }
              }
            }
          }
          if (conv !== true) {
            if (conv && s["throws"]) {
              response = conv(response);
            } else {
              try {
                response = conv(response);
              } catch (e) {
                return {
                  state: "parsererror",
                  error: conv ? e : "No conversion from " + prev + " to " + current
                };
              }
            }
          }
        }
      }
    }
    return {
      state: "success",
      data: response
    };
  }
  jQuery.extend({
    active: 0,
    lastModified: {},
    etag: {},
    ajaxSettings: {
      url: ajaxLocation,
      type: "GET",
      isLocal: rlocalProtocol.test(ajaxLocParts[1]),
      global: true,
      processData: true,
      async: true,
      contentType: "application/x-www-form-urlencoded; charset=UTF-8",
      accepts: {
        "*": allTypes,
        text: "text/plain",
        html: "text/html",
        xml: "application/xml, text/xml",
        json: "application/json, text/javascript"
      },
      contents: {
        xml: /xml/,
        html: /html/,
        json: /json/
      },
      responseFields: {
        xml: "responseXML",
        text: "responseText",
        json: "responseJSON"
      },
      converters: {
        "* text": String,
        "text html": true,
        "text json": jQuery.parseJSON,
        "text xml": jQuery.parseXML
      },
      flatOptions: {
        url: true,
        context: true
      }
    },
    ajaxSetup: function(target, settings) {
      return settings ? ajaxExtend(ajaxExtend(target, jQuery.ajaxSettings), settings) : ajaxExtend(jQuery.ajaxSettings, target);
    },
    ajaxPrefilter: addToPrefiltersOrTransports(prefilters),
    ajaxTransport: addToPrefiltersOrTransports(transports),
    ajax: function(url, options) {
      if (typeof url === "object") {
        options = url;
        url = undefined;
      }
      options = options || {};
      var transport,
          cacheURL,
          responseHeadersString,
          responseHeaders,
          timeoutTimer,
          parts,
          fireGlobals,
          i,
          s = jQuery.ajaxSetup({}, options),
          callbackContext = s.context || s,
          globalEventContext = s.context && (callbackContext.nodeType || callbackContext.jquery) ? jQuery(callbackContext) : jQuery.event,
          deferred = jQuery.Deferred(),
          completeDeferred = jQuery.Callbacks("once memory"),
          statusCode = s.statusCode || {},
          requestHeaders = {},
          requestHeadersNames = {},
          state = 0,
          strAbort = "canceled",
          jqXHR = {
            readyState: 0,
            getResponseHeader: function(key) {
              var match;
              if (state === 2) {
                if (!responseHeaders) {
                  responseHeaders = {};
                  while ((match = rheaders.exec(responseHeadersString))) {
                    responseHeaders[match[1].toLowerCase()] = match[2];
                  }
                }
                match = responseHeaders[key.toLowerCase()];
              }
              return match == null ? null : match;
            },
            getAllResponseHeaders: function() {
              return state === 2 ? responseHeadersString : null;
            },
            setRequestHeader: function(name, value) {
              var lname = name.toLowerCase();
              if (!state) {
                name = requestHeadersNames[lname] = requestHeadersNames[lname] || name;
                requestHeaders[name] = value;
              }
              return this;
            },
            overrideMimeType: function(type) {
              if (!state) {
                s.mimeType = type;
              }
              return this;
            },
            statusCode: function(map) {
              var code;
              if (map) {
                if (state < 2) {
                  for (code in map) {
                    statusCode[code] = [statusCode[code], map[code]];
                  }
                } else {
                  jqXHR.always(map[jqXHR.status]);
                }
              }
              return this;
            },
            abort: function(statusText) {
              var finalText = statusText || strAbort;
              if (transport) {
                transport.abort(finalText);
              }
              done(0, finalText);
              return this;
            }
          };
      deferred.promise(jqXHR).complete = completeDeferred.add;
      jqXHR.success = jqXHR.done;
      jqXHR.error = jqXHR.fail;
      s.url = ((url || s.url || ajaxLocation) + "").replace(rhash, "").replace(rprotocol, ajaxLocParts[1] + "//");
      s.type = options.method || options.type || s.method || s.type;
      s.dataTypes = jQuery.trim(s.dataType || "*").toLowerCase().match(rnotwhite) || [""];
      if (s.crossDomain == null) {
        parts = rurl.exec(s.url.toLowerCase());
        s.crossDomain = !!(parts && (parts[1] !== ajaxLocParts[1] || parts[2] !== ajaxLocParts[2] || (parts[3] || (parts[1] === "http:" ? "80" : "443")) !== (ajaxLocParts[3] || (ajaxLocParts[1] === "http:" ? "80" : "443"))));
      }
      if (s.data && s.processData && typeof s.data !== "string") {
        s.data = jQuery.param(s.data, s.traditional);
      }
      inspectPrefiltersOrTransports(prefilters, s, options, jqXHR);
      if (state === 2) {
        return jqXHR;
      }
      fireGlobals = jQuery.event && s.global;
      if (fireGlobals && jQuery.active++ === 0) {
        jQuery.event.trigger("ajaxStart");
      }
      s.type = s.type.toUpperCase();
      s.hasContent = !rnoContent.test(s.type);
      cacheURL = s.url;
      if (!s.hasContent) {
        if (s.data) {
          cacheURL = (s.url += (rquery.test(cacheURL) ? "&" : "?") + s.data);
          delete s.data;
        }
        if (s.cache === false) {
          s.url = rts.test(cacheURL) ? cacheURL.replace(rts, "$1_=" + nonce++) : cacheURL + (rquery.test(cacheURL) ? "&" : "?") + "_=" + nonce++;
        }
      }
      if (s.ifModified) {
        if (jQuery.lastModified[cacheURL]) {
          jqXHR.setRequestHeader("If-Modified-Since", jQuery.lastModified[cacheURL]);
        }
        if (jQuery.etag[cacheURL]) {
          jqXHR.setRequestHeader("If-None-Match", jQuery.etag[cacheURL]);
        }
      }
      if (s.data && s.hasContent && s.contentType !== false || options.contentType) {
        jqXHR.setRequestHeader("Content-Type", s.contentType);
      }
      jqXHR.setRequestHeader("Accept", s.dataTypes[0] && s.accepts[s.dataTypes[0]] ? s.accepts[s.dataTypes[0]] + (s.dataTypes[0] !== "*" ? ", " + allTypes + "; q=0.01" : "") : s.accepts["*"]);
      for (i in s.headers) {
        jqXHR.setRequestHeader(i, s.headers[i]);
      }
      if (s.beforeSend && (s.beforeSend.call(callbackContext, jqXHR, s) === false || state === 2)) {
        return jqXHR.abort();
      }
      strAbort = "abort";
      for (i in {
        success: 1,
        error: 1,
        complete: 1
      }) {
        jqXHR[i](s[i]);
      }
      transport = inspectPrefiltersOrTransports(transports, s, options, jqXHR);
      if (!transport) {
        done(-1, "No Transport");
      } else {
        jqXHR.readyState = 1;
        if (fireGlobals) {
          globalEventContext.trigger("ajaxSend", [jqXHR, s]);
        }
        if (s.async && s.timeout > 0) {
          timeoutTimer = setTimeout(function() {
            jqXHR.abort("timeout");
          }, s.timeout);
        }
        try {
          state = 1;
          transport.send(requestHeaders, done);
        } catch (e) {
          if (state < 2) {
            done(-1, e);
          } else {
            throw e;
          }
        }
      }
      function done(status, nativeStatusText, responses, headers) {
        var isSuccess,
            success,
            error,
            response,
            modified,
            statusText = nativeStatusText;
        if (state === 2) {
          return;
        }
        state = 2;
        if (timeoutTimer) {
          clearTimeout(timeoutTimer);
        }
        transport = undefined;
        responseHeadersString = headers || "";
        jqXHR.readyState = status > 0 ? 4 : 0;
        isSuccess = status >= 200 && status < 300 || status === 304;
        if (responses) {
          response = ajaxHandleResponses(s, jqXHR, responses);
        }
        response = ajaxConvert(s, response, jqXHR, isSuccess);
        if (isSuccess) {
          if (s.ifModified) {
            modified = jqXHR.getResponseHeader("Last-Modified");
            if (modified) {
              jQuery.lastModified[cacheURL] = modified;
            }
            modified = jqXHR.getResponseHeader("etag");
            if (modified) {
              jQuery.etag[cacheURL] = modified;
            }
          }
          if (status === 204 || s.type === "HEAD") {
            statusText = "nocontent";
          } else if (status === 304) {
            statusText = "notmodified";
          } else {
            statusText = response.state;
            success = response.data;
            error = response.error;
            isSuccess = !error;
          }
        } else {
          error = statusText;
          if (status || !statusText) {
            statusText = "error";
            if (status < 0) {
              status = 0;
            }
          }
        }
        jqXHR.status = status;
        jqXHR.statusText = (nativeStatusText || statusText) + "";
        if (isSuccess) {
          deferred.resolveWith(callbackContext, [success, statusText, jqXHR]);
        } else {
          deferred.rejectWith(callbackContext, [jqXHR, statusText, error]);
        }
        jqXHR.statusCode(statusCode);
        statusCode = undefined;
        if (fireGlobals) {
          globalEventContext.trigger(isSuccess ? "ajaxSuccess" : "ajaxError", [jqXHR, s, isSuccess ? success : error]);
        }
        completeDeferred.fireWith(callbackContext, [jqXHR, statusText]);
        if (fireGlobals) {
          globalEventContext.trigger("ajaxComplete", [jqXHR, s]);
          if (!(--jQuery.active)) {
            jQuery.event.trigger("ajaxStop");
          }
        }
      }
      return jqXHR;
    },
    getJSON: function(url, data, callback) {
      return jQuery.get(url, data, callback, "json");
    },
    getScript: function(url, callback) {
      return jQuery.get(url, undefined, callback, "script");
    }
  });
  jQuery.each(["get", "post"], function(i, method) {
    jQuery[method] = function(url, data, callback, type) {
      if (jQuery.isFunction(data)) {
        type = type || callback;
        callback = data;
        data = undefined;
      }
      return jQuery.ajax({
        url: url,
        type: method,
        dataType: type,
        data: data,
        success: callback
      });
    };
  });
  jQuery._evalUrl = function(url) {
    return jQuery.ajax({
      url: url,
      type: "GET",
      dataType: "script",
      async: false,
      global: false,
      "throws": true
    });
  };
  jQuery.fn.extend({
    wrapAll: function(html) {
      var wrap;
      if (jQuery.isFunction(html)) {
        return this.each(function(i) {
          jQuery(this).wrapAll(html.call(this, i));
        });
      }
      if (this[0]) {
        wrap = jQuery(html, this[0].ownerDocument).eq(0).clone(true);
        if (this[0].parentNode) {
          wrap.insertBefore(this[0]);
        }
        wrap.map(function() {
          var elem = this;
          while (elem.firstElementChild) {
            elem = elem.firstElementChild;
          }
          return elem;
        }).append(this);
      }
      return this;
    },
    wrapInner: function(html) {
      if (jQuery.isFunction(html)) {
        return this.each(function(i) {
          jQuery(this).wrapInner(html.call(this, i));
        });
      }
      return this.each(function() {
        var self = jQuery(this),
            contents = self.contents();
        if (contents.length) {
          contents.wrapAll(html);
        } else {
          self.append(html);
        }
      });
    },
    wrap: function(html) {
      var isFunction = jQuery.isFunction(html);
      return this.each(function(i) {
        jQuery(this).wrapAll(isFunction ? html.call(this, i) : html);
      });
    },
    unwrap: function() {
      return this.parent().each(function() {
        if (!jQuery.nodeName(this, "body")) {
          jQuery(this).replaceWith(this.childNodes);
        }
      }).end();
    }
  });
  jQuery.expr.filters.hidden = function(elem) {
    return elem.offsetWidth <= 0 && elem.offsetHeight <= 0;
  };
  jQuery.expr.filters.visible = function(elem) {
    return !jQuery.expr.filters.hidden(elem);
  };
  var r20 = /%20/g,
      rbracket = /\[\]$/,
      rCRLF = /\r?\n/g,
      rsubmitterTypes = /^(?:submit|button|image|reset|file)$/i,
      rsubmittable = /^(?:input|select|textarea|keygen)/i;
  function buildParams(prefix, obj, traditional, add) {
    var name;
    if (jQuery.isArray(obj)) {
      jQuery.each(obj, function(i, v) {
        if (traditional || rbracket.test(prefix)) {
          add(prefix, v);
        } else {
          buildParams(prefix + "[" + (typeof v === "object" ? i : "") + "]", v, traditional, add);
        }
      });
    } else if (!traditional && jQuery.type(obj) === "object") {
      for (name in obj) {
        buildParams(prefix + "[" + name + "]", obj[name], traditional, add);
      }
    } else {
      add(prefix, obj);
    }
  }
  jQuery.param = function(a, traditional) {
    var prefix,
        s = [],
        add = function(key, value) {
          value = jQuery.isFunction(value) ? value() : (value == null ? "" : value);
          s[s.length] = encodeURIComponent(key) + "=" + encodeURIComponent(value);
        };
    if (traditional === undefined) {
      traditional = jQuery.ajaxSettings && jQuery.ajaxSettings.traditional;
    }
    if (jQuery.isArray(a) || (a.jquery && !jQuery.isPlainObject(a))) {
      jQuery.each(a, function() {
        add(this.name, this.value);
      });
    } else {
      for (prefix in a) {
        buildParams(prefix, a[prefix], traditional, add);
      }
    }
    return s.join("&").replace(r20, "+");
  };
  jQuery.fn.extend({
    serialize: function() {
      return jQuery.param(this.serializeArray());
    },
    serializeArray: function() {
      return this.map(function() {
        var elements = jQuery.prop(this, "elements");
        return elements ? jQuery.makeArray(elements) : this;
      }).filter(function() {
        var type = this.type;
        return this.name && !jQuery(this).is(":disabled") && rsubmittable.test(this.nodeName) && !rsubmitterTypes.test(type) && (this.checked || !rcheckableType.test(type));
      }).map(function(i, elem) {
        var val = jQuery(this).val();
        return val == null ? null : jQuery.isArray(val) ? jQuery.map(val, function(val) {
          return {
            name: elem.name,
            value: val.replace(rCRLF, "\r\n")
          };
        }) : {
          name: elem.name,
          value: val.replace(rCRLF, "\r\n")
        };
      }).get();
    }
  });
  jQuery.ajaxSettings.xhr = function() {
    try {
      return new XMLHttpRequest();
    } catch (e) {}
  };
  var xhrId = 0,
      xhrCallbacks = {},
      xhrSuccessStatus = {
        0: 200,
        1223: 204
      },
      xhrSupported = jQuery.ajaxSettings.xhr();
  if (window.attachEvent) {
    window.attachEvent("onunload", function() {
      for (var key in xhrCallbacks) {
        xhrCallbacks[key]();
      }
    });
  }
  support.cors = !!xhrSupported && ("withCredentials" in xhrSupported);
  support.ajax = xhrSupported = !!xhrSupported;
  jQuery.ajaxTransport(function(options) {
    var callback;
    if (support.cors || xhrSupported && !options.crossDomain) {
      return {
        send: function(headers, complete) {
          var i,
              xhr = options.xhr(),
              id = ++xhrId;
          xhr.open(options.type, options.url, options.async, options.username, options.password);
          if (options.xhrFields) {
            for (i in options.xhrFields) {
              xhr[i] = options.xhrFields[i];
            }
          }
          if (options.mimeType && xhr.overrideMimeType) {
            xhr.overrideMimeType(options.mimeType);
          }
          if (!options.crossDomain && !headers["X-Requested-With"]) {
            headers["X-Requested-With"] = "XMLHttpRequest";
          }
          for (i in headers) {
            xhr.setRequestHeader(i, headers[i]);
          }
          callback = function(type) {
            return function() {
              if (callback) {
                delete xhrCallbacks[id];
                callback = xhr.onload = xhr.onerror = null;
                if (type === "abort") {
                  xhr.abort();
                } else if (type === "error") {
                  complete(xhr.status, xhr.statusText);
                } else {
                  complete(xhrSuccessStatus[xhr.status] || xhr.status, xhr.statusText, typeof xhr.responseText === "string" ? {text: xhr.responseText} : undefined, xhr.getAllResponseHeaders());
                }
              }
            };
          };
          xhr.onload = callback();
          xhr.onerror = callback("error");
          callback = xhrCallbacks[id] = callback("abort");
          try {
            xhr.send(options.hasContent && options.data || null);
          } catch (e) {
            if (callback) {
              throw e;
            }
          }
        },
        abort: function() {
          if (callback) {
            callback();
          }
        }
      };
    }
  });
  jQuery.ajaxSetup({
    accepts: {script: "text/javascript, application/javascript, application/ecmascript, application/x-ecmascript"},
    contents: {script: /(?:java|ecma)script/},
    converters: {"text script": function(text) {
        jQuery.globalEval(text);
        return text;
      }}
  });
  jQuery.ajaxPrefilter("script", function(s) {
    if (s.cache === undefined) {
      s.cache = false;
    }
    if (s.crossDomain) {
      s.type = "GET";
    }
  });
  jQuery.ajaxTransport("script", function(s) {
    if (s.crossDomain) {
      var script,
          callback;
      return {
        send: function(_, complete) {
          script = jQuery("<script>").prop({
            async: true,
            charset: s.scriptCharset,
            src: s.url
          }).on("load error", callback = function(evt) {
            script.remove();
            callback = null;
            if (evt) {
              complete(evt.type === "error" ? 404 : 200, evt.type);
            }
          });
          document.head.appendChild(script[0]);
        },
        abort: function() {
          if (callback) {
            callback();
          }
        }
      };
    }
  });
  var oldCallbacks = [],
      rjsonp = /(=)\?(?=&|$)|\?\?/;
  jQuery.ajaxSetup({
    jsonp: "callback",
    jsonpCallback: function() {
      var callback = oldCallbacks.pop() || (jQuery.expando + "_" + (nonce++));
      this[callback] = true;
      return callback;
    }
  });
  jQuery.ajaxPrefilter("json jsonp", function(s, originalSettings, jqXHR) {
    var callbackName,
        overwritten,
        responseContainer,
        jsonProp = s.jsonp !== false && (rjsonp.test(s.url) ? "url" : typeof s.data === "string" && !(s.contentType || "").indexOf("application/x-www-form-urlencoded") && rjsonp.test(s.data) && "data");
    if (jsonProp || s.dataTypes[0] === "jsonp") {
      callbackName = s.jsonpCallback = jQuery.isFunction(s.jsonpCallback) ? s.jsonpCallback() : s.jsonpCallback;
      if (jsonProp) {
        s[jsonProp] = s[jsonProp].replace(rjsonp, "$1" + callbackName);
      } else if (s.jsonp !== false) {
        s.url += (rquery.test(s.url) ? "&" : "?") + s.jsonp + "=" + callbackName;
      }
      s.converters["script json"] = function() {
        if (!responseContainer) {
          jQuery.error(callbackName + " was not called");
        }
        return responseContainer[0];
      };
      s.dataTypes[0] = "json";
      overwritten = window[callbackName];
      window[callbackName] = function() {
        responseContainer = arguments;
      };
      jqXHR.always(function() {
        window[callbackName] = overwritten;
        if (s[callbackName]) {
          s.jsonpCallback = originalSettings.jsonpCallback;
          oldCallbacks.push(callbackName);
        }
        if (responseContainer && jQuery.isFunction(overwritten)) {
          overwritten(responseContainer[0]);
        }
        responseContainer = overwritten = undefined;
      });
      return "script";
    }
  });
  jQuery.parseHTML = function(data, context, keepScripts) {
    if (!data || typeof data !== "string") {
      return null;
    }
    if (typeof context === "boolean") {
      keepScripts = context;
      context = false;
    }
    context = context || document;
    var parsed = rsingleTag.exec(data),
        scripts = !keepScripts && [];
    if (parsed) {
      return [context.createElement(parsed[1])];
    }
    parsed = jQuery.buildFragment([data], context, scripts);
    if (scripts && scripts.length) {
      jQuery(scripts).remove();
    }
    return jQuery.merge([], parsed.childNodes);
  };
  var _load = jQuery.fn.load;
  jQuery.fn.load = function(url, params, callback) {
    if (typeof url !== "string" && _load) {
      return _load.apply(this, arguments);
    }
    var selector,
        type,
        response,
        self = this,
        off = url.indexOf(" ");
    if (off >= 0) {
      selector = jQuery.trim(url.slice(off));
      url = url.slice(0, off);
    }
    if (jQuery.isFunction(params)) {
      callback = params;
      params = undefined;
    } else if (params && typeof params === "object") {
      type = "POST";
    }
    if (self.length > 0) {
      jQuery.ajax({
        url: url,
        type: type,
        dataType: "html",
        data: params
      }).done(function(responseText) {
        response = arguments;
        self.html(selector ? jQuery("<div>").append(jQuery.parseHTML(responseText)).find(selector) : responseText);
      }).complete(callback && function(jqXHR, status) {
        self.each(callback, response || [jqXHR.responseText, status, jqXHR]);
      });
    }
    return this;
  };
  jQuery.each(["ajaxStart", "ajaxStop", "ajaxComplete", "ajaxError", "ajaxSuccess", "ajaxSend"], function(i, type) {
    jQuery.fn[type] = function(fn) {
      return this.on(type, fn);
    };
  });
  jQuery.expr.filters.animated = function(elem) {
    return jQuery.grep(jQuery.timers, function(fn) {
      return elem === fn.elem;
    }).length;
  };
  var docElem = window.document.documentElement;
  function getWindow(elem) {
    return jQuery.isWindow(elem) ? elem : elem.nodeType === 9 && elem.defaultView;
  }
  jQuery.offset = {setOffset: function(elem, options, i) {
      var curPosition,
          curLeft,
          curCSSTop,
          curTop,
          curOffset,
          curCSSLeft,
          calculatePosition,
          position = jQuery.css(elem, "position"),
          curElem = jQuery(elem),
          props = {};
      if (position === "static") {
        elem.style.position = "relative";
      }
      curOffset = curElem.offset();
      curCSSTop = jQuery.css(elem, "top");
      curCSSLeft = jQuery.css(elem, "left");
      calculatePosition = (position === "absolute" || position === "fixed") && (curCSSTop + curCSSLeft).indexOf("auto") > -1;
      if (calculatePosition) {
        curPosition = curElem.position();
        curTop = curPosition.top;
        curLeft = curPosition.left;
      } else {
        curTop = parseFloat(curCSSTop) || 0;
        curLeft = parseFloat(curCSSLeft) || 0;
      }
      if (jQuery.isFunction(options)) {
        options = options.call(elem, i, curOffset);
      }
      if (options.top != null) {
        props.top = (options.top - curOffset.top) + curTop;
      }
      if (options.left != null) {
        props.left = (options.left - curOffset.left) + curLeft;
      }
      if ("using" in options) {
        options.using.call(elem, props);
      } else {
        curElem.css(props);
      }
    }};
  jQuery.fn.extend({
    offset: function(options) {
      if (arguments.length) {
        return options === undefined ? this : this.each(function(i) {
          jQuery.offset.setOffset(this, options, i);
        });
      }
      var docElem,
          win,
          elem = this[0],
          box = {
            top: 0,
            left: 0
          },
          doc = elem && elem.ownerDocument;
      if (!doc) {
        return;
      }
      docElem = doc.documentElement;
      if (!jQuery.contains(docElem, elem)) {
        return box;
      }
      if (typeof elem.getBoundingClientRect !== strundefined) {
        box = elem.getBoundingClientRect();
      }
      win = getWindow(doc);
      return {
        top: box.top + win.pageYOffset - docElem.clientTop,
        left: box.left + win.pageXOffset - docElem.clientLeft
      };
    },
    position: function() {
      if (!this[0]) {
        return;
      }
      var offsetParent,
          offset,
          elem = this[0],
          parentOffset = {
            top: 0,
            left: 0
          };
      if (jQuery.css(elem, "position") === "fixed") {
        offset = elem.getBoundingClientRect();
      } else {
        offsetParent = this.offsetParent();
        offset = this.offset();
        if (!jQuery.nodeName(offsetParent[0], "html")) {
          parentOffset = offsetParent.offset();
        }
        parentOffset.top += jQuery.css(offsetParent[0], "borderTopWidth", true);
        parentOffset.left += jQuery.css(offsetParent[0], "borderLeftWidth", true);
      }
      return {
        top: offset.top - parentOffset.top - jQuery.css(elem, "marginTop", true),
        left: offset.left - parentOffset.left - jQuery.css(elem, "marginLeft", true)
      };
    },
    offsetParent: function() {
      return this.map(function() {
        var offsetParent = this.offsetParent || docElem;
        while (offsetParent && (!jQuery.nodeName(offsetParent, "html") && jQuery.css(offsetParent, "position") === "static")) {
          offsetParent = offsetParent.offsetParent;
        }
        return offsetParent || docElem;
      });
    }
  });
  jQuery.each({
    scrollLeft: "pageXOffset",
    scrollTop: "pageYOffset"
  }, function(method, prop) {
    var top = "pageYOffset" === prop;
    jQuery.fn[method] = function(val) {
      return access(this, function(elem, method, val) {
        var win = getWindow(elem);
        if (val === undefined) {
          return win ? win[prop] : elem[method];
        }
        if (win) {
          win.scrollTo(!top ? val : window.pageXOffset, top ? val : window.pageYOffset);
        } else {
          elem[method] = val;
        }
      }, method, val, arguments.length, null);
    };
  });
  jQuery.each(["top", "left"], function(i, prop) {
    jQuery.cssHooks[prop] = addGetHookIf(support.pixelPosition, function(elem, computed) {
      if (computed) {
        computed = curCSS(elem, prop);
        return rnumnonpx.test(computed) ? jQuery(elem).position()[prop] + "px" : computed;
      }
    });
  });
  jQuery.each({
    Height: "height",
    Width: "width"
  }, function(name, type) {
    jQuery.each({
      padding: "inner" + name,
      content: type,
      "": "outer" + name
    }, function(defaultExtra, funcName) {
      jQuery.fn[funcName] = function(margin, value) {
        var chainable = arguments.length && (defaultExtra || typeof margin !== "boolean"),
            extra = defaultExtra || (margin === true || value === true ? "margin" : "border");
        return access(this, function(elem, type, value) {
          var doc;
          if (jQuery.isWindow(elem)) {
            return elem.document.documentElement["client" + name];
          }
          if (elem.nodeType === 9) {
            doc = elem.documentElement;
            return Math.max(elem.body["scroll" + name], doc["scroll" + name], elem.body["offset" + name], doc["offset" + name], doc["client" + name]);
          }
          return value === undefined ? jQuery.css(elem, type, extra) : jQuery.style(elem, type, value, extra);
        }, type, chainable ? margin : undefined, chainable, null);
      };
    });
  });
  jQuery.fn.size = function() {
    return this.length;
  };
  jQuery.fn.andSelf = jQuery.fn.addBack;
  if (typeof define === "function" && define.amd) {
    define("6e", [], function() {
      return jQuery;
    });
  }
  var _jQuery = window.jQuery,
      _$ = window.$;
  jQuery.noConflict = function(deep) {
    if (window.$ === jQuery) {
      window.$ = _$;
    }
    if (deep && window.jQuery === jQuery) {
      window.jQuery = _jQuery;
    }
    return jQuery;
  };
  if (typeof noGlobal === strundefined) {
    window.jQuery = window.$ = jQuery;
  }
  return jQuery;
}));

_removeDefine();
})();
(function() {
var _removeDefine = $__System.get("@@amd-helpers").createDefine();
define("5d", ["6e"], function(main) {
  return main;
});

_removeDefine();
})();
$__System.registerDynamic("51", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  "format cjs";
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("4a", [], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = true;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("6f", ["3b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var cof = req('3b');
  module.exports = Array.isArray || function(arg) {
    return cof(arg) == 'Array';
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("70", ["2d"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $ = req('2d');
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

$__System.registerDynamic("71", ["69", "2d"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var toString = {}.toString,
      toIObject = req('69'),
      getNames = req('2d').getNames;
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

$__System.registerDynamic("72", ["2d", "69"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $ = req('2d'),
      toIObject = req('69');
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

$__System.registerDynamic("4e", [], true, function(req, exports, module) {
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

$__System.registerDynamic("2b", ["73", "4e", "36"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var store = req('73')('wks'),
      uid = req('4e'),
      Symbol = req('36').Symbol;
  module.exports = function(name) {
    return store[name] || (store[name] = Symbol && Symbol[name] || (Symbol || uid)('Symbol.' + name));
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("4f", ["2d", "65", "2b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var def = req('2d').setDesc,
      has = req('65'),
      TAG = req('2b')('toStringTag');
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

$__System.registerDynamic("73", ["36"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var global = req('36'),
      SHARED = '__core-js_shared__',
      store = global[SHARED] || (global[SHARED] = {});
  module.exports = function(key) {
    return store[key] || (store[key] = {});
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("63", [], true, function(req, exports, module) {
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

$__System.registerDynamic("64", ["2d", "63", "2e"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $ = req('2d'),
      createDesc = req('63');
  module.exports = req('2e') ? function(object, key, value) {
    return $.setDesc(object, key, createDesc(1, value));
  } : function(object, key, value) {
    object[key] = value;
    return object;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("30", ["64"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = req('64');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("2e", ["74"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = !req('74')(function() {
    return Object.defineProperty({}, 'a', {get: function() {
        return 7;
      }}).a != 7;
  });
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("65", [], true, function(req, exports, module) {
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

$__System.registerDynamic("75", ["2d", "36", "65", "2e", "4c", "30", "74", "73", "4f", "4e", "2b", "72", "71", "70", "6f", "3e", "69", "63", "4a"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  'use strict';
  var $ = req('2d'),
      global = req('36'),
      has = req('65'),
      DESCRIPTORS = req('2e'),
      $def = req('4c'),
      $redef = req('30'),
      $fails = req('74'),
      shared = req('73'),
      setToStringTag = req('4f'),
      uid = req('4e'),
      wks = req('2b'),
      keyOf = req('72'),
      $names = req('71'),
      enumKeys = req('70'),
      isArray = req('6f'),
      anObject = req('3e'),
      toIObject = req('69'),
      createDesc = req('63'),
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
    if (DESCRIPTORS && !req('4a')) {
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

$__System.registerDynamic("76", ["75", "51", "d"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  req('75');
  req('51');
  module.exports = req('d').Symbol;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("77", ["76"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = req('76');
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("14", ["77"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {
    "default": req('77'),
    __esModule: true
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("6", [], true, function(req, exports, module) {
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

$__System.registerDynamic("78", ["2d"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $ = req('2d');
  module.exports = function defineProperty(it, key, desc) {
    return $.setDesc(it, key, desc);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("56", ["78"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {
    "default": req('78'),
    __esModule: true
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("13", ["56"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  "use strict";
  var _Object$defineProperty = req('56')["default"];
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

$__System.registerDynamic("3f", [], true, function(req, exports, module) {
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

$__System.registerDynamic("3a", ["3f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var aFunction = req('3f');
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

$__System.registerDynamic("3e", ["a"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var isObject = req('a');
  module.exports = function(it) {
    if (!isObject(it))
      throw TypeError(it + ' is not an object!');
    return it;
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("a", [], true, function(req, exports, module) {
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

$__System.registerDynamic("4d", ["2d", "a", "3e", "3a"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var getDesc = req('2d').getDesc,
      isObject = req('a'),
      anObject = req('3e');
  var check = function(O, proto) {
    anObject(O);
    if (!isObject(proto) && proto !== null)
      throw TypeError(proto + ": can't set as prototype!");
  };
  module.exports = {
    set: Object.setPrototypeOf || ('__proto__' in {} ? function(test, buggy, set) {
      try {
        set = req('3a')(Function.call, getDesc(Object.prototype, '__proto__').set, 2);
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

$__System.registerDynamic("79", ["4c", "4d"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $def = req('4c');
  $def($def.S, 'Object', {setPrototypeOf: req('4d').set});
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("7a", ["79", "d"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  req('79');
  module.exports = req('d').Object.setPrototypeOf;
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("7b", ["7a"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {
    "default": req('7a'),
    __esModule: true
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("7c", ["2d"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $ = req('2d');
  module.exports = function create(P, D) {
    return $.create(P, D);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("7d", ["7c"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {
    "default": req('7c'),
    __esModule: true
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("12", ["7d", "7b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  "use strict";
  var _Object$create = req('7d')["default"];
  var _Object$setPrototypeOf = req('7b')["default"];
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

$__System.registerDynamic("74", [], true, function(req, exports, module) {
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

$__System.registerDynamic("d", [], true, function(req, exports, module) {
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

$__System.registerDynamic("36", [], true, function(req, exports, module) {
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

$__System.registerDynamic("4c", ["36", "d"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var global = req('36'),
      core = req('d'),
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

$__System.registerDynamic("b", ["4c", "d", "74"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $def = req('4c'),
      core = req('d'),
      fails = req('74');
  module.exports = function(KEY, exec) {
    var $def = req('4c'),
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

$__System.registerDynamic("5a", [], true, function(req, exports, module) {
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

$__System.registerDynamic("3b", [], true, function(req, exports, module) {
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

$__System.registerDynamic("7e", ["3b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var cof = req('3b');
  module.exports = Object('z').propertyIsEnumerable(0) ? Object : function(it) {
    return cof(it) == 'String' ? it.split('') : Object(it);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("69", ["7e", "5a"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var IObject = req('7e'),
      defined = req('5a');
  module.exports = function(it) {
    return IObject(defined(it));
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("7f", ["69", "b"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var toIObject = req('69');
  req('b')('getOwnPropertyDescriptor', function($getOwnPropertyDescriptor) {
    return function getOwnPropertyDescriptor(it, key) {
      return $getOwnPropertyDescriptor(toIObject(it), key);
    };
  });
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("2d", [], true, function(req, exports, module) {
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

$__System.registerDynamic("80", ["2d", "7f"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  var $ = req('2d');
  req('7f');
  module.exports = function getOwnPropertyDescriptor(it, key) {
    return $.getDesc(it, key);
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("15", ["80"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  module.exports = {
    "default": req('80'),
    __esModule: true
  };
  global.define = __define;
  return module.exports;
});

$__System.registerDynamic("11", ["15"], true, function(req, exports, module) {
  ;
  var global = this,
      __define = global.define;
  global.define = undefined;
  "use strict";
  var _Object$getOwnPropertyDescriptor = req('15')["default"];
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

$__System.register("81", ["2", "3", "4", "6", "11", "12", "13", "14", "57", "5d", "6d", "6b", "5e"], function (_export) {
    var filterXML, tableux, gMap, _classCallCheck, _get, _inherits, _createClass, _Symbol, rudy, posts, div, filters, __css_class__, __name__, CssEffect, PrintAnalog;

    return {
        setters: [function (_9) {
            filterXML = _9["default"];
        }, function (_7) {
            tableux = _7;
        }, function (_8) {
            gMap = _8;
        }, function (_4) {
            _classCallCheck = _4["default"];
        }, function (_) {
            _get = _["default"];
        }, function (_2) {
            _inherits = _2["default"];
        }, function (_3) {
            _createClass = _3["default"];
        }, function (_5) {
            _Symbol = _5["default"];
        }, function (_6) {
            rudy = _6;
        }, function (_d) {}, function (_d2) {}, function (_b) {
            posts = _b;
        }, function (_e) {
            div = _e;
        }],
        execute: function () {
            /**
             * @module effects
             * contains subclasses of rudy.visualCore.Effect that implement
             * different visual effects.
             */

            // first, render the filter xml in the document so it is available via css selectors
            "use strict";

            filters = document.createElement("svg_filters");
            // will function basically like a div
            filters.style.position = "fixed";
            filters.style.bottom = 0;
            filters.style.zIndex = -99999999;
            document.body.appendChild(filters);
            filters.innerHTML = filterXML;

            __css_class__ = _Symbol();
            __name__ = _Symbol();

            CssEffect = (function (_rudy$visualCore$Effect) {
                _inherits(CssEffect, _rudy$visualCore$Effect);

                function CssEffect(name, css_class) {
                    _classCallCheck(this, CssEffect);

                    _get(Object.getPrototypeOf(CssEffect.prototype), "constructor", this).call(this);
                    this[__css_class__] = css_class;
                    this[__name__] = name;
                    tableux.registerEffect(this[__name__]);
                }

                _createClass(CssEffect, [{
                    key: "operate",
                    value: function operate(stage) {
                        var _this = this;

                        var hook_op = stage ? "addClass" : "removeClass";
                        _get(Object.getPrototypeOf(CssEffect.prototype), "operate", this).call(this, stage, [{
                            address: 1,
                            fn: function fn() {
                                return div.$map[hook_op](_this.css_class);
                            }
                        }]);
                    }
                }, {
                    key: "name",
                    get: function get() {
                        return this[__name__];
                    }
                }, {
                    key: "css_class",
                    get: function get() {
                        return this[__css_class__];
                    }
                }]);

                return CssEffect;
            })(rudy.visualCore.Effect);

            PrintAnalog = (function (_CssEffect) {
                _inherits(PrintAnalog, _CssEffect);

                function PrintAnalog() {
                    _classCallCheck(this, PrintAnalog);

                    _get(Object.getPrototypeOf(PrintAnalog.prototype), "constructor", this).call(this, "PrintAnalog", "print-analog");
                }

                _createClass(PrintAnalog, [{
                    key: "init",
                    value: function init() {}
                }, {
                    key: "teardown",
                    value: function teardown() {}
                }]);

                return PrintAnalog;
            })(CssEffect);

            _export("PrintAnalog", PrintAnalog);
        }
    };
});
$__System.register('55', [], function (_export) {
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
$__System.register("82", ["3", "4", "55", "81"], function (_export) {

    // visuals
    "use strict";

    var tableux, gMap, renderLoop, PrintAnalog, glow, flags, stock_list;

    _export("start", start);

    /*
    gMap.events.queue('map', 'zoom_changed', function() {
        let zoom = gMap.map.getZoom(),
            thresh = 0,
            scale = thresh - zoom,
            do_blur = zoom > thresh;
    
        glow.animated_post_blur_duration = do_blur ? 0 : scale * 100 + 100;
        glow.animated_post_blur_radius = do_blur ? 0 : Math.log10(scale) * 12;
    });
    */

    function start() {
        tableux.pushData(stock_list);
        glow.operate(true);
        tableux.select(glow);
    }

    return {
        setters: [function (_4) {
            tableux = _4;
        }, function (_3) {
            gMap = _3;
        }, function (_) {
            renderLoop = _;
        }, function (_2) {
            PrintAnalog = _2.PrintAnalog;
        }],
        execute: function () {
            glow = new PrintAnalog();
            flags = tableux.flags;
            stock_list = [
            // colorful building
            new tableux.TableuxData(43.04003854259038 - 87.91071553604706, 19, flags.PrintAnalog), new tableux.TableuxData(43.04786791144118, -87.90162418859109, 19, flags.PrintAnalog)];
        }
    };
});
$__System.register("1", ["4", "82"], function (_export) {
    //import * as featureDetection from "./featureDetection";

    //import { audio_scene_init } from "./audioScene";
    //console.log(google);
    // init visual scene

    // initalize google map
    "use strict";

    var gMap, visualSceneStart, bounds, overlay, loading;
    return {
        setters: [function (_2) {
            gMap = _2;
        }, function (_) {
            visualSceneStart = _.start;
        }],
        execute: function () {
            gMap.init();
            bounds = new google.maps.LatLngBounds(new google.maps.LatLng(42.96, -87.3159), new google.maps.LatLng(43.25, -86.9059));
            overlay = new google.maps.GroundOverlay('static/assets/virgo-logo.png', bounds);

            overlay.setMap(gMap.map);

            visualSceneStart();

            gMap.events.initQueuedEvents('map');

            // suddenly remove loading screen - no transition!
            loading = document.getElementById("loading-container");

            document.body.removeChild(loading);
        }
    };
});
})
(function(factory) {
  factory();
});
//# sourceMappingURL=main.js.map