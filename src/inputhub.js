'use strict';

export default class InputHub {
  constructor(options={}) {
    this.last = {};
    this.previous = {};

    // Store listeners in the form { 'type': WeakMap([{listener1: data}, {listener2: data}]) }
    // Using WeakMaps since we don't need to remember the listener if node.removeEventListener
    // was used to remove it directly.
    this.listeners = {};

    this.options = {
      typeSeparator: '/',
      domNode:       document.body,
      extendJQuery:  true,
      ...options,
    };

    // At least Blaze creates new jQuery events for new templates. Checking event.detained is not dependable without extending jQuery.
    if (this.options.extendJQuery && window.jQuery && !jQuery.event.props.includes('detained')) {
      jQuery.event.props.push('detained');
    }
  }

  /* Return whether the event was detained prior to the call */
  detain(event) {
    if (event.detained) {
      return true;
    }
    const ne = this.getNative(event);
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
  detainGhostMouse(event) {
    if (event.detained) {
      return true;
    }
    const ne = this.getNative(event);
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
  getNative(event) {
    return event.originalEvent || event.nativeEvent || event;
  }

  isTouchEvent(event) {
    return /^touch/.test(event.type) || this.getNative(event).pointerType === 'touch';
  }

  isGhostMouse(event) {
    return /^mouse/.test(event.type) && this.isTouchEvent(this.last);
  }

  deviceType(event) {
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

  register(event) {
    const ne = this.getNative(event);
    this.last = this.previous[event.type] = {
      type:          event.type,
      target:        event.target,
      currentTarget: event.currentTarget,
      pointerType:   ne.pointerType,
      timeStamp:     event.timeStamp,
      event,
    };
  }

  typeArray(typestring) {
    typeAssert(typestring, 'string');
    return typestring.split(this.options.typeSeparator).map(t => t.trim()).filter(t => t);
  }

  once(types, listener) {
    return this.on(types, listener, {once: true});
  }

  // typestring is a string in the format 'touchstart/mousedown'
  // listener is a function
  // options are the standard options supported by addEventListener()
  // Returns a function that unbinds the listeners.
  // If once is used, only this.off() will be able to unbind them. Otherwise removeEventListener works as well.
  on(typestring, listener, options={}) {
    typeAssert(listener, 'function');
    const { once, capture, passive } = options;
    // Cache the domNode in case it is forcibly changed
    const domNode = this.options.domNode;

    // Make sure we don't double-bind listeners
    this.off(typestring, listener);

    const types = this.typeArray(typestring);
    if (!types.length) {
      throw new Error('Got no type(s) to bind listener to');
    }

    // domListener and unbind depend on each other, but this is fine since they are both defined by the time either execute
    const domListener = !once ? listener : function domListener(event) {
      listener.call(this, event);
      unbind();
    };

    // Return an unbind function hat will unbind this specific binding.
    const unbind = () => types.forEach(type => {
      const data = this.listeners[type].get(listener);
      if (data && data.unbind === unbind) {
        domNode.removeEventListener(type, domListener);
        this.listeners[type].delete(listener);
      }
    });

    // Cache the domListener so that we can remove it later.
    const data = { domListener, unbind };

    // We are doing "once" ourselves (once across all types together),
    // but we simply pass through capture and passive if they are supported and set.
    // Note, passive defaults to true in chromium 55+ on touchstart and touchmove.
    let _options = capture;
    if (passive != null && passiveSupported) {
      _options = { capture, passive };
    }

    types.forEach(type => {
      if (!this.listeners[type]) {
        this.listeners[type] = new WeakMap();
      }
      this.listeners[type].set(listener, data);
      domNode.addEventListener(type, domListener, _options);
    });

    return unbind;
  }

  off(typestring, listener) {
    typeAssert(listener, 'function');

    this.typeArray(typestring).forEach(type => {
      const data = this.listeners[type] && this.listeners[type].get(listener);
      if (!data) return;
      this.options.domNode.removeEventListener(type, data.domListener);
      this.listeners[type].delete(listener);
    });
  }

  /*******************/
  /* Private methods */
  /*******************/

  _detainMismatch(event, nativeEvent) {
    console.warn('Native event already detained.');
    const { type, target, currentTarget, timeStamp } = event;
    console.log({ type, target, currentTarget, timeStamp, event, nativeEvent });
    event.detained = true;
    return true;
  }

  /*************/
  /* Constants */
  /*************/

  pointerdown  = !!window.PointerEvent ? 'pointerdown' :  'mousedown/touchstart';
  pointerup    = !!window.PointerEvent ? 'pointerup'   :  'mouseup/touchend';
  pointerenter = !!window.PointerEvent ? 'pointerenter' : 'mouseenter';
  pointerleave = !!window.PointerEvent ? 'pointerleave' : 'mouseleave';
  get pointermove() {
    console.warn('Pointermove fires together with mousemove events, but also with the first few touchmove events. Be particular about the event types you need.');
    return 'pointermove';
  }

  isMac = (/^Mac/).test(navigator.platform);
  metaKey = this.isMac ? 'metaKey' : 'ctrlKey';
}


/*********************/
/* Feature detection */
/********************/

// Check whether addEventListener supports an options object.
// Copied from https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener
let passiveSupported = false;
try {
  window.addEventListener("test", null, Object.defineProperty({}, "passive", { get() { passiveSupported = true; } }));
} catch(err) {}

/********************/
/* Helper functions */
/********************/

function typeAssert(variable, type) {
  if (typeof variable === type) return;
  throw new TypeError(`Variable expected to be of type ${type}`);
}
