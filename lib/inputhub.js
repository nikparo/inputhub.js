'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _detectPassiveEvents = require('detect-passive-events');

var _detectPassiveEvents2 = _interopRequireDefault(_detectPassiveEvents);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var AWAIT_REACT = 'react';

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

    this.options = _extends({
      typeSeparator: new RegExp(' |/'), // Split on ' ', '/'. Regex or string.
      domNode: global.document,
      extendJQuery: true,
      supportReact: true,
      passiveTypes: ['touchstart', 'touchmove', 'scroll'],
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
    key: 'once',
    value: function once(types, listener) {
      return this.on(types, listener, { once: true });
    }

    // typestring is a string in the format 'touchstart/mousedown'
    // listener is a function
    // options are the standard options supported by addEventListener()
    // Returns a function that unbinds the listeners.
    // If once is used, only this.off() will be able to unbind them. Otherwise removeEventListener works as well.

  }, {
    key: 'on',
    value: function on(typestring, listener) {
      var _this = this;

      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

      typeAssert(listener, 'function');
      var once = options.once,
          capture = options.capture,
          passive = options.passive;
      // Cache the domNode in case it is forcibly changed

      var domNode = this.options.domNode;
      if (!domNode) {
        console.error('Inputhub domNode is not defined');
        return;
      }

      // Make sure we don't double-bind listeners
      this.off(typestring, listener);

      var types = this.typeArray(typestring);
      if (!types.length) {
        throw new Error('Got no type(s) to bind listener to');
      }

      // domListener and unbind depend on each other, but this is fine since they are both defined by the time either execute
      var domListener = !once ? listener : function domListener(event) {
        listener.call(this, event);
        unbind();
      };

      // Return an unbind function hat will unbind this specific binding.
      var unbind = function unbind() {
        return types.forEach(function (type) {
          var data = _this.listeners[type].get(listener);
          if (data && data.unbind === unbind) {
            domNode.removeEventListener(type, domListener);
            _this.listeners[type].delete(listener);
          }
        });
      };

      // Cache the domListener so that we can remove it later.
      var data = { domListener: domListener, unbind: unbind };

      types.forEach(function (type) {
        // We do "once" ourselves, combined over all types, but set passive if it is supported.
        // Note, passive defaults to true in chromium 55+ on touchstart and touchmove.
        var _options = !_detectPassiveEvents2.default.hasSupport ? !!capture : {
          capture: !!capture,
          passive: passive != null ? !!passive : _this.options.passiveTypes.includes(type)
        };
        // Create weakmap for any type we haven't seen before.
        if (!_this.listeners[type]) {
          _this.listeners[type] = new WeakMap();
        }
        _this.listeners[type].set(listener, data);
        domNode.addEventListener(type, domListener, _options);
      });

      return unbind;
    }
  }, {
    key: 'off',
    value: function off(typestring, listener) {
      var _this2 = this;

      typeAssert(listener, 'function');

      this.typeArray(typestring).forEach(function (type) {
        var data = _this2.listeners[type] && _this2.listeners[type].get(listener);
        if (!data) return;
        _this2.options.domNode.removeEventListener(type, data.domListener);
        _this2.listeners[type].delete(listener);
      });
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