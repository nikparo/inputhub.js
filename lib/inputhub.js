'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var InputHub = function () {
  function InputHub() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, InputHub);

    this.pointerdown = !!window.PointerEvent ? 'pointerdown' : 'mousedown/touchstart';
    this.pointerup = !!window.PointerEvent ? 'pointerup' : 'mouseup/touchend';
    this.pointerenter = !!window.PointerEvent ? 'pointerenter' : 'mouseenter';
    this.pointerleave = !!window.PointerEvent ? 'pointerleave' : 'mouseleave';
    this.isMac = /^Mac/.test(navigator.platform);
    this.metaKey = this.isMac ? 'metaKey' : 'ctrlKey';

    this.last = {};
    this.previous = {};

    // Store listeners in the form { 'type': WeakMap([{listener1: data}, {listener2: data}]) }
    // Using WeakMaps since we don't need to remember the listener if node.removeEventListener
    // was used to remove it directly.
    this.listeners = {};

    this.options = _extends({
      typeSeparator: '/',
      domNode: document.body,
      extendJQuery: true
    }, options);

    // At least Blaze creates new jQuery events for new templates. Checking event.detained is not dependable without extending jQuery.
    if (this.options.extendJQuery && window.jQuery && !jQuery.event.props.includes('detained')) {
      jQuery.event.props.push('detained');
    }
  }

  /* Return whether the event was detained prior to the call */


  _createClass(InputHub, [{
    key: 'detain',
    value: function detain(event) {
      if (event.detained) {
        return true;
      }
      var ne = this.getNative(event);
      if (ne.detained) {
        return this._detainMismatch(event, ne);
      }
      ne.detained = event.detained = true;
      this.register(event);
      return false;
    }

    // Detain ghost mouse events by returning true immediately.
    // - Not stopping propagation or preventing default, as that would prevent clicks as well.
    // - Not detaining non-ghosts, since it's unknown whether they should be detained

  }, {
    key: 'detainGhostMouse',
    value: function detainGhostMouse(event) {
      if (event.detained) {
        return true;
      }
      var ne = this.getNative(event);
      if (ne.detained) {
        return this._detainMismatch(event, ne);
      }
      if (this.isGhostMouse(event)) {
        ne.detained = event.detained = true;
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
      return (/^mouse/.test(event.type) && this.isTouchEvent(this.last)
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
    key: 'register',
    value: function register(event) {
      var ne = this.getNative(event);
      this.last = this.previous[event.type] = {
        type: event.type,
        target: event.target,
        currentTarget: event.currentTarget,
        pointerType: ne.pointerType,
        timeStamp: event.timeStamp,
        event: event
      };
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

      // We are doing "once" ourselves (once across all types together),
      // but we simply pass through capture and passive if they are supported and set.
      // Note, passive defaults to true in chromium 55+ on touchstart and touchmove.
      var _options = capture;
      if (passive != null && passiveSupported) {
        _options = { capture: capture, passive: passive };
      }

      types.forEach(function (type) {
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

    /*******************/
    /* Private methods */
    /*******************/

  }, {
    key: '_detainMismatch',
    value: function _detainMismatch(event, nativeEvent) {
      console.warn('Native event already detained.');
      var type = event.type,
          target = event.target,
          currentTarget = event.currentTarget,
          timeStamp = event.timeStamp;

      console.log({ type: type, target: target, currentTarget: currentTarget, timeStamp: timeStamp, event: event, nativeEvent: nativeEvent });
      event.detained = true;
      return true;
    }

    /*************/
    /* Constants */
    /*************/

  }, {
    key: 'pointermove',
    get: function get() {
      console.warn('Pointermove fires together with mousemove events, but also with the first few touchmove events. Be particular about the event types you need.');
      return 'pointermove';
    }
  }]);

  return InputHub;
}();

/*********************/
/* Feature detection */
/********************/

// Check whether addEventListener supports an options object.
// Copied from https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener


exports.default = InputHub;
var passiveSupported = false;
try {
  window.addEventListener("test", null, Object.defineProperty({}, "passive", {
    get: function get() {
      passiveSupported = true;
    }
  }));
} catch (err) {}

/********************/
/* Helper functions */
/********************/

function typeAssert(variable, type) {
  if ((typeof variable === 'undefined' ? 'undefined' : _typeof(variable)) === type) return;
  throw new TypeError('Variable expected to be of type ' + type);
}