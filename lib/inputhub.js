'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _detectPassiveEvents = require('detect-passive-events');

var _detectPassiveEvents2 = _interopRequireDefault(_detectPassiveEvents);

var _memoizeOne = require('memoize-one');

var _memoizeOne2 = _interopRequireDefault(_memoizeOne);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var AWAIT_REACT = 'react';
var OPTION_KEYS = ['passivecapture', 'capture', 'passive', 'normal'];

var InputHub = function () {
  function InputHub() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, InputHub);

    this.last = {};
    this.previous = {};

    // Store listeners in the form { 'type': WeakMap([{listener1: data}, {listener2: data}]) }
    // Using WeakMaps since we don't need to remember the listener if node.removeEventListener
    // was used to remove it directly.
    this.listeners = {};
    this.domListeners = {};

    this.options = _extends({
      typeSeparator: new RegExp(' |/'), // Split on ' ', '/'. Regex or string.
      domNode: global.document,
      extendJQuery: true,
      supportReact: true,
      passiveTypes: ['touchstart', 'touchmove', 'scroll'],
      lifo: true, // Last in - First out
      savedProps: function savedProps(event, nativeEvent) {
        var type = event.type,
            target = event.target,
            currentTarget = event.currentTarget,
            timeStamp = event.timeStamp;

        var _ref = nativeEvent || event,
            fulfilled = _ref.fulfilled,
            fulfilledAt = _ref.fulfilledAt,
            pointerType = _ref.pointerType,
            defaultPrevented = _ref.defaultPrevented;

        return {
          // Get from event, as they sometimes differ from the native event
          type: type,
          target: target,
          currentTarget: currentTarget,
          timeStamp: timeStamp,
          // Get native event props
          fulfilled: fulfilled,
          fulfilledAt: fulfilledAt,
          pointerType: pointerType, // missing for jQuery events
          defaultPrevented: defaultPrevented
        };
      }
    }, options);

    // Blaze (or jQuery?) creates new jQuery events for new templates, even for the same native event.
    // Checking event.fulfilled is therefore not dependable without extending jQuery.
    if (this.options.extendJQuery && typeof jQuery !== 'undefined' && !jQuery.event.props.includes('fulfilled')) {
      jQuery.event.props.push('fulfilled');
    }
  }

  _createClass(InputHub, [{
    key: 'isFulfilled',
    value: function isFulfilled(event) {
      var ne = this.getNative(event);
      if (this.options.supportReact) {
        if (event.nativeEvent) {
          return ne.fulfilled === AWAIT_REACT ? false : !!ne.fulfilled;
        }
        if (ne.fulfilled == null) {
          // Check for react handler if we haven't yet
          ne.fulfilled = this.reactHandlerExists(event) ? AWAIT_REACT : false;
        }
      }
      return !!ne.fulfilled;
    }

    // This check relies on the developer adding 'react-click' etc. handlers.
    // This is because we don't have a good way of check whether a react handler is actually bound or not.
    // - Does not follow portals, but native events don't follow portals either, so it shouldn't matter

  }, {
    key: 'reactHandlerExists',
    value: function reactHandlerExists(event) {
      if (event.nativeEvent) {
        // This is a synthetic event - there's no need to check
        return false;
      }
      var cls = '.react-' + event.type;
      var target = event.target;
      while (target && target !== event.currentTarget) {
        if (target.matches(cls)) {
          return true;
        }
        target = target.parentElement;
      }
      return false;
    }

    /* Returns whether we just fulfilled the event */
    // Always fulfill the native event (since react synthetic events are re-used)

  }, {
    key: 'fulfill',
    value: function fulfill(event) {
      if (this.isFulfilled(event)) {
        return false;
      }
      var ne = this.getNative(event);
      ne.fulfilled = true;
      ne.fulfilledAt = event.currentTarget;
      this.register(event);
      return true;
    }

    // Fulfill a ghost event (but not "real" events). Returns whether it was fulfilled.
    // - Not stopping propagation or preventing default, as that may prevent clicks or other built in behaviour (e.g. focus).

  }, {
    key: 'fulfillGhost',
    value: function fulfillGhost(event) {
      var ne = this.getNative(event);
      if (ne.fulfilled) {
        // FIXME: test this with react events! ... Is this needed? Should it be (ne.fulfilled === true) ???
        return false;
      }
      if (this.isGhostMouse(event) || this.isGhostTouch(event)) {
        ne.fulfilled = true;
        return true;
      }
      return false;
    }

    // Get the native event (jQuery || React || native)

  }, {
    key: 'getNative',
    value: function getNative(event) {
      return event.originalEvent || event.nativeEvent || event;
    }
  }, {
    key: 'isTouchEvent',
    value: function isTouchEvent(event) {
      return (/^touch/.test(event.type) || this.getNative(event).pointerType === 'touch'
      );
    }
  }, {
    key: 'isGhostMouse',
    value: function isGhostMouse(event) {
      return (/^mouse/.test(event.type) && (/^touch/.test(this.last.type) || /^pointer/.test(this.last.type))
      );
    }
  }, {
    key: 'isGhostTouch',
    value: function isGhostTouch(event) {
      return (/^touch/.test(event.type) && /^pointer/.test(this.last.type) && this.last.pointerType === 'touch'
      );
    }
  }, {
    key: 'deviceType',
    value: function deviceType(event) {
      if (/^pointer/.test(event.type)) {
        return event.pointerType || 'mouse';
      } else if (/^mouse/.test(event.type)) {
        return 'mouse';
      } else if (/^touch/.test(event.type)) {
        return 'touch';
      } else if (/^key/.test(event.type)) {
        return 'key';
      }
    }
  }, {
    key: 'getOppositeType',
    value: function getOppositeType(type) {
      switch (type) {
        case 'pointerdown':
          return 'pointerup';
        case 'pointerup':
          return 'pointerdown';
        case 'touchstart':
          return 'touchend';
        case 'touchend':
          return 'touchstart';
        case 'mousedown':
          return 'mouseup';
        case 'mouseup':
          return 'mousedown';
      }
    }
  }, {
    key: 'register',
    value: function register(event) {
      var ne = this.getNative(event);
      this.last = this.options.savedProps(event, ne);
      this.previous[event.type] = this.last;
    }
  }, {
    key: 'typeArray',
    value: function typeArray(typestring) {
      typeAssert(typestring, 'string');
      return typestring.split(this.options.typeSeparator).map(function (t) {
        return t.trim();
      }).filter(function (t) {
        return t;
      });
    }
  }, {
    key: 'updateDomBindings',
    value: function updateDomBindings(type) {
      var _this = this;

      if (!this.listeners[type]) {
        return;
      }
      if (!this.domListeners[type]) {
        this.domListeners[type] = {};
      }
      var filtered = this.listeners[type].filter();

      OPTION_KEYS.forEach(function (key) {
        var isMatch = !!_this.domListeners[type][key] === !!filtered[key].length;
        if (isMatch) {
          return;
        }
        var passive = key.startsWith('passive');
        var capture = key.endsWith('capture');
        var options = !_detectPassiveEvents2.default.hasSupport ? !!capture : { capture: capture, passive: passive };

        if (filtered[key].length) {
          // Bind listener. Simulate passive with async.
          var asyncPassive = passive && !_detectPassiveEvents2.default.hasSupport;
          var domListener = function domListener(event) {
            var predicate = asyncPassive ? function () {
              var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(handler) {
                return regeneratorRuntime.wrap(function _callee$(_context) {
                  while (1) {
                    switch (_context.prev = _context.next) {
                      case 0:
                        return _context.abrupt('return', handler(event));

                      case 1:
                      case 'end':
                        return _context.stop();
                    }
                  }
                }, _callee, _this);
              }));

              return function (_x2) {
                return _ref2.apply(this, arguments);
              };
            }() : function (handler) {
              return handler(event);
            };
            _this.listeners[type].filter()[key].forEach(predicate);
          };

          _this.domListeners[type][key] = domListener;
          _this.options.domNode.addEventListener(type, domListener, options);
        } else {
          // Unbind listener if there are no handlers
          var _domListener = _this.domListeners[type][key];
          _this.domListeners[type][key] = null;
          _this.options.domNode.removeEventListener(type, _domListener);
        }
      });
    }
  }, {
    key: 'once',
    value: function once(types, listener, options) {
      return this.on(types, listener, _extends({}, options, { once: true }));
    }

    // typestring is a string in the format 'touchstart/mousedown'
    // listener is a function
    // options are: { once, lifo, capture, passive }
    // Returns a function that unbinds the listeners.

  }, {
    key: 'on',
    value: function on(typestring, listener) {
      var _this2 = this;

      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

      typeAssert(listener, 'function');
      typeAssert(options, 'object');
      var once = !!options.once;
      var capture = !!options.capture;
      var lifo = options.life != null ? !!options.lifo : this.options.lifo;

      var types = this.typeArray(typestring);
      if (!types.length) {
        throw new Error('Got no type(s) to bind listener to');
      }

      // Make sure we don't double-bind listeners
      this.off(typestring, listener, options);

      // Return an unbind function that will unbind this function for the passed typestring
      var unbindListeners = [];
      var unbindAll = function unbindAll() {
        return unbindListeners.forEach(function (unbind) {
          return unbind();
        });
      };

      var wrappedListener = !once ? listener : function wrappedListener(event) {
        listener.call(this, event);
        unbindAll();
      };

      types.forEach(function (type) {
        // We do "once" ourselves, combined over all types, but set passive if it is supported.
        // Note, passive defaults to true in chromium 55+ on touchstart and touchmove.
        var passive = options.passive != null ? !!options.passive : _this2.options.passiveTypes.includes(type);

        // Create defaults for any type we haven't seen before.
        if (!_this2.listeners[type]) {
          _this2.listeners[type] = {
            filter: _this2.listFactory(type),
            handlers: []
          };
        }

        // Store data about this listener, so that we can unbind it etc.
        var data = {
          listener: listener,
          unbindAll: unbindAll,
          wrappedListener: wrappedListener,
          passive: passive,
          capture: capture,
          once: once,
          typestring: typestring
        };

        // Create an unbind function for this specific binding
        var isBound = true;
        var unbind = function unbind() {
          if (!isBound) {
            return;
          }
          isBound = false;
          var idx = _this2.listeners[type].handlers.indexOf(data);
          if (idx === -1) {
            return;
          }
          _this2.listeners[type].handlers = _this2.listeners[type].handlers.slice();
          _this2.listeners[type].handlers.splice(idx, 1);
          _this2.updateDomBindings(type);
        };
        data.unbind = unbind;
        unbindListeners.push(unbind);

        // Add the listener data to the start or end of array.
        // Dom listeners are executed in the same order as they are added.
        if (lifo) {
          _this2.listeners[type].handlers = [data].concat(_toConsumableArray(_this2.listeners[type].handlers));
        } else {
          _this2.listeners[type].handlers = [].concat(_toConsumableArray(_this2.listeners[type].handlers), [data]);
        }
        _this2.updateDomBindings(type);
      });

      return unbindAll;
    }
  }, {
    key: 'off',
    value: function off(typestring, listener) {
      var _this3 = this;

      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

      typeAssert(listener, 'function');
      var ignorePassive = options.passive == null;
      var ignoreCapture = options.capture == null;
      var passive = !!options.passive;
      var capture = !!options.capture;

      var isMatch = function isMatch(data) {
        return listener === data.listener && (ignorePassive || passive === data.passive) && (ignoreCapture || capture === data.capture);
      };

      this.typeArray(typestring).forEach(function (type) {
        if (!_this3.listeners[type]) {
          return;
        }
        // Do a reverse traversal of the handlers to splice away any matching listeners
        var handlers = _this3.listeners[type].handlers.slice();
        var hasChanged = void 0;
        for (var i = handlers.length - 1; i >= 0; i--) {
          if (isMatch(handlers[i])) {
            hasChanged = true;
            handlers.splice(i, 1);
          }
        }
        if (!hasChanged) {
          return;
        }
        _this3.listeners[type].handlers = handlers;
        _this3.updateDomBindings(type);
      });
    }
  }, {
    key: 'listFactory',
    value: function listFactory(type) {
      var _this4 = this;

      var listFilter = (0, _memoizeOne2.default)(listSeparator);
      return function () {
        return listFilter(_this4.listeners[type].handlers);
      };
    }
  }]);

  return InputHub;
}();

/* **************** */
/* Helper functions */
/* **************** */

exports.default = InputHub;
function typeAssert(variable, type) {
  if ((typeof variable === 'undefined' ? 'undefined' : _typeof(variable)) === type) return;
  throw new TypeError('Variable expected to be of type ' + type);
}

function listSeparator(list) {
  var passivecapture = [];
  var capture = [];
  var passive = [];
  var normal = [];
  list.forEach(function (obj) {
    var ary = void 0;
    if (obj.passive && obj.capture) {
      ary = passivecapture;
    } else if (obj.capture) {
      ary = capture;
    } else if (obj.passive) {
      ary = passive;
    } else {
      ary = normal;
    }
    ary.push(obj.wrappedListener);
  });
  return { passivecapture: passivecapture, capture: capture, passive: passive, normal: normal };
}