import detectPassiveEvents from 'detect-passive-events';
import memoizeOne from 'memoize-one';

import listSeparator from './utils/listSeparator';
import reactHandlerExists from './utils/reactHandlerExists';
import typeArray from './utils/typeArray';

const AWAIT_REACT = 'react';
const OPTION_KEYS = ['passivecapture', 'capture', 'passive', 'normal'];

const typeOppositeMap = {
  pointerdown: 'pointerup',
  pointerup: 'pointerdown',
  touchstart: 'touchend',
  touchend: 'touchstart',
  mousedown: 'mouseup',
  mouseup: 'mousedown',
};

/* **************** */
/* InputHub class   */
/* **************** */

const doc = (typeof document !== 'undefined') ? document : null;

const defaultOptions = {
  typeSeparator: new RegExp(' |/'), // Split on ' ', '/'. Regex or string.
  domNode: doc,
  awaitReact: true,
  passiveTypes: ['touchstart', 'touchmove', 'scroll'],
  lifo: true, // Last in - First out
  savedProps(event, nativeEvent) {
    const {
      type, target, currentTarget, timeStamp,
    } = event;
    const {
      fulfilled, fulfilledAt, pointerType, defaultPrevented,
    } = nativeEvent || event;
    return {
      // Get from event, as they sometimes differ from the native event
      type,
      target,
      currentTarget,
      timeStamp,
      // Get native event props
      fulfilled,
      fulfilledAt,
      pointerType, // missing for jQuery events
      defaultPrevented,
    };
  },
};

export default class InputHub {
  constructor(options = {}) {
    this.last = null;
    this.previous = {};

    // Store listeners in the form:
    // {
    //   [type]: [listenerDataObject],
    // }
    this.listeners = {};
    this.domListeners = {};

    this.options = { ...defaultOptions };

    Object.keys(this.options).forEach((key) => {
      if (key in options) {
        this.options[key] = options[key];
      }
    });
  }

  /* eslint-disable class-methods-use-this */
  getNative(event) {
    // Get the native event (jQuery || React || native)
    return event.originalEvent || event.nativeEvent || event;
  }

  getDeviceType(event) {
    if (/^pointer/.test(event.type)) {
      return event.pointerType || 'mouse';
    }
    if (/^mouse/.test(event.type)) {
      return 'mouse';
    }
    if (/^touch/.test(event.type)) {
      return 'touch';
    }
    if (/^key/.test(event.type)) {
      return 'key';
    }
    return null;
  }

  getOppositeType(type) {
    return typeOppositeMap[type] || null;
  }
  /* eslint-enable class-methods-use-this */

  isFulfilled(event) {
    const ne = this.getNative(event);
    if (this.options.awaitReact) {
      if (event.nativeEvent) {
        return (ne.fulfilled === AWAIT_REACT) ? false : !!ne.fulfilled;
      }
      if (ne.fulfilled == null) {
        // Check for react handler if we haven't yet
        ne.fulfilled = reactHandlerExists(event) ? AWAIT_REACT : false;
      }
    }
    return !!ne.fulfilled;
  }

  /* Returns whether we just fulfilled the event */
  // Always fulfill the native event (since react synthetic events are re-used)
  fulfill(event) {
    if (this.isFulfilled(event)) {
      return false;
    }
    const ne = this.getNative(event);
    ne.fulfilled = true;
    ne.fulfilledAt = event.currentTarget;
    this.register(event);
    return true;
  }

  // Fulfill a ghost event (but not "real" events). Returns whether it was fulfilled.
  // - Does not stop propagation or prevent default, as that may prevent clicks or
  // other built in behaviour (e.g. focus).
  fulfillGhost(event) {
    const ne = this.getNative(event);
    if (ne.fulfilled) {
      // FIXME: test this with react events!
      // - Is this needed? Should it be (ne.fulfilled === true) ???
      return false;
    }
    if (this.isGhostMouse(event) || this.isGhostTouch(event)) {
      ne.fulfilled = true;
      return true;
    }
    return false;
  }

  isTouchEvent(event) {
    return (/^touch/.test(event.type) || this.getNative(event).pointerType === 'touch');
  }

  isGhostMouse(event) {
    return this.last && /^mouse/.test(event.type) && (/^touch/.test(this.last.type) || /^pointer/.test(this.last.type));
  }

  isGhostTouch(event) {
    return this.last && this.last.pointerType === 'touch' && /^touch/.test(event.type) && /^pointer/.test(this.last.type);
  }

  register(event) {
    const ne = this.getNative(event);
    this.last = this.options.savedProps(event, ne);
    this.previous[event.type] = this.last;
  }

  getLast(type) {
    if (type === undefined) {
      return this.last;
    }
    return this.previous[type] || null;
  }

  // FIXME: This should be a private function
  updateDomBindings(type) {
    if (!this.listeners[type]) {
      return;
    }
    if (!this.domListeners[type]) {
      this.domListeners[type] = {};
    }
    const filtered = this.listeners[type].filter();

    OPTION_KEYS.forEach((key) => {
      const isMatch = !!this.domListeners[type][key] === !!filtered[key].length;
      if (isMatch) {
        return;
      }
      const passive = key.startsWith('passive');
      const capture = key.endsWith('capture');
      const options = !detectPassiveEvents.hasSupport ? !!capture : { capture, passive };

      if (filtered[key].length) {
        // Bind listener.
        const domListener = (event) => {
          this.listeners[type].filter()[key].forEach(listener => listener(event));
        };

        this.domListeners[type][key] = domListener;
        this.options.domNode.addEventListener(type, domListener, options);
      } else {
        // Unbind listener if there are no handlers
        const domListener = this.domListeners[type][key];
        this.domListeners[type][key] = null;
        this.options.domNode.removeEventListener(type, domListener);
      }
    });
  }

  once(types, listener, options) {
    return this.on(types, listener, { ...options, once: true });
  }

  // typestring is a string in the format 'touchstart/mousedown'
  // listener is a function
  // options are: { once, lifo, capture, passive }
  // Returns a function that unbinds the listeners.
  on(typestring, listener, options = {}) {
    if (typeof listener !== 'function') {
      throw new Error('Expected the listener to be a function');
    }
    const once = !!options.once;
    const capture = !!options.capture;
    const lifo = options.lifo != null ? !!options.lifo : !!this.options.lifo;

    const types = typeArray(typestring, this.options.typeSeparator);
    if (!types.length) {
      throw new Error('Got no type(s) to bind listener to');
    }

    // Make sure we don't double-bind listeners
    this.off(typestring, listener, options);

    // Return an unbind function that will unbind this function for the passed typestring
    const unbindListeners = [];
    const unbindAll = () => unbindListeners.forEach(unbind => unbind());

    const wrappedListener = !once ? listener : function wrappedListener(event) {
      listener.call(this, event);
      unbindAll();
    };

    types.forEach((type) => {
      // We do "once" ourselves, combined over all types, but set passive if it is supported.
      // Note, passive defaults to true in chromium 55+ on touchstart and touchmove.
      const passive = (options.passive != null)
        ? !!options.passive
        : this.options.passiveTypes.includes(type);

      // Create defaults for any type we haven't seen before.
      if (!this.listeners[type]) {
        const listFilter = memoizeOne(listSeparator);
        const filter = () => listFilter(this.listeners[type].handlers);
        this.listeners[type] = {
          filter,
          handlers: [],
        };
      }

      // Store data about this listener, so that we can unbind it etc.
      const data = {
        listener,
        // unbindAll,
        wrappedListener,
        passive,
        capture,
        // once,
        // typestring,
      };

      // Create an unbind function for this specific binding
      let isBound = true;
      const unbind = () => {
        if (!isBound) {
          return;
        }
        isBound = false;
        const idx = this.listeners[type].handlers.indexOf(data);
        if (idx === -1) {
          return;
        }
        this.listeners[type].handlers = this.listeners[type].handlers.slice();
        this.listeners[type].handlers.splice(idx, 1);
        this.updateDomBindings(type);
      };
      data.unbind = unbind;
      unbindListeners.push(unbind);

      // Add the listener data to the start or end of array.
      // Dom listeners are executed in the same order as they are added.
      if (lifo) {
        this.listeners[type].handlers = [data, ...this.listeners[type].handlers];
      } else {
        this.listeners[type].handlers = [...this.listeners[type].handlers, data];
      }
      this.updateDomBindings(type);
    });

    return unbindAll;
  }

  off(typestring, listener, options = {}) {
    if (typeof listener !== 'function') {
      throw new Error('Expected the listener to be a function');
    }
    const ignorePassive = options.passive == null;
    const ignoreCapture = options.capture == null;
    const passive = !!options.passive;
    const capture = !!options.capture;

    const isMatch = data => (
      listener === data.listener
      && (ignorePassive || passive === data.passive)
      && (ignoreCapture || capture === data.capture)
    );

    const types = typeArray(typestring, this.options.typeSeparator);
    types.forEach((type) => {
      if (!this.listeners[type]) {
        return;
      }
      // Do a reverse traversal of the handlers to splice away any matching listeners
      const handlers = this.listeners[type].handlers.slice();
      let hasChanged;
      for (let i = (handlers.length - 1); i >= 0; i -= 1) {
        if (isMatch(handlers[i])) {
          hasChanged = true;
          handlers.splice(i, 1);
        }
      }
      if (!hasChanged) {
        return;
      }
      this.listeners[type].handlers = handlers;
      this.updateDomBindings(type);
    });
  }

  offAll() {
    Object.keys(this.domListeners).forEach((type) => {
      Object.keys(this.domListeners[type]).forEach((key) => {
        const listener = this.domListeners[type][key];
        this.options.domNode.removeEventListener(type, listener);
      });
    });
    this.listeners = {};
    this.domListeners = {};
  }
}
